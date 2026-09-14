import type { IncomingMessage } from '../botRouter';
import type { BotSession } from '../sessionManager';
import { sendMessage } from '../whatsapp/transport';
import { TEMPLATES } from '../templates';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const BOT_SECRET = process.env.BOT_SECRET ?? '';

export async function handlePoints(msg: IncomingMessage, session: BotSession): Promise<void> {
  if (!session.userId) {
    await sendMessage(msg.from, TEMPLATES.NOT_REGISTERED);
    return;
  }

  try {
    const phone = msg.from.replace('whatsapp:', '');
    const res = await fetch(`${API_URL}/api/points/bot/${encodeURIComponent(phone)}`, {
      headers: { 'x-bot-secret': BOT_SECRET },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `API error ${res.status}`);
    }
    const data: any = await res.json();
    const deadline = `Dec 31, ${data.cycleYear}`;
    await sendMessage(msg.from, TEMPLATES.POINTS(data.totalPoints, data.requiredPoints, deadline, data.currentStreak));
  } catch {
    await sendMessage(msg.from, 'Could not fetch your points right now. Please try again later.');
  }
}

