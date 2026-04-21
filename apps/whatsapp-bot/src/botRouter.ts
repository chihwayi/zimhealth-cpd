import { getSession, saveSession } from './sessionManager';
import type { BotSession } from './sessionManager';
import { sendMessage } from './twilio';
import { TEMPLATES } from './templates';
import { handleMenu } from './handlers/menuHandler';
import { handleLearn } from './handlers/learnHandler';
import { handleQuiz } from './handlers/quizHandler';
import { handlePoints } from './handlers/pointsHandler';
import { handleAiTutor } from './handlers/aiTutor';
import { handlePayment } from './handlers/paymentHandler';
import { handleRegistration } from './handlers/registrationHandler';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const BOT_SECRET = process.env.BOT_SECRET ?? '';

export interface IncomingMessage {
  from: string; // "whatsapp:+263771234567"
  body: string; // raw message text
  profileName?: string;
}

// ─── Silently populate session.userId for returning users ────────────────────
async function ensureUserId(phone: string, session: BotSession): Promise<void> {
  if (session.userId) return; // already loaded
  try {
    const res = await fetch(`${API_URL}/api/bot/lookup?phone=${encodeURIComponent(phone)}`, {
      headers: { 'x-bot-secret': BOT_SECRET },
    });
    if (res.ok) {
      const data = await res.json() as { id: string };
      session.userId = data.id;
    }
  } catch {
    // Silently ignore — network error shouldn't block the bot
  }
}

export async function routeMessage(msg: IncomingMessage): Promise<void> {
  const phone = msg.from.replace('whatsapp:', '');
  const text = msg.body.trim().toLowerCase();
  const session = await getSession(phone);

  // Silently resolve userId for known users on every session (cached in Redis 24h)
  await ensureUserId(phone, session);

  // Global commands — work from any state
  if (['menu', 'hi', 'hello', 'start', '0'].includes(text)) {
    delete session.registrationState;
    session.state = 'MENU';
    await saveSession(session);
    await sendMessage(msg.from, TEMPLATES.MAIN_MENU);
    return;
  }

  if (text === 'stop') {
    await sendMessage(msg.from, "You've paused NursePro notifications. Reply *START* to resume.");
    return;
  }

  if (text === 'points') {
    await handlePoints(msg, session);
    return;
  }

  if (text === 'cert') {
    const webUrl = process.env.WEB_URL ?? 'https://nursepro.co.zw';
    await sendMessage(msg.from, `Visit ${webUrl}/certificates to download your certificate.`);
    return;
  }

  if (text === 'help') {
    await sendMessage(msg.from, TEMPLATES.HELP);
    return;
  }

  if (text === 'upgrade' || text === 'subscribe' || text === 'payment') {
    session.state = 'PAYMENT';
    await saveSession(session);
    await handlePayment(msg, session);
    return;
  }

  // WhatsApp registration command — works from any state
  if (text === 'reg' || text === 'register') {
    if (session.userId) {
      await sendMessage(
        msg.from,
        `✅ You already have a NursePro account. Reply *menu* to access your learning.`,
      );
      return;
    }
    delete session.registrationState; // reset to start fresh
    await handleRegistration(msg, session);
    return;
  }

  // State-based routing
  switch (session.state) {
    case 'AWAITING_REGISTRATION':
      await handleRegistration(msg, session);
      break;
    case 'QUIZ':
      await handleQuiz(msg, session);
      break;
    case 'AI_TUTOR':
      await handleAiTutor(msg, session);
      break;
    case 'LEARNING':
      await handleLearn(msg, session);
      break;
    case 'PAYMENT':
      await handlePayment(msg, session);
      break;
    default:
      // If user is not registered and tries to access the menu, prompt them to register
      if (!session.userId && !['2', '4', '6'].includes(msg.body.trim())) {
        // Options 2 (AI tutor), 4 (is for AI tutor in menu), 6 (help) are free; rest require account
        // Actually menu '4' is AI tutor — let that through
        // For learning (1), points (3), subscribe (5): require account
        if (['1', '3', '5'].includes(msg.body.trim())) {
          await sendMessage(msg.from, TEMPLATES.NOT_REGISTERED);
          return;
        }
      }
      await handleMenu(msg, session);
  }
}
