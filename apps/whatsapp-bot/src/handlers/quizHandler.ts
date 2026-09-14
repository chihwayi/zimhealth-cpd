import type { IncomingMessage } from '../botRouter';
import type { BotSession } from '../sessionManager';
import { saveSession } from '../sessionManager';
import { sendMessage } from '../whatsapp/transport';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const BOT_SECRET = process.env.BOT_SECRET ?? '';

function shaLike(input: string): string {
  // deterministic, URL-safe-ish attempt key without pulling crypto deps
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `k${(h >>> 0).toString(16)}`;
}

// ─── Static fallback quiz bank (used only when no module quiz is loaded) ──────
const QUIZ_BANK = [
  {
    id: 'q1',
    text: 'How many moments of hand hygiene does WHO recommend?',
    options: [
      { letter: 'A', text: '3' },
      { letter: 'B', text: '4' },
      { letter: 'C', text: '5' },
      { letter: 'D', text: '6' },
    ],
    correctLetter: 'C',
    explanation: 'WHO recommends 5 moments of hand hygiene.',
  },
  {
    id: 'q2',
    text: 'Standard precautions apply to which patients?',
    options: [
      { letter: 'A', text: 'Only infected patients' },
      { letter: 'B', text: 'Only surgical patients' },
      { letter: 'C', text: 'ICU patients only' },
      { letter: 'D', text: 'ALL patients' },
    ],
    correctLetter: 'D',
    explanation: 'Standard precautions apply to ALL patients regardless of infection status.',
  },
  {
    id: 'q3',
    text: 'EDLIZ is updated how often?',
    options: [
      { letter: 'A', text: 'Every year' },
      { letter: 'B', text: 'Every 2 years' },
      { letter: 'C', text: 'Every 3 years' },
      { letter: 'D', text: 'Every 5 years' },
    ],
    correctLetter: 'C',
    explanation: 'EDLIZ is updated every 3 years by the MOHCC.',
  },
];

function formatQuestion(
  q: { text: string; options: Array<{ letter: string; text: string }> },
  index: number,
  total: number,
): string {
  const opts = q.options.map((o) => `${o.letter}) ${o.text}`).join('\n');
  return `❓ *Question ${index + 1} of ${total}*\n\n${q.text}\n\n${opts}\n\n_Reply A, B, C, or D_`;
}

