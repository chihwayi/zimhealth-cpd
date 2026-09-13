import Bull from 'bull';
import { db } from '../lib/db';
import { getLearnerCPDSummary } from '../services/cpd-engine';
import { AIClient, SYSTEM_PROMPTS, type AIProviderConfig } from '@zimhealth/ai-client';
import { logger } from '../lib/logger';
import { sendEmail, isRealEmail } from '../lib/email';
import twilio from 'twilio';

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

async function sendWhatsAppMessage(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_NUMBER;
  const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  if (!sid || !token || !from) {
    logger.info('[notificationWorker] Reminder dry run - no Twilio credentials', {
      to: toFormatted,
      body,
    });
    return;
  }

  const client = twilio(sid, token);
  await client.messages.create({ from, to: toFormatted, body });
}

async function sendSmsMessage(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_SMS_FROM;

  if (!sid || !token || !from) {
    logger.info('[notificationWorker] SMS reminder dry run - no Twilio SMS credentials', { to, body });
    return;
  }

  const client = twilio(sid, token);
  await client.messages.create({ from, to, body });
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
    where: { role: 'LEARNER', isActive: true },
    select: { id: true, fullName: true, phone: true, email: true, cadre: true },
  });

  let sent = 0;
  const ai = new AIClient(buildAiConfig());

  for (const learner of learners.slice(0, 100)) {
    try {
      const summary = await getLearnerCPDSummary(learner.id);
      if (summary.percentComplete >= 100) continue;

      const pointsNeeded = Math.max(0, summary.requiredPoints - summary.totalPoints);
      const firstName = learner.fullName.split(' ')[0];
      const prompt = `Write a short reminder message for this health professional:
Name: ${firstName}
Days until CPD renewal deadline: ${daysLeft}
CPD points still needed: ${pointsNeeded}
Under 80 words. Warm and motivating. End with "Reply 1 to start learning." (or, for email, "Log in to start learning.")`;

      const message = await ai.complete(prompt, {
        systemPrompt: SYSTEM_PROMPTS.REMINDER_WRITER,
        maxTokens: 150,
        temperature: 0.7,
      });

      const channelResults: Record<string, 'sent' | 'failed' | 'skipped'> = {};

      if (learner.phone) {
        try {
          await sendWhatsAppMessage(learner.phone, message);
          channelResults.whatsapp = 'sent';
        } catch (err) {
          channelResults.whatsapp = 'failed';
          logger.warn('Reminder WhatsApp send failed', { learnerId: learner.id, error: String(err) });
        }

        try {
          await sendSmsMessage(learner.phone, message);
          channelResults.sms = 'sent';
        } catch (err) {
          channelResults.sms = 'failed';
          logger.warn('Reminder SMS send failed', { learnerId: learner.id, error: String(err) });
        }
      } else {
        channelResults.whatsapp = 'skipped';
        channelResults.sms = 'skipped';
      }

      if (isRealEmail(learner.email)) {
        try {
          await sendEmail(learner.email, `Your CPD renewal is in ${daysLeft} days`, message.replace('Reply 1 to start learning.', 'Log in to start learning.'));
          channelResults.email = 'sent';
        } catch (err) {
          channelResults.email = 'failed';
          logger.warn('Reminder email send failed', { learnerId: learner.id, error: String(err) });
        }
      } else {
        channelResults.email = 'skipped';
      }

      await db.auditLog.create({
        data: {
          userId: learner.id,
          action: 'RENEWAL_REMINDER_SENT',
          entityType: 'User',
          entityId: learner.id,
          meta: { daysLeft, pointsNeeded, ...channelResults },
        },
      });

      if (Object.values(channelResults).includes('sent')) sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('Failed to send reminder', { learnerId: learner.id, error: message });
    }
  }

  return { sent, skipped: learners.length - sent, daysLeft };
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
