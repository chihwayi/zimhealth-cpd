import type { IncomingMessage } from '../botRouter';
import type { BotSession } from '../sessionManager';
import { saveSession } from '../sessionManager';
import { sendMessage } from '../twilio';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const BOT_SECRET = process.env.BOT_SECRET ?? '';

// Static micro-quiz bank (production: fetch from backend)
const QUIZ_BANK = [
  {
    id: 'q1',
    text: 'How many moments of hand hygiene does WHO recommend?',
    options: ['A) 3', 'B) 4', 'C) 5', 'D) 6'],
    correct: 'C',
    explanation: 'WHO recommends 5 moments of hand hygiene.',
  },
  {
    id: 'q2',
    text: 'Standard precautions apply to which patients?',
    options: ['A) Only infected patients', 'B) Only surgical patients', 'C) ICU patients only', 'D) ALL patients'],
    correct: 'D',
    explanation: 'Standard precautions apply to ALL patients regardless of infection status.',
  },
  {
    id: 'q3',
    text: 'EDLIZ is updated how often?',
    options: ['A) Every year', 'B) Every 2 years', 'C) Every 3 years', 'D) Every 5 years'],
    correct: 'C',
    explanation: 'EDLIZ is updated every 3 years by the MOHCC.',
  },
];

function formatQuestion(q: (typeof QUIZ_BANK)[number], index: number, total: number): string {
  return `❓ *Question ${index + 1} of ${total}*\n\n${q.text}\n\n${q.options.join('\n')}\n\n_Reply A, B, C, or D_`;
}

export async function handleQuiz(msg: IncomingMessage, session: BotSession): Promise<void> {
  const text = msg.body.trim().toUpperCase();

  if (!session.quizState) {
    const questions = [...QUIZ_BANK].sort(() => 0.5 - Math.random()).slice(0, 3);
    session.quizState = {
      quizId: 'whatsapp-micro',
      questions: questions.map((q) => ({
        id: q.id,
        text: q.text,
        options: q.options.map((t, idx) => ({ id: `${q.id}:${idx}`, text: t })),
        correctId: q.correct,
      })),
      currentIndex: 0,
      answers: {},
      score: 0,
    };
    await saveSession(session);
    await sendMessage(msg.from, formatQuestion(questions[0], 0, questions.length));
    return;
  }

  const quizQuestions = session.quizState.questions.map((q) => ({
    ...q,
    correct: QUIZ_BANK.find((b) => b.id === q.id)?.correct ?? 'A',
    explanation: QUIZ_BANK.find((b) => b.id === q.id)?.explanation ?? '',
  }));

  const q = quizQuestions[session.quizState.currentIndex];
  if (!q) {
    delete session.quizState;
    session.state = 'MENU';
    await saveSession(session);
    await sendMessage(msg.from, 'Quiz session expired. Reply *menu* to start again.');
    return;
  }

  if (!['A', 'B', 'C', 'D'].includes(text)) {
    await sendMessage(msg.from, 'Please reply with A, B, C, or D.');
    return;
  }

  session.quizState.answers[q.id] = text;
  const isCorrect = text === q.correct;
  if (isCorrect) session.quizState.score++;

  const feedback = isCorrect
    ? `✅ Correct!\n\n_${q.explanation}_`
    : `❌ Incorrect. The answer is *${q.correct}*.\n\n_${q.explanation}_`;

  session.quizState.currentIndex++;

  if (session.quizState.currentIndex >= quizQuestions.length) {
    const score = session.quizState.score;
    const total = quizQuestions.length;
    const passed = score >= Math.ceil(total * 0.7);

    delete session.quizState;
    session.state = 'MENU';
    await saveSession(session);

    let resultMsg = `${feedback}\n\n`;
    resultMsg += `📊 *Quiz Result*\n`;
    resultMsg += `Score: ${score}/${total}\n\n`;

    if (passed) {
      try {
        await fetch(`${API_URL}/api/points/bot/credit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-bot-secret': BOT_SECRET },
          body: JSON.stringify({ phone: msg.from.replace('whatsapp:', ''), quizScore: score / total }),
        });
        resultMsg += `🎉 You passed! *+1 CPD point* awarded.\n\nReply *menu* for more options.`;
      } catch {
        resultMsg += `🎉 You passed! Reply *menu* for more options.`;
      }
    } else {
      resultMsg += `You need 70% to earn a CPD point. Keep learning!\n\nReply *1* to study more.`;
    }

    await sendMessage(msg.from, resultMsg);
    return;
  }

  const next = quizQuestions[session.quizState.currentIndex];
  await saveSession(session);
  const nextBank = QUIZ_BANK.find((b) => b.id === next.id) ?? QUIZ_BANK[0];
  await sendMessage(
    msg.from,
    `${feedback}\n\n${formatQuestion(nextBank, session.quizState.currentIndex, quizQuestions.length)}`,
  );
}

