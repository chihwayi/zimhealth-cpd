import { db } from '../lib/db';
import { logger } from '../lib/logger';

const NCZ_API_URL = process.env.NCZ_SYNC_API_URL;
const NCZ_API_KEY = process.env.NCZ_API_KEY;

export interface SyncRecord {
  nczRegistrationNumber: string;
  fullName: string;
  pointsEarned: number;
  activityType: string;
  completedAt: string;
  cycleYear: number;
  courseReference?: string;
}

export async function runNczSync(
  triggeredBy: string = 'cron',
): Promise<{ success: boolean; recordCount: number; errorMessage?: string }> {
  const unsyncedRecords = await db.cPDRecord.findMany({
    where: { syncedToNcz: false },
    include: {
      learner: { select: { fullName: true, nczRegistrationNumber: true } },
      course: { select: { accreditationBody: true, title: true } },
    },
    take: 1000,
  });

  if (unsyncedRecords.length === 0) {
    await db.nczSyncLog.create({
      data: { triggeredBy, recordCount: 0, success: true },
    });
    return { success: true, recordCount: 0 };
  }

  const payload: SyncRecord[] = unsyncedRecords
    .filter((record) => record.learner.nczRegistrationNumber)
    .map((record) => ({
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
      data: { triggeredBy, recordCount: 0, success: true },
    });
    return { success: true, recordCount: 0 };
  }

  try {
    if (NCZ_API_URL && NCZ_API_KEY) {
      const res = await fetch(`${NCZ_API_URL}/cpd-records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': NCZ_API_KEY,
        },
        body: JSON.stringify({ records: payload }),
      });

      if (!res.ok) {
        throw new Error(`NCZ API responded with ${res.status}`);
      }
    } else {
      logger.info('NCZ sync dry run', { recordCount: payload.length });
    }

    await db.cPDRecord.updateMany({
      where: { id: { in: unsyncedRecords.map((record) => record.id) } },
      data: { syncedToNcz: true, nczSyncedAt: new Date() },
    });

    await db.nczSyncLog.create({
      data: { triggeredBy, recordCount: payload.length, success: true },
    });

    logger.info('NCZ sync complete', { recordCount: payload.length });
    return { success: true, recordCount: payload.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.nczSyncLog.create({
      data: { triggeredBy, recordCount: 0, success: false, errorMessage: message },
    });
    logger.error('NCZ sync failed', { error: message });
    return { success: false, recordCount: 0, errorMessage: message };
  }
}
