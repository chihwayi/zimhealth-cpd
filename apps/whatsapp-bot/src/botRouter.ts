import { getSession, saveSession } from './sessionManager';
import { sendMessage } from './twilio';
import { TEMPLATES } from './templates';
import { handleMenu } from './handlers/menuHandler';
import { handleLearn } from './handlers/learnHandler';
import { handleQuiz } from './handlers/quizHandler';
import { handlePoints } from './handlers/pointsHandler';
import { handleAiTutor } from './handlers/aiTutor';
import { handlePayment } from './handlers/paymentHandler';

export interface IncomingMessage {
  from: string; // "whatsapp:+263771234567"
  body: string; // raw message text
  profileName?: string;
}

export async function routeMessage(msg: IncomingMessage): Promise<void> {
  const phone = msg.from.replace('whatsapp:', '');
  const text = msg.body.trim().toLowerCase();
  const session = await getSession(phone);

  // Global commands — work from any state
  if (['menu', 'hi', 'hello', 'start', '0'].includes(text)) {
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

  // State-based routing
  switch (session.state) {
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
      await handleMenu(msg, session);
  }
}

