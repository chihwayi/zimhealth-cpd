import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { getRecommendations, invalidateRecommendations } from '../services/adaptive-learning';
import { db } from '../lib/db';
import { getLearnerEntitlements } from '../services/entitlements';

const router: ExpressRouter = Router();

// GET /api/recommendations — personalised course recommendations for the learner
router.get('/recommendations', requireAuth, requireRole('LEARNER'), async (req: AuthRequest, res) => {
  try {
    const ent = await getLearnerEntitlements(req.user!.id);
    const recs = await getRecommendations(req.user!.id);

    if (!recs.courseIds.length) {
      return res.json({
        courses: [],
        isProfileBased: recs.isProfileBased,
        message: 'No matching courses available right now — check back soon.',
      });
    }

    const courses = await db.course.findMany({
      where: { id: { in: recs.courseIds }, status: 'PUBLISHED' },
      include: {
        creator: { select: { fullName: true } },
        reviews: { select: { rating: true } },
        modules: { select: { isOfflineReady: true } },
      },
    });

    const ordered = recs.courseIds
      .map((courseId) => courses.find((c) => c.id === courseId))
      .filter(Boolean)
      .map((course) => {
        const ratings = course!.reviews.map((r) => r.rating);
        const averageRating = ratings.length
          ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
          : null;

        return {
          id: course!.id,
          title: course!.title,
          category: course!.category,
          difficulty: course!.difficulty,
          thumbnailUrl: course!.thumbnailUrl,
          estimatedMinutes: course!.estimatedMinutes,
          cpdPoints: course!.cpdPoints,
          averageRating,
          reviewCount: ratings.length,
          creatorName: course!.creator.fullName,
          modules: course!.modules,
          aiReason: recs.explanations[course!.id],
          aiReasonCategories: recs.reasonCategories[course!.id] ?? [],
          locked: !ent.premiumWebAccess,
        };
      });

    return res.json({
      courses: ordered,
      isProfileBased: recs.isProfileBased,
      premiumWebAccess: ent.premiumWebAccess,
    });
  } catch {
    return res.status(500).json({ error: 'Could not fetch recommendations' });
  }
});

// POST /api/recommendations/refresh — bust the recommendation cache
router.post('/recommendations/refresh', requireAuth, requireRole('LEARNER'), async (req: AuthRequest, res) => {
  try {
    await invalidateRecommendations(req.user!.id);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Could not refresh' });
  }
});

export default router;
