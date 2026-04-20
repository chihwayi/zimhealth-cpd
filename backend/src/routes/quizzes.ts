import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { Prisma } from '@prisma/client';
import { db } from '../lib/db';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { SubmitQuizAttemptSchema } from './quizzes.schema';
import { creditPoints } from '../services/cpd-engine';
import { generateQuestionsFromText } from '../services/ai-question-gen';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

class AttemptLimitError extends Error {
  constructor() {
    super('Attempt limit reached');
    this.name = 'AttemptLimitError';
  }
}

const router: ExpressRouter = Router();

// GET /api/quizzes/:id — fetch quiz with questions
router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
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

    // If learner, hide correct answers and apply randomization
    if (req.user!.role === 'LEARNER') {
      const attemptCount = await db.quizAttempt.count({
        where: { learnerId: req.user!.id, quizId: quiz.id },
      });
      const attemptsRemaining = Math.max(0, quiz.attemptLimit - attemptCount);
      const questions = quiz.randomiseQuestions ? shuffle(quiz.questions) : quiz.questions;

      return res.json({
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
      });
    }

    // Otherwise (Creator/Admin), return full quiz with correct answers
    res.json(quiz);
  } catch {
    res.status(500).json({ error: 'Could not fetch quiz' });
  }
});

// POST /api/quizzes — create quiz for a module
router.post('/', requireAuth, requireRole('CONTENT_MANAGER', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { courseId, moduleId, title, passMark, attemptLimit, timeLimitMinutes, randomiseQuestions, showAnswersAfter } = req.body;
    const quiz = await db.quiz.create({
      data: {
        courseId,
        moduleId,
        title,
        passMark: passMark ?? 0.8,
        attemptLimit: attemptLimit ?? 3,
        timeLimitMinutes,
        randomiseQuestions: randomiseQuestions ?? false,
        showAnswersAfter: showAnswersAfter ?? true,
      },
    });
    res.json(quiz);
  } catch {
    res.status(500).json({ error: 'Could not create quiz' });
  }
});

// PATCH /api/quizzes/:id — update quiz settings
router.patch('/:id', requireAuth, requireRole('CONTENT_MANAGER', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { title, passMark, attemptLimit, timeLimitMinutes, randomiseQuestions, showAnswersAfter } = req.body;
    const quiz = await db.quiz.update({
      where: { id: req.params.id },
      data: {
        title,
        passMark,
        attemptLimit,
        timeLimitMinutes,
        randomiseQuestions,
        showAnswersAfter,
      },
    });
    res.json(quiz);
  } catch {
    res.status(500).json({ error: 'Could not update quiz' });
  }
});

// POST /api/quizzes/:id/questions — add question
router.post('/:id/questions', requireAuth, requireRole('CONTENT_MANAGER', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { type, text, points, options } = req.body;
    const questionCount = await db.question.count({ where: { quizId: req.params.id } });
    const question = await db.question.create({
      data: {
        quizId: req.params.id,
        type,
        text,
        points: points ?? 1,
        order: questionCount + 1,
        options: {
          create: options.map((o: any) => ({
            text: o.text,
            isCorrect: o.isCorrect,
          })),
        },
      },
      include: { options: true },
    });
    res.json(question);
  } catch {
    res.status(500).json({ error: 'Could not add question' });
  }
});

// PATCH /api/quizzes/:id/questions/:qid — update question
router.patch('/:id/questions/:qid', requireAuth, requireRole('CONTENT_MANAGER', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { text, points, options } = req.body;
    await db.question.update({
      where: { id: req.params.qid },
      data: { text, points },
    });
    if (options) {
      await db.questionOption.deleteMany({ where: { questionId: req.params.qid } });
      await db.questionOption.createMany({
        data: options.map((o: any) => ({
          questionId: req.params.qid,
          text: o.text,
          isCorrect: o.isCorrect,
        })),
      });
    }
    const updated = await db.question.findUnique({
      where: { id: req.params.qid },
      include: { options: true },
    });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Could not update question' });
  }
});

// DELETE /api/quizzes/:id/questions/:qid — delete question
router.delete('/:id/questions/:qid', requireAuth, requireRole('CONTENT_MANAGER', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    await db.question.delete({ where: { id: req.params.qid } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Could not delete question' });
  }
});

// POST /api/quizzes/:id/attempt — submit answers
router.post('/:id/attempt', requireAuth, requireRole('LEARNER'), async (req: AuthRequest, res) => {
  try {
    const { answers } = SubmitQuizAttemptSchema.parse(req.body);

    const quiz = await db.quiz.findUnique({
      where: { id: req.params.id },
      include: { questions: { include: { options: true } } },
    });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    const questionIds = new Set(quiz.questions.map((q) => q.id));
    for (const key of Object.keys(answers)) {
      if (!questionIds.has(key)) {
        return res.status(400).json({ error: `Unknown question id: ${key}` });
      }
    }

    const totalQuestions = quiz.questions.length;
    if (totalQuestions === 0) {
      return res.status(400).json({ error: 'This quiz has no questions' });
    }

    const feedback = quiz.questions.map((q) => {
      const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
      const correctSet = new Set(correctIds);
      const selectedOptionId = answers[q.id] ?? null;
      const isCorrect =
        selectedOptionId !== null && correctSet.size > 0 && correctSet.has(selectedOptionId);
      const correctOptionId = correctIds.length === 1 ? correctIds[0] : correctIds[0] ?? null;
      return { questionId: q.id, selectedOptionId, correctOptionId, isCorrect };
    });

    const correctCount = feedback.filter((f) => f.isCorrect).length;
    const score = (correctCount / totalQuestions) * 100;
    const passed = score / 100 >= quiz.passMark;

    let attemptsRemaining = 0;
    const attempt = await db.$transaction(
      async (tx) => {
        const attemptCount = await tx.quizAttempt.count({
          where: { learnerId: req.user!.id, quizId: quiz.id },
        });
        if (attemptCount >= quiz.attemptLimit) {
          throw new AttemptLimitError();
        }

        attemptsRemaining = Math.max(0, quiz.attemptLimit - (attemptCount + 1));

        return tx.quizAttempt.create({
          data: { learnerId: req.user!.id, quizId: quiz.id, score, passed, answers },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      },
    );

    let pointsEarned = 0;
    if (passed) {
      const credited = await creditPoints({
        learnerId: req.user!.id,
        courseId: quiz.courseId,
        quizId: quiz.id,
        activityType: 'QUIZ_PASS',
        quizScore: score,
      });
      pointsEarned = credited.pointsEarned;
    }

    res.json({
      attemptId: attempt.id,
      passed,
      score,
      pointsEarned,
      attemptsRemaining,
      feedback: quiz.showAnswersAfter ? feedback : [],
    });
  } catch (err: any) {
    if (err instanceof AttemptLimitError) {
      return res.status(400).json({ error: 'Attempt limit reached' });
    }
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: 'Could not submit attempt' });
  }
});

// POST /api/quizzes/:id/generate-questions — AI question generation
router.post('/:id/generate-questions', requireAuth, requireRole('CONTENT_MANAGER', 'ADMIN'), async (req, res) => {
  try {
    const { sourceText, count = 5 } = req.body;
    if (!sourceText || sourceText.length < 50) return res.status(400).json({ error: 'sourceText must be at least 50 characters' });
    const questions = await generateQuestionsFromText(sourceText, Math.min(count, 10));
    res.json({ questions, isDraft: true, message: 'Review and edit these questions before adding to your quiz.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'AI question generation failed' });
  }
});

export default router;
