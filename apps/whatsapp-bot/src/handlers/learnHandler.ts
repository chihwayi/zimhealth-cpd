import type { IncomingMessage } from '../botRouter';
import type { BotSession } from '../sessionManager';
import { saveSession } from '../sessionManager';
import { sendMessage } from '../twilio';

// Simple micro-lesson library (in production, fetch from backend API)
const MICRO_LESSONS = [
  {
    id: 'ml-001',
    title: 'Hand Hygiene — 5 Moments',
    content:
      `📚 *Lesson: The 5 Moments of Hand Hygiene*\n\n` +
      `The WHO identifies 5 critical moments:\n\n` +
      `1️⃣ *Before* patient contact\n` +
      `2️⃣ *Before* aseptic procedure\n` +
      `3️⃣ *After* exposure to body fluid risk\n` +
      `4️⃣ *After* patient contact\n` +
      `5️⃣ *After* contact with patient surroundings\n\n` +
      `Correct hand hygiene reduces HAI by up to 50%.\n\n` +
      `_Reply *quiz* to test yourself, or *menu* to go back._`,
  },
  {
    id: 'ml-002',
    title: 'EDLIZ — Essential Medicines',
    content:
      `📚 *Lesson: EDLIZ Essential Medicines*\n\n` +
      `The Essential Drugs List for Zimbabwe (EDLIZ) is updated every 3 years by MOHCC.\n\n` +
      `Key principles:\n` +
      `• Only use drugs listed in EDLIZ unless specialist-approved\n` +
      `• Follow standard treatment guidelines (STGs)\n` +
      `• Report adverse drug reactions to MCAZ\n\n` +
      `_Reply *quiz* to earn 1 CPD point, or *menu* to go back._`,
  },
];

export async function handleLearn(msg: IncomingMessage, session: BotSession): Promise<void> {
  const text = msg.body.trim().toLowerCase();

  if (text === 'quiz') {
    session.state = 'QUIZ';
    await saveSession(session);
    await sendMessage(msg.from, '📝 Starting quiz... type *menu* anytime to exit.');
    return;
  }

  // Deliver next lesson (cycle through by day)
  const lessonIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % MICRO_LESSONS.length;
  const lesson = MICRO_LESSONS[lessonIndex];
  await sendMessage(msg.from, lesson.content);
}

