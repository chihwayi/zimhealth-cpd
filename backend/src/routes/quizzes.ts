import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { db } from '../lib/db';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { SubmitQuizAttemptSchema } from './quizzes.schema';
import { creditPoints } from '../services/cpd-engine';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const router: ExpressRouter = Router();

// GET /api/quizzes/:id — fetch quiz with questions (randomized if configured)
router.get('/:id', requireAuth, requireRole('LEARNER'), async (req: AuthRequest, res) => {
  try {
    const quiz = await db.quiz.findUnique({
      where: { id: req.params.id },
      include: {
        questions: {
          orderBy: { createdAt: 'asc' },
          include: { options: { orderBy: { id: 'asc' } } },
        },
      },
    });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    const attemptCount = await db.quizAttempt.count({
      where: { learnerId: req.user!.id, quizId: quiz.id },
    });
    const attemptsRemaining = Math.max(0, quiz.attemptLimit - attemptCount);

    const questions = quiz.randomiseQuestions ? shuffle(quiz.questions) : quiz.questions;

    // Do not leak correct answers to client
    const safeQuiz = {
      id: quiz.id,
      title: quiz.title,
      passMark: quiz.passMark,
      attemptLimit: quiz.attemptLimit,
      timeLimitMinutes: quiz.timeLimitMinutes,
      randomiseQuestions: quiz.randomiseQuestions,
      showAnswersAfter: quiz.showAnswersAfter,
      attemptsRemaining,
      questions: questions.map((q) => ({
        id: q.id,
        type: q.type,
        text: q.text,
        imageUrl: q.imageUrl,
        points: q.points,
        options: q.options.map((o) => ({ id: o.id, text: o.text })),
      })),
    };

    res.json(safeQuiz);
  } catch {
    res.status(500).json({ error: 'Could not fetch quiz' });
  }
});

// POST /api/quizzes/:id/attempt — submit answers, calculate score, credit points if passed
router.post('/:id/attempt', requireAuth, requireRole('LEARNER'), async (req: AuthRequest, res) => {
  try {
    const { answers } = SubmitQuizAttemptSchema.parse(req.body);

    const quiz = await db.quiz.findUnique({
      where: { id: req.params.id },
      include: {
        questions: { include: { options: true } },
      },
    });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    const attemptCount = await db.quizAttempt.count({
      where: { learnerId: req.user!.id, quizId: quiz.id },
    });
    const attemptsRemainingBefore = Math.max(0, quiz.attemptLimit - attemptCount);
    if (attemptsRemainingBefore <= 0) {
      return res.status(400).json({ error: 'Attempt limit reached', attemptsRemaining: 0 });
    }

    // Validate submitted question IDs belong to quiz
    const quizQuestionIds = new Set(quiz.questions.map((q) => q.id));
    for (const qid of Object.keys(answers)) {
      if (!quizQuestionIds.has(qid)) {
        return res.status(400).json({ error: 'Invalid question id in answers', questionId: qid });
      }
    }

    const totalQuestions = quiz.questions.length;
    const feedback = quiz.questions.map((q) => {
      const correctOption = q.options.find((o) => o.isCorrect) ?? null;
      const selectedOptionId = answers[q.id] ?? null;
      const isCorrect = !!correctOption && selectedOptionId === correctOption.id;
      return {
        questionId: q.id,
        selectedOptionId,
        correctOptionId: correctOption?.id ?? null,
        isCorrect,
      };
    });

    const correctAnswers = feedback.filter((f) => f.isCorrect).map((f) => f.questionId);
    const correctCount = correctAnswers.length;
    const score = totalQuestions === 0 ? 0 : (correctCount / totalQuestions) * 100;

    // Prisma schema stores passMark as 0..1
    const passed = score / 100 >= quiz.passMark;

    const attempt = await db.quizAttempt.create({
      data: {
        learnerId: req.user!.id,
        quizId: quiz.id,
        score,
        passed,
        answers,
      },
    });

    let pointsEarned = 0;
    if (passed) {
      const credited = await creditPoints({
        learnerId: req.user!.id,
        courseId: quiz.courseId,
        activityType: 'QUIZ_PASS',
        quizScore: score,
      });
      pointsEarned = credited.pointsEarned;
    }

    const attemptsRemaining = Math.max(0, quiz.attemptLimit - (attemptCount + 1));

    res.json({
      attemptId: attempt.id,
      passed,
      score,
      pointsEarned,
      correctAnswers,
      feedback: quiz.showAnswersAfter ? feedback : [],
      attemptsRemaining,
    });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: 'Could not submit attempt' });
  }
});

export default router;

