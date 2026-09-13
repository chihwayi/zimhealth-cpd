import type { IncomingMessage } from '../botRouter';
import type { BotSession } from '../sessionManager';
import { saveSession } from '../sessionManager';
import { sendMessage } from '../whatsapp/transport';
import { TEMPLATES } from '../templates';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const BOT_SECRET = process.env.BOT_SECRET ?? '';

export async function handleReportIssue(msg: IncomingMessage, session: BotSession): Promise<void> {
  const text = msg.body.trim();
  const lower = text.toLowerCase();

  if (['menu', 'cancel', 'exit'].includes(lower)) {
    session.state = 'MENU';
    await saveSession(session);
    await sendMessage(msg.from, TEMPLATES.MAIN_MENU);
    return;
  }

  if (text.length < 10) {
    await sendMessage(
      msg.from,
      `Please describe the issue in a bit more detail (at least 10 characters), or reply *cancel* to go back.`,
    );
    return;
  }

  try {
    const phone = msg.from.replace('whatsapp:', '');
    const res = await fetch(`${API_URL}/api/bot/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bot-secret': BOT_SECRET },
      body: JSON.stringify({
        phone,
        title: text.slice(0, 80),
        description: text,
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);

    session.state = 'MENU';
    await saveSession(session);
    await sendMessage(
      msg.from,
      `✅ Thanks — your issue has been logged and our support team will look into it.\n\n${TEMPLATES.MAIN_MENU}`,
    );
  } catch {
    await sendMessage(
      msg.from,
      `⚠️ Couldn't submit your report right now. Please try again, or email support directly.\n\nReply *cancel* to go back to the menu.`,
    );
  }
}
