import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { requireBotSecret } from '../middleware/auth.middleware';
import { db } from '../lib/db';
import { getLearnerEntitlements } from '../services/entitlements';

const router: ExpressRouter = Router();

// GET /api/entitlements/bot/:phone — bot-safe entitlement lookup
router.get('/bot/:phone', requireBotSecret, async (req, res) => {
  try {
    const learner = await db.user.findUnique({ where: { phone: req.params.phone }, select: { id: true } });
    if (!learner) return res.status(404).json({ error: 'Learner not found' });
    const ent = await getLearnerEntitlements(learner.id);
    res.json({
      subscriptionTier: ent.subscriptionTier,
      aiTutorAllowed: ent.aiTutorAllowed,
      remainingWhatsappPoints: ent.remainingWhatsappPoints,
      certificateEligible: ent.certificateEligible,
      premiumWebAccess: ent.premiumWebAccess,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Could not fetch entitlements' });
  }
});

export default router;

