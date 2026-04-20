import type { IncomingMessage } from '../botRouter';
import type { BotSession } from '../sessionManager';
import { sendMessage } from '../twilio';

const WEB_URL = process.env.WEB_URL ?? 'https://nursepro.co.zw';

export async function handlePayment(msg: IncomingMessage, _session: BotSession): Promise<void> {
  await sendMessage(
    msg.from,
    `*NursePro CPD Plans*\n\n` +
      `🆓 *Free* — WhatsApp only, up to 12 pts/year\n` +
      `⭐ *Standard* — $5/year, full course library\n` +
      `🌍 *Diaspora* — $15/year, full library\n\n` +
      `To upgrade, visit:\n${WEB_URL}/subscription\n\n` +
      `Type *menu* anytime to go back.`,
  );
}

