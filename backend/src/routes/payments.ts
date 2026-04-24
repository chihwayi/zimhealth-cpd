import express, { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { InitiatePaymentSchema, RedeemVoucherSchema } from './payments.schema';
import { db } from '../lib/db';
import { initiatePaynow, initiateStripe, handlePaynowWebhook, handleStripeWebhook, applyConfirmedPayment } from '../services/payments';

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

// POST /api/payments/redeem-voucher — learner redeems a sponsor voucher code
router.post('/redeem-voucher', requireAuth, requireRole('LEARNER'), async (req: AuthRequest, res) => {
  try {
    const { code } = RedeemVoucherSchema.parse(req.body);
    const learnerId = req.user!.id;

    const voucher = await db.voucher.findUnique({
      where: { code: code.toUpperCase() },
      include: { batch: { select: { expiresAt: true, name: true, sponsorName: true } } },
    });

    if (!voucher) {
      return res.status(404).json({ error: 'Voucher code not found. Please check the code and try again.' });
    }
    if (voucher.redeemedAt) {
      return res.status(409).json({ error: 'This voucher has already been redeemed.' });
    }
    if (voucher.batch.expiresAt && voucher.batch.expiresAt < new Date()) {
      return res.status(410).json({ error: 'This voucher has expired.' });
    }

    await db.$transaction(async (tx) => {
      const redeemed = await tx.voucher.updateMany({
        where: { id: voucher.id, redeemedAt: null },
        data: { redeemedById: learnerId, redeemedAt: new Date() },
      });
      if (redeemed.count !== 1) {
        throw new Error('This voucher has already been redeemed.');
      }

      await applyConfirmedPayment({
        learnerId,
        tier: voucher.tier as 'STANDARD' | 'DIASPORA',
        paymentRef: `voucher:${voucher.code}`,
        gateway: 'voucher',
        tx,
        meta: {
          voucherId:   voucher.id,
          batchName:   voucher.batch.name,
          sponsorName: voucher.batch.sponsorName,
        },
      });
    });

    return res.json({
      ok:          true,
      tier:        voucher.tier,
      sponsorName: voucher.batch.sponsorName,
      message:     `Your account has been upgraded to ${voucher.tier} — sponsored by ${voucher.batch.sponsorName}.`,
    });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: err.message ?? 'Could not redeem voucher' });
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
