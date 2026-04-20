import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { getRecommendations } from '../services/adaptive-learning';
import { db } from '../lib/db';

const router: ExpressRouter = Router();

router.get('/recommendations', requireAuth, requireRole('LEARNER'), async (req: AuthRequest, res) => {
  try {
    const recs = await getRecommendations(req.user!.id);

    if (!recs.courseIds.length) {
      return res.json({
        courses: [],
        message: 'Complete 3 or more courses to unlock personalised recommendations.',
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
      .map((courseId) => courses.find((course) => course.id === courseId))
      .filter(Boolean)
      .map((course) => {
        const ratings = course!.reviews.map((review) => review.rating);
        const averageRating = ratings.length
          ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
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
        };
      });

    return res.json({ courses: ordered });
  } catch {
    return res.status(500).json({ error: 'Could not fetch recommendations' });
  }
});

export default router;
