import Stripe from 'stripe';
import { Paynow } from 'paynow';
import type { SubscriptionTier } from '@prisma/client';
import { db } from '../lib/db';

type PaidTier = Exclude<SubscriptionTier, 'FREE'>;
type Gateway = 'paynow' | 'stripe';

function getTierAmountUSD(tier: PaidTier): number {
  if (tier === 'STANDARD') return 5;
  if (tier === 'DIASPORA') return 15;
  // Defensive: keep type-safe future tiers from silently passing
  throw new Error(`Unsupported tier: ${tier}`);
}

function addOneYear(d: Date): Date {
  const next = new Date(d);
  next.setFullYear(next.getFullYear() + 1);
  return next;
}

export async function applyConfirmedPayment(input: {
  learnerId: string;
  tier: PaidTier;
  paymentRef?: string;
  gateway: Gateway;
  meta?: Record<string, unknown>;
}) {
  const now = new Date();
  const expiresAt = addOneYear(now);

  const subscription = await db.subscription.upsert({
    where: { learnerId: input.learnerId },
    create: {
      learnerId: input.learnerId,
      tier: input.tier,
      startsAt: now,
      expiresAt,
      paymentRef: input.paymentRef,
      gateway: input.gateway,
    },
    update: {
      tier: input.tier,
      startsAt: now,
      expiresAt,
      paymentRef: input.paymentRef,
      gateway: input.gateway,
    },
  });

  await db.user.update({
    where: { id: input.learnerId },
    data: { subscriptionTier: input.tier, subscriptionExpiresAt: expiresAt },
  });

  await db.auditLog.create({
    data: {
      userId: input.learnerId,
      action: 'SUBSCRIPTION_PAYMENT_CONFIRMED',
      entityType: 'Subscription',
      entityId: subscription.id,
      meta: { tier: input.tier, gateway: input.gateway, paymentRef: input.paymentRef, ...(input.meta ?? {}) },
    },
  });

  return subscription;
}

export async function initiateStripe(learnerId: string, tier: PaidTier, email: string) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not set');

  const stripe = new Stripe(secretKey, { apiVersion: '2024-04-10' });
  const amount = getTierAmountUSD(tier);

  const successUrl = process.env.STRIPE_SUCCESS_URL ?? `${process.env.WEB_URL ?? 'http://localhost:3000'}/subscription/success`;
  const cancelUrl = process.env.STRIPE_CANCEL_URL ?? `${process.env.WEB_URL ?? 'http://localhost:3000'}/subscription`;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(amount * 100),
          product_data: { name: `NursePro CPD — ${tier} (1 year)` },
        },
      },
    ],
    metadata: { learnerId, tier },
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
  });

  if (!session.url) throw new Error('Stripe session URL missing');
  return session.url;
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string | undefined) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not set');
  if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  if (!signature) throw new Error('Missing Stripe signature');

  const stripe = new Stripe(secretKey, { apiVersion: '2024-04-10' });
  const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const learnerId = (session.metadata?.learnerId as string | undefined) ?? undefined;
    const tier = (session.metadata?.tier as PaidTier | undefined) ?? undefined;
    if (learnerId && tier) {
      await applyConfirmedPayment({
        learnerId,
        tier,
        gateway: 'stripe',
        paymentRef: session.id,
        meta: { amount_total: session.amount_total, currency: session.currency },
      });
    }
  }

  return { received: true, type: event.type };
}

export async function initiatePaynow(learnerId: string, tier: PaidTier, email: string) {
  const integrationId = process.env.PAYNOW_INTEGRATION_ID;
  const integrationKey = process.env.PAYNOW_INTEGRATION_KEY;
  if (!integrationId || !integrationKey) throw new Error('PAYNOW credentials not set');

  const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';
  const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
  const resultUrl = process.env.PAYNOW_RESULT_URL ?? `${apiUrl}/api/payments/webhook/paynow`;
  const returnUrl = process.env.PAYNOW_RETURN_URL ?? `${webUrl}/subscription/success`;

  const paynow = new Paynow(integrationId, integrationKey, resultUrl, returnUrl);

  const amount = getTierAmountUSD(tier);
  const reference = `np_${learnerId}_${tier}_${Date.now()}`;

  const payment = paynow.createPayment(reference, email);
  payment.add(`NursePro CPD — ${tier} (1 year)`, amount);

  const response = await paynow.send(payment);
  if (!response.success) throw new Error('Paynow initiation failed');

  // Paynow returns a redirect URL the learner completes payment on
  return {
    redirectUrl: response.redirectUrl as string,
    pollUrl: response.pollUrl as string,
    reference,
  };
}

export async function handlePaynowWebhook(body: any) {
  const integrationId = process.env.PAYNOW_INTEGRATION_ID;
  const integrationKey = process.env.PAYNOW_INTEGRATION_KEY;
  if (!integrationId || !integrationKey) throw new Error('PAYNOW credentials not set');

  const pollUrl = body?.pollurl ?? body?.pollUrl;
  const reference = body?.reference;
  if (!pollUrl || !reference) throw new Error('Missing Paynow pollUrl/reference');

  const paynow = new Paynow(integrationId, integrationKey);
  if (!paynow.verifyHash(body)) {
    throw new Error('Invalid Paynow callback hash');
  }
  const status = await paynow.pollTransaction(pollUrl);

  const paid =
    status?.paid === true ||
    status?.status === 'Paid' ||
    status?.status === 'paid' ||
    status?.status === 'Awaiting Delivery';

  if (!paid) return { ok: true, paid: false, status: status?.status ?? 'unknown' };

  // Reference format: np_<learnerId>_<tier>_<timestamp>
  const parts = String(reference).split('_');
  const learnerId = parts[1];
  const tier = parts[2] as PaidTier | undefined;
  if (!learnerId || !tier) throw new Error('Invalid payment reference');

  await applyConfirmedPayment({
    learnerId,
    tier,
    gateway: 'paynow',
    paymentRef: reference,
    meta: { pollUrl, status: status?.status },
  });

  return { ok: true, paid: true };
}
