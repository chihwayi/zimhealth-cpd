import type { IncomingMessage } from '../botRouter';
import type { BotSession } from '../sessionManager';
import { sendMessage } from '../twilio';

const WEB_URL = process.env.WEB_URL ?? 'https://nursepro.co.zw';
const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const BOT_SECRET = process.env.BOT_SECRET ?? '';

export async function handlePayment(msg: IncomingMessage, _session: BotSession): Promise<void> {
  const phone = msg.from.replace('whatsapp:', '');
  // Best-effort analytics: measure upgrade CTA opens (Sprint 27).
  void fetch(`${API_URL}/api/bot/analytics/ai-tutor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-bot-secret': BOT_SECRET },
    body: JSON.stringify({ phone, event: 'UPGRADE_CTA', success: true }),
  }).catch(() => null);

  await sendMessage(
    msg.from,
    `*NursePro CPD Plans*\n\n` +
      `🆓 *Free* — WhatsApp only, up to 12 pts/year\n` +
      `⭐ *Standard* — $5/year, unlock web library + certificates + AI Tutor\n` +
      `🌍 *Diaspora* — $15/year, full library\n\n` +
      `To upgrade, visit:\n${WEB_URL}/subscription\n\n` +
      `Type *menu* anytime to go back.`,
  );
}

