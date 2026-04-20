import { z } from 'zod';

export const InitiatePaymentSchema = z.object({
  tier: z.enum(['STANDARD', 'DIASPORA']),
  gateway: z.enum(['paynow', 'stripe']).default('stripe'),
});

