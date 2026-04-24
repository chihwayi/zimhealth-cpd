import { z } from 'zod';
import { db } from '../lib/db';
import { logger } from '../lib/logger';

const COUNCIL_API_URL = process.env.COUNCIL_SYNC_API_URL ?? process.env.NCZ_SYNC_API_URL;
const COUNCIL_API_KEY = process.env.COUNCIL_SYNC_API_KEY ?? process.env.NCZ_API_KEY;

/**
 * A2 — Contract validation schema for outbound payloads.
 */
export const SyncRecordSchema = z.object({
  learnerName: z.string().min(1),
  registrationNumber: z.string().min(1),
  councilIdentifier: z.string().min(1), // e.g. "NCZ"
  cycleYear: z.number().int(),
  pointsEarned: z.number(),
  activityReference: z.string(), // "Course Title" or "Activity Type"
  completedAt: z.string().datetime(),
  recordId: z.string(), // Local database ID for idempotency and audit
});

export type SyncRecord = z.infer<typeof SyncRecordSchema>;

export type SyncMode = 'live' | 'dry_run' | 'disabled';

export function getSyncMode(): SyncMode {
  if (process.env.COUNCIL_SYNC_ENABLED === 'false') return 'disabled';
  if (COUNCIL_API_URL && COUNCIL_API_KEY) return 'live';
  return 'dry_run';
}

export type RunNczSyncOptions = {
  onlyFailed?: boolean;
};

