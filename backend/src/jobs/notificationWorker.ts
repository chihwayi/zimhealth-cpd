import Bull from 'bull';
import { db } from '../lib/db';
import { getLearnerCPDSummary } from '../services/cpd-engine';
import { AIClient, SYSTEM_PROMPTS, type AIProviderConfig } from '@zimhealth/ai-client';
import { logger } from '../lib/logger';

export const notificationQueue = new Bull('notifications', {
  redis: process.env.REDIS_URL ?? 'redis://localhost:6379',
});

function buildAiConfig(): AIProviderConfig {
  return {
    anthropic: process.env.ANTHROPIC_API_KEY
      ? {
          apiKey: process.env.ANTHROPIC_API_KEY,
          defaultModel: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
        }
      : undefined,
    openai: process.env.OPENAI_API_KEY
      ? {
          apiKey: process.env.OPENAI_API_KEY,
          defaultModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
          baseUrl: process.env.OPENAI_BASE_URL || undefined,
        }
      : undefined,
    gemini: process.env.GEMINI_API_KEY
      ? {
          apiKey: process.env.GEMINI_API_KEY,
          defaultModel: process.env.GEMINI_MODEL ?? 'gemini-1.5-pro',
        }
      : undefined,
    ollama: process.env.OLLAMA_BASE_URL
      ? {
          baseUrl: process.env.OLLAMA_BASE_URL,
          defaultModel: process.env.OLLAMA_MODEL ?? 'llama3',
        }
      : undefined,
  };
}

notificationQueue.process('renewal-reminder', async () => {
  const today = new Date();
  const yearEnd = new Date(today.getFullYear(), 11, 31);
  const daysLeft = Math.ceil((yearEnd.getTime() - today.getTime()) / 86400000);
  const reminderDays = [90, 60, 30, 7];

  if (!reminderDays.includes(daysLeft)) {
    return { skipped: true, daysLeft };
  }

  const learners = await db.user.findMany({
    where: { role: 'LEARNER', isActive: true, phone: { not: null } },
    select: { id: true, fullName: true, phone: true, cadre: true },
  });

  let sent = 0;
  const ai = new AIClient(buildAiConfig());

  for (const learner of learners.slice(0, 100)) {
    try {
      const summary = await getLearnerCPDSummary(learner.id);
      if (summary.percentComplete >= 100) continue;

      const pointsNeeded = Math.max(0, summary.requiredPoints - summary.totalPoints);
      const prompt = `Write a WhatsApp reminder message for this health professional:
Name: ${learner.fullName.split(' ')[0]}
Days until CPD renewal deadline: ${daysLeft}
CPD points still needed: ${pointsNeeded}
Under 80 words. Warm and motivating. End with "Reply 1 to start learning."`;

      const message = await ai.complete(prompt, {
        systemPrompt: SYSTEM_PROMPTS.REMINDER_WRITER,
        maxTokens: 150,
        temperature: 0.7,
      });

      logger.info('Reminder (dry run)', { to: learner.phone, message });
      sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('Failed to send reminder', { learnerId: learner.id, error: message });
    }
  }

  return { sent, daysLeft };
});

export async function scheduleRenewalReminders(): Promise<void> {
  const repeatableJobs = await notificationQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.name === 'renewal-reminder') {
      await notificationQueue.removeRepeatableByKey(job.key);
    }
  }

  await notificationQueue.add('renewal-reminder', {}, { repeat: { cron: '0 8 * * *' }, removeOnComplete: 10 });
  logger.info('Renewal reminders scheduled (daily 8am)');
}
