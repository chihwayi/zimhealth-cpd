import Bull from 'bull';
import { runNczSync } from '../services/ncz-sync';
import { logger } from '../lib/logger';

export const syncQueue = new Bull('ncz-sync', {
  redis: process.env.REDIS_URL ?? 'redis://localhost:6379',
});

syncQueue.process('run-sync', async (job) => {
  const { triggeredBy } = job.data as { triggeredBy?: string };
  logger.info('Running council sync', { triggeredBy: triggeredBy ?? 'cron' });
  return runNczSync(triggeredBy ?? 'cron');
});

const schedule = process.env.COUNCIL_SYNC_SCHEDULE ?? process.env.NCZ_SYNC_SCHEDULE ?? '0 2 * * *';

export async function scheduleDailySync(): Promise<void> {
  const repeatableJobs = await syncQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await syncQueue.removeRepeatableByKey(job.key);
  }

  await syncQueue.add(
    'run-sync',
    { triggeredBy: 'cron' },
    { repeat: { cron: schedule }, removeOnComplete: 50 },
  );

  logger.info('Council daily sync scheduled', { schedule });
}

syncQueue.on('failed', (job, err) => {
  logger.error('Council sync job failed', { jobId: job.id, err: err.message });
});
