import { z } from 'zod';

export const InitiatePaymentSchema = z.object({
  tier: z.enum(['STANDARD', 'DIASPORA']),
  gateway: z.enum(['paynow', 'stripe']).default('stripe'),
});

export const RedeemVoucherSchema = z.object({
  code: z.string().min(5).max(30).trim(),
});

