import nodemailer from 'nodemailer';
import { logger } from './logger';

// Shared SMTP sender, dry-run-safe when no credentials are configured —
// same pattern used across the codebase for WhatsApp/SMS senders (see
// backend/src/jobs/notificationWorker.ts).
export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const smtpUrl = process.env.SMTP_URL;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUrl && !(smtpHost && smtpPort && smtpUser && smtpPass)) {
    logger.info('[email] Dry run - SMTP not configured', { to, subject });
    return;
  }

  const transporter = smtpUrl
    ? nodemailer.createTransport(smtpUrl)
    : nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

  const from =
    process.env.MAIL_FROM ??
    (process.env.FROM_EMAIL ? `ZimHealth CPD <${process.env.FROM_EMAIL}>` : undefined) ??
    'ZimHealth CPD <no-reply@example.com>';

  await transporter.sendMail({ from, to, subject, text });
}

// WhatsApp-bot placeholder emails look like wa_<digits>@zimhealth.internal —
// not a real inbox, so skip sending to them rather than let it silently fail.
export function isRealEmail(email: string): boolean {
  return !email.endsWith('@zimhealth.internal');
}
