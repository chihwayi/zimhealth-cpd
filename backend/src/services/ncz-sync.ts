import { db } from '../lib/db';
import { logger } from '../lib/logger';

const COUNCIL_API_URL = process.env.COUNCIL_SYNC_API_URL ?? process.env.NCZ_SYNC_API_URL;
const COUNCIL_API_KEY = process.env.COUNCIL_SYNC_API_KEY ?? process.env.NCZ_API_KEY;

export interface SyncRecord {
  nczRegistrationNumber: string;
  fullName: string;
  pointsEarned: number;
  activityType: string;
  completedAt: string;
  cycleYear: number;
  courseReference?: string;
}

export type RunNczSyncOptions = {
  onlyFailed?: boolean;
};

export async function runNczSync(
  triggeredBy: string = 'cron',
  options: RunNczSyncOptions = {},
): Promise<{ success: boolean; recordCount: number; errorMessage?: string }> {
  const unsyncedRecords = await db.cPDRecord.findMany({
    where: {
      syncedToNcz: false,
      ...(options.onlyFailed ? { nczSyncStatus: 'FAILED' } : {}),
    },
    include: {
      learner: { select: { fullName: true, nczRegistrationNumber: true } },
      course: { select: { accreditationBody: true, title: true } },
    },
    take: 1000,
  });

  const isDryRun = !(COUNCIL_API_URL && COUNCIL_API_KEY);

  if (unsyncedRecords.length === 0) {
    await db.nczSyncLog.create({
      data: { triggeredBy, recordCount: 0, success: true, dryRun: isDryRun, meta: { sentIds: [], blockedIds: [] } },
    });
    return { success: true, recordCount: 0 };
  }

  const sendable = unsyncedRecords.filter((record) => record.learner.nczRegistrationNumber);
  const blocked = unsyncedRecords.filter((record) => !record.learner.nczRegistrationNumber);
  const blockedIds = blocked.map((r) => r.id);
  const sentIds = sendable.map((r) => r.id);

  const payload: SyncRecord[] = sendable.map((record) => ({
    nczRegistrationNumber: record.learner.nczRegistrationNumber!,
    fullName: record.learner.fullName,
    pointsEarned: record.pointsEarned,
    activityType: record.activityType,
    completedAt: record.completedAt.toISOString(),
    cycleYear: record.cycleYear,
    courseReference: record.course?.accreditationBody
      ? `${record.course.accreditationBody}: ${record.course.title}`
      : undefined,
  }));

  if (payload.length === 0) {
    await db.nczSyncLog.create({
      data: {
        triggeredBy,
        recordCount: 0,
        success: true,
        dryRun: isDryRun,
        errorMessage: blocked.length ? `Blocked: ${blocked.length} (missing council registration number)` : undefined,
        meta: { sentIds: [], blockedIds },
      },
    });
    return { success: true, recordCount: 0 };
  }

  try {
    if (!isDryRun) {
      const res = await fetch(`${COUNCIL_API_URL}/cpd-records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': COUNCIL_API_KEY,
        },
        body: JSON.stringify({ records: payload }),
      });

      if (!res.ok) {
        throw new Error(`Council API responded with ${res.status}`);
      }
    } else {
      logger.info('Council sync dry run', { recordCount: payload.length });
    }

    // Update blocked records so operators can see them clearly.
    if (!isDryRun && blockedIds.length) {
      await db.cPDRecord.updateMany({
        where: { id: { in: blockedIds } },
        data: { nczSyncStatus: 'BLOCKED_MISSING_NCZ' },
      });
    }

    // Only mutate sync state on real runs, and only for records that were actually sent.
    if (!isDryRun) {
      await db.cPDRecord.updateMany({
        where: { id: { in: sentIds } },
        data: { syncedToNcz: true, nczSyncedAt: new Date(), nczSyncStatus: 'SYNCED', nczLastError: null },
      });
    }

    await db.nczSyncLog.create({
      data: {
        triggeredBy,
        recordCount: payload.length,
        success: true,
        dryRun: isDryRun,
        errorMessage: blocked.length ? `Blocked: ${blocked.length} (missing council registration number)` : undefined,
        meta: { sentIds, blockedIds },
      },
    });

    logger.info('Council sync complete', { recordCount: payload.length });
    return { success: true, recordCount: payload.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Mark sendable records as FAILED only on real runs; dry run should not mutate state.
    if (!isDryRun && sentIds.length) {
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
        dryRun: isDryRun,
        errorMessage: message,
        meta: { sentIds, blockedIds },
      },
    });
    logger.error('Council sync failed', { error: message });
    return { success: false, recordCount: 0, errorMessage: message };
  }
}

export async function retryNczRecord(
  recordId: string,
  triggeredBy: string = 'manual',
): Promise<{ success: boolean; recordCount: number; errorMessage?: string }> {
  const record = await db.cPDRecord.findUnique({
    where: { id: recordId },
    include: {
      learner: { select: { fullName: true, nczRegistrationNumber: true } },
      course: { select: { accreditationBody: true, title: true } },
    },
  });
  if (!record) return { success: false, recordCount: 0, errorMessage: 'Record not found' };

  const isDryRun = !(COUNCIL_API_URL && COUNCIL_API_KEY);

  if (!record.learner.nczRegistrationNumber) {
    if (!isDryRun) {
      await db.cPDRecord.update({
        where: { id: recordId },
        data: { nczSyncStatus: 'BLOCKED_MISSING_NCZ' },
      });
    }
    return { success: false, recordCount: 0, errorMessage: 'Blocked: missing council registration number' };
  }

  const payload: SyncRecord[] = [
    {
      nczRegistrationNumber: record.learner.nczRegistrationNumber,
      fullName: record.learner.fullName,
      pointsEarned: record.pointsEarned,
      activityType: record.activityType,
      completedAt: record.completedAt.toISOString(),
      cycleYear: record.cycleYear,
      courseReference: record.course?.accreditationBody
        ? `${record.course.accreditationBody}: ${record.course.title}`
        : undefined,
    },
  ];

  try {
    if (!isDryRun) {
      const res = await fetch(`${COUNCIL_API_URL}/cpd-records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': COUNCIL_API_KEY!,
        },
        body: JSON.stringify({ records: payload }),
      });

      if (!res.ok) throw new Error(`Council API responded with ${res.status}`);

      await db.cPDRecord.update({
        where: { id: recordId },
        data: {
          syncedToNcz: true,
          nczSyncedAt: new Date(),
          nczSyncStatus: 'SYNCED',
          nczLastError: null,
          nczLastAttemptAt: new Date(),
        },
      });
    } else {
      logger.info('Council sync dry run (single record)', { recordId });
    }

    await db.nczSyncLog.create({
      data: {
        triggeredBy,
        recordCount: 1,
        success: true,
        dryRun: isDryRun,
        meta: { sentIds: [recordId], blockedIds: [] },
      },
    });

    return { success: true, recordCount: 1 };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!isDryRun) {
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
        dryRun: isDryRun,
        errorMessage: message,
        meta: { sentIds: [recordId], blockedIds: [] },
      },
    });
    return { success: false, recordCount: 0, errorMessage: message };
  }
}
