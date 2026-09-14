import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { db } from '../lib/db';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { getStreak, ensureAchievementsSeeded } from '../services/engagement';

const router: ExpressRouter = Router();

// GET /api/learners/me/streak — current/longest completion streak
router.get('/me/streak', requireAuth, requireRole('LEARNER'), async (req: AuthRequest, res) => {
  try {
    const streak = await getStreak(req.user!.id);
    res.json({
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastActivityDate: streak.lastActivityDate?.toISOString() ?? null,
    });
  } catch {
    res.status(500).json({ error: 'Could not fetch streak' });
  }
});

// GET /api/learners/me/achievements — earned + not-yet-earned achievements
router.get('/me/achievements', requireAuth, requireRole('LEARNER'), async (req: AuthRequest, res) => {
  try {
    await ensureAchievementsSeeded();
    const [all, earned] = await Promise.all([
      db.achievement.findMany({ orderBy: { createdAt: 'asc' } }),
      db.learnerAchievement.findMany({
        where: { learnerId: req.user!.id },
        select: { achievementId: true, earnedAt: true },
      }),
    ]);
    const earnedMap = new Map(earned.map((e) => [e.achievementId, e.earnedAt]));

    res.json({
      achievements: all.map((a) => ({
        code: a.code,
        title: a.title,
        description: a.description,
        earned: earnedMap.has(a.id),
        earnedAt: earnedMap.get(a.id)?.toISOString() ?? null,
      })),
    });
  } catch {
    res.status(500).json({ error: 'Could not fetch achievements' });
  }
});

export default router;
