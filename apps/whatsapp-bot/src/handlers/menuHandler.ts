import type { IncomingMessage } from '../botRouter';
import type { BotSession } from '../sessionManager';
import { saveSession } from '../sessionManager';
import { sendMessage } from '../twilio';
import { TEMPLATES } from '../templates';
import { handleLearn } from './learnHandler';
import { handlePoints } from './pointsHandler';
import { handleAiTutor } from './aiTutor';
import { handlePayment } from './paymentHandler';

export async function handleMenu(msg: IncomingMessage, session: BotSession): Promise<void> {
  const text = msg.body.trim();

  switch (text) {
    case '1':
      session.state = 'LEARNING';
      await saveSession(session);
      await handleLearn(msg, session);
      break;
    case '2':
      session.state = 'QUIZ';
      await saveSession(session);
      await sendMessage(
        msg.from,
        '📝 Starting a quiz... Reply with the letter of your answer.\n\nType *menu* anytime to go back.',
      );
      break;
    case '3':
      await handlePoints(msg, session);
      break;
    case '4':
      session.state = 'AI_TUTOR';
      await saveSession(session);
      await sendMessage(
        msg.from,
        '🤖 *AI Clinical Tutor*\n\nAsk me any clinical question — drug doses, procedures, protocols, or guidelines.\n\nType your question now:',
      );
      break;
    case '5':
      session.state = 'PAYMENT';
      await saveSession(session);
      await handlePayment(msg, session);
      break;
    case '6':
      await sendMessage(msg.from, TEMPLATES.HELP);
      break;
    default:
      await sendMessage(msg.from, TEMPLATES.MAIN_MENU);
  }
}

