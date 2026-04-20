import express, { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { InitiatePaymentSchema } from './payments.schema';
import { db } from '../lib/db';
import { initiatePaynow, initiateStripe, handlePaynowWebhook, handleStripeWebhook } from '../services/payments';

const router: ExpressRouter = Router();

// POST /api/payments/initiate — learner initiates payment, returns redirect URL
router.post('/initiate', requireAuth, requireRole('LEARNER'), async (req: AuthRequest, res) => {
  try {
    const { tier, gateway } = InitiatePaymentSchema.parse(req.body);
    const user = await db.user.findUnique({ where: { id: req.user!.id }, select: { email: true } });
    const email = user?.email ?? 'unknown@example.com';

    if (gateway === 'stripe') {
      const url = await initiateStripe(req.user!.id, tier, email);
      return res.json({ url });
    }

    const paynow = await initiatePaynow(req.user!.id, tier, email);
    return res.json({ url: paynow.redirectUrl, reference: paynow.reference, pollUrl: paynow.pollUrl });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: err.message ?? 'Could not initiate payment' });
  }
});

// POST /api/payments/webhook/paynow — Paynow callback (no auth)
router.post('/webhook/paynow', async (req, res) => {
  try {
    const out = await handlePaynowWebhook(req.body);
    res.json(out);
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? 'Bad webhook payload' });
  }
});

// POST /api/payments/webhook/stripe — Stripe webhook (no auth, verified by sig)
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'] as string | undefined;
    const out = await handleStripeWebhook(req.body as Buffer, signature);
    res.json(out);
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? 'Stripe webhook error' });
  }
});

export default router;

