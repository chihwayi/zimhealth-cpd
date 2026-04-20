import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { routeMessage } from './botRouter';
import { validateWebhookSignature } from './twilio';

const router: ExpressRouter = Router();

// POST /webhook — Twilio sends all incoming WhatsApp messages here
router.post('/', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    const sig = req.headers['x-twilio-signature'] as string;
    const url = `${process.env.BOT_URL}/webhook`;
    const valid = validateWebhookSignature(process.env.TWILIO_AUTH_TOKEN!, url, req.body, sig);
    if (!valid) return res.status(403).send('Forbidden');
  }

  // Twilio sends form-encoded body
  const from: string = req.body.From ?? '';
  const body: string = req.body.Body ?? '';
  const profileName: string = req.body.ProfileName ?? '';

  if (!from || !body) return res.status(400).send('Bad request');

  // Acknowledge immediately (Twilio requires fast response)
  res.status(200).send('<Response></Response>');

  // Process asynchronously
  routeMessage({ from, body, profileName }).catch((err) => console.error('[Bot] routeMessage error:', err.message));
});

export default router;