export async function runCouncilSync(
  triggeredBy: string = 'cron',
  options: RunNczSyncOptions = {},
): Promise<{ success: boolean; recordCount: number; mode: SyncMode; errorMessage?: string }> {
  const mode = getSyncMode();

  if (mode === 'disabled') {
    logger.info('Council sync is disabled by configuration');
    return { success: true, recordCount: 0, mode };
  }

  const unsyncedRecords = await db.cPDRecord.findMany({
    where: {
      syncedToNcz: false,
      ...(options.onlyFailed ? { nczSyncStatus: 'FAILED' } : {}),
    },
    include: {
      learner: {
        select: { fullName: true, nczRegistrationNumber: true, council: { select: { acronym: true } } },
      },
      course: { select: { accreditationBody: true, title: true } },
    },
    take: 100, // Process in smaller batches
  });

  if (unsyncedRecords.length === 0) {
    if (triggeredBy !== 'cron') {
      await db.nczSyncLog.create({
        data: { triggeredBy, recordCount: 0, success: true, dryRun: mode === 'dry_run', meta: { mode, sentIds: [], blockedIds: [] } },
      });
    }
    return { success: true, recordCount: 0, mode };
  }

  const payload: SyncRecord[] = [];
  const blockedIds: string[] = [];
  const invalidIds: string[] = [];

  for (const record of unsyncedRecords) {
    const councilAcronym = record.learner.council?.acronym ?? 'NCZ';
    const regNo = record.learner.nczRegistrationNumber;

    if (!regNo) {
      blockedIds.push(record.id);
      continue;
    }

    const rawData = {
      learnerName: record.learner.fullName,
      registrationNumber: regNo,
      councilIdentifier: councilAcronym,
      cycleYear: record.cycleYear,
      pointsEarned: record.pointsEarned,
      activityReference: record.course?.title ?? record.activityType,
      completedAt: record.completedAt.toISOString(),
      recordId: record.id,
    };

    const validation = SyncRecordSchema.safeParse(rawData);
    if (!validation.success) {
      logger.warn('Council sync record failed contract validation', { recordId: record.id, errors: validation.error.format() });
      invalidIds.push(record.id);
      continue;
    }

    payload.push(validation.data);
  }

  // Update blocked/invalid records immediately
  if (blockedIds.length) {
    await db.cPDRecord.updateMany({
      where: { id: { in: blockedIds } },
      data: { nczSyncStatus: 'BLOCKED_MISSING_NCZ' },
    });
  }
  if (invalidIds.length) {
    await db.cPDRecord.updateMany({
      where: { id: { in: invalidIds } },
      data: { nczSyncStatus: 'FAILED', nczLastError: 'Contract validation failed' },
    });
  }

  if (payload.length === 0) {
    await db.nczSyncLog.create({
      data: {
        triggeredBy,
        recordCount: 0,
        success: true,
        dryRun: mode === 'dry_run',
        meta: { mode, blockedIds, invalidIds },
        errorMessage: `Processed ${unsyncedRecords.length} records. Sent 0. Blocked: ${blockedIds.length}. Invalid: ${invalidIds.length}.`,
      },
    });
    return { success: true, recordCount: 0, mode };
  }

  const sentIds = payload.map((r) => r.recordId);

  try {
    let responseData: any = null;
    if (mode === 'live') {
      const res = await fetch(`${COUNCIL_API_URL}/cpd-records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': COUNCIL_API_KEY!,
          'X-Idempotency-Key': `batch-${Date.now()}`,
        },
        body: JSON.stringify({ records: payload }),
      });

      responseData = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(`Council API responded with ${res.status}: ${JSON.stringify(responseData)}`);
      }

      // Update records on success
      await db.cPDRecord.updateMany({
        where: { id: { in: sentIds } },
        data: {
          syncedToNcz: true,
          nczSyncedAt: new Date(),
          nczSyncStatus: 'SYNCED',
          nczLastError: null,
          nczSyncMetadata: responseData,
          nczIdempotencyKey: `batch-${Date.now()}`,
        },
      });
    } else {
      logger.info('Council sync dry run', { recordCount: payload.length });
    }

    await db.nczSyncLog.create({
      data: {
        triggeredBy,
        recordCount: payload.length,
        success: true,
        dryRun: mode === 'dry_run',
        meta: { mode, sentIds, blockedIds, invalidIds, response: responseData },
      },
    });

    return { success: true, recordCount: payload.length, mode };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (mode === 'live') {
      await db.cPDRecord.updateMany({
        where: { id: { in: sentIds } },
        data: { nczSyncStatus: 'FAILED', nczLastError: message, nczLastAttemptAt: new Date() },
      });
    }
    await db.nczSyncLog.create({
      data: {
        triggeredBy,
        recordCount: 0,
        success: false,
        dryRun: mode === 'dry_run',
        errorMessage: message,
        meta: { mode, sentIds, blockedIds, invalidIds },
      },
    });
    return { success: false, recordCount: 0, mode, errorMessage: message };
  }
}

export async function retryNczRecord(
  recordId: string,
  triggeredBy: string = 'manual',
): Promise<{ success: boolean; recordCount: number; mode: SyncMode; errorMessage?: string }> {
  const mode = getSyncMode();
  if (mode === 'disabled') return { success: false, recordCount: 0, mode, errorMessage: 'Sync is disabled' };

  const record = await db.cPDRecord.findUnique({
    where: { id: recordId },
    include: {
      learner: { select: { fullName: true, nczRegistrationNumber: true, council: { select: { acronym: true } } } },
      course: { select: { accreditationBody: true, title: true } },
    },
  });

  if (!record) return { success: false, recordCount: 0, mode, errorMessage: 'Record not found' };

  const regNo = record.learner.nczRegistrationNumber;
  if (!regNo) {
    await db.cPDRecord.update({ where: { id: recordId }, data: { nczSyncStatus: 'BLOCKED_MISSING_NCZ' } });
    return { success: false, recordCount: 0, mode, errorMessage: 'Blocked: missing registration number' };
  }

  const payload: SyncRecord = {
    learnerName: record.learner.fullName,
    registrationNumber: regNo,
    councilIdentifier: record.learner.council?.acronym ?? 'NCZ',
    cycleYear: record.cycleYear,
    pointsEarned: record.pointsEarned,
    activityReference: record.course?.title ?? record.activityType,
    completedAt: record.completedAt.toISOString(),
    recordId: record.id,
  };

  const validation = SyncRecordSchema.safeParse(payload);
  if (!validation.success) {
    await db.cPDRecord.update({ where: { id: recordId }, data: { nczSyncStatus: 'FAILED', nczLastError: 'Contract validation failed' } });
    return { success: false, recordCount: 0, mode, errorMessage: 'Validation failed' };
  }

  const idempotencyKey = `retry-${recordId}-${Date.now()}`;

  try {
    let responseData: any = null;
    if (mode === 'live') {
      const res = await fetch(`${COUNCIL_API_URL}/cpd-records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': COUNCIL_API_KEY!,
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ records: [validation.data] }),
      });

      responseData = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`Council API responded with ${res.status}: ${JSON.stringify(responseData)}`);

      await db.cPDRecord.update({
        where: { id: recordId },
        data: {
          syncedToNcz: true,
          nczSyncedAt: new Date(),
          nczSyncStatus: 'SYNCED',
          nczLastError: null,
          nczLastAttemptAt: new Date(),
          nczSyncMetadata: responseData,
          nczIdempotencyKey: idempotencyKey,
        },
      });
    }

    await db.nczSyncLog.create({
      data: {
        triggeredBy,
        recordCount: 1,
        success: true,
        dryRun: mode === 'dry_run',
        meta: { mode, sentIds: [recordId], response: responseData },
      },
    });

    return { success: true, recordCount: 1, mode };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (mode === 'live') {
      await db.cPDRecord.update({
        where: { id: recordId },
        data: { nczSyncStatus: 'FAILED', nczLastError: message, nczLastAttemptAt: new Date() },
      });
    }
    await db.nczSyncLog.create({
      data: {
        triggeredBy,
        recordCount: 0,
        success: false,
        dryRun: mode === 'dry_run',
        errorMessage: message,
        meta: { mode, sentIds: [recordId] },
      },
    });
    return { success: false, recordCount: 0, mode, errorMessage: message };
  }
}