export async function handleQuiz(msg: IncomingMessage, session: BotSession): Promise<void> {
  const text = msg.body.trim().toUpperCase();

  // Initialize quiz state if not present (standalone micro-quiz from menu option 2)
  if (!session.quizState) {
    const questions = [...QUIZ_BANK].sort(() => 0.5 - Math.random()).slice(0, 3);
    session.quizState = {
      quizId: 'whatsapp-micro',
      quizSource: 'MICRO_QUIZ',
      questions,
      currentIndex: 0,
      answers: {},
      score: 0,
    };
    await saveSession(session);
    await sendMessage(msg.from, formatQuestion(questions[0], 0, questions.length));
    return;
  }

  const { quizState } = session;
  const questions = quizState.questions;
  const q = questions[quizState.currentIndex];

  if (!q) {
    // Corrupted state — reset
    delete session.quizState;
    session.state = 'MENU';
    await saveSession(session);
    await sendMessage(msg.from, 'Quiz session expired. Reply *menu* to start again.');
    return;
  }

  if (!['A', 'B', 'C', 'D', 'E'].includes(text)) {
    await sendMessage(msg.from, 'Please reply with A, B, C, or D.');
    return;
  }

  // Record answer
  quizState.answers[q.id] = text;
  const correctLetter = q.correctLetter ?? 'A';
  const isCorrect = text === correctLetter;
  if (isCorrect) quizState.score++;

  // Get explanation from static bank if this is a micro-quiz question
  const bankEntry = QUIZ_BANK.find((b) => b.id === q.id);
  const explanation = bankEntry?.explanation ?? '';
  const correctText = q.options.find((o) => o.letter === correctLetter)?.text ?? correctLetter;

  const feedback = isCorrect
    ? `✅ Correct!${explanation ? `\n\n_${explanation}_` : ''}`
    : `❌ Incorrect. The answer is *${correctLetter}) ${correctText}*.${explanation ? `\n\n_${explanation}_` : ''}`;

  quizState.currentIndex++;

  if (quizState.currentIndex >= questions.length) {
    // ── Quiz complete ──
    const score = quizState.score;
    const total = questions.length;
    const passed = score / total >= 0.7;
    const returnToLearning = quizState.returnToLearning ?? false;
    const moduleTitle = session.learningState?.moduleTitle;

    delete session.quizState;

    let resultMsg = `${feedback}\n\n📊 *Quiz Result*\nScore: ${score}/${total} (${Math.round((score / total) * 100)}%)\n\n`;

    const isModuleQuiz = quizState.quizSource === 'MODULE_QUIZ' && quizState.quizId !== 'whatsapp-micro';

    if (!isModuleQuiz) {
      resultMsg += passed
        ? `🎉 You passed!\n\nThis was a practice quiz (no CPD credit).`
        : `You need 70% to earn a CPD point. Keep practising!`;
    } else {
      // Report every completed module quiz attempt — pass or fail — so the
      // backend can enforce attemptLimit consistently with the web path.
      try {
        const phone = msg.from.replace('whatsapp:', '');
        const attemptKey = shaLike(
          `${phone}|${quizState.quizId}|${quizState.courseId ?? ''}|${quizState.moduleId ?? ''}|${score}/${total}`,
        );
        const res = await fetch(`${API_URL}/api/points/bot/credit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-bot-secret': BOT_SECRET },
          body: JSON.stringify({
            phone,
            quizId: quizState.quizId,
            courseId: quizState.courseId,
            moduleId: quizState.moduleId,
            attemptKey,
            quizScore: Math.round((score / total) * 100),
            passed,
            startedAt: quizState.startedAt ? new Date(quizState.startedAt).toISOString() : undefined,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as { pointsEarned?: number; error?: unknown };
        if (!res.ok) {
          if (typeof json.error === 'string' && json.error.includes('Attempt limit')) {
            resultMsg += passed
              ? `🎉 You passed, but you've used all your attempts for this quiz, so it can't be recorded.`
              : `You need 70% to earn a CPD point, and you've used all your attempts for this quiz.`;
          } else {
            throw new Error(typeof json.error === 'string' ? json.error : 'Credit failed');
          }
        } else if (passed) {
          const earned = typeof json.pointsEarned === 'number' ? json.pointsEarned : 0;
          if (earned > 0) {
            resultMsg += `🎉 You passed! *+${earned} CPD point${earned !== 1 ? 's' : ''}* awarded.`;
          } else {
            resultMsg += `🎉 You passed, but this quiz was already credited for this cycle.`;
          }
        } else {
          resultMsg += `You need 70% to earn a CPD point. Keep practising!`;
        }
      } catch {
        resultMsg += passed
          ? `🎉 You passed! (CPD credit could not be confirmed right now.)`
          : `You need 70% to earn a CPD point. Keep practising!`;
      }
    }

    if (returnToLearning) {
      session.state = 'LEARNING';
      resultMsg += `\n\nReply *back* to pick another module or *menu* for the main menu.`;
    } else {
      session.state = 'MENU';
      resultMsg += `\n\nReply *1* to study more or *menu* for options.`;
    }

    await saveSession(session);
    await sendMessage(msg.from, resultMsg);
    return;
  }

  // ── Send next question ──
  const next = questions[quizState.currentIndex];
  await saveSession(session);
  await sendMessage(
    msg.from,
    `${feedback}\n\n${formatQuestion(next, quizState.currentIndex, questions.length)}`,
  );
}
