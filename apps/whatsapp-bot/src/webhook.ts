import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { routeMessage } from './botRouter';
import { parseIncoming } from './whatsapp/transport';
import { validateWebhookSignature } from './twilio';

const router: ExpressRouter = Router();

// GET /webhook — Meta Cloud API verification (and some BSPs)
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && typeof token === 'string' && typeof challenge === 'string') {
    const expected = process.env.WHATSAPP_VERIFY_TOKEN ?? process.env.META_WA_VERIFY_TOKEN;
    if (expected && token === expected) return res.status(200).send(challenge);
    return res.status(403).send('Forbidden');
  }

  return res.status(200).send('ok');
});

// POST /webhook — incoming messages (Twilio form-encoded, Meta/360dialog JSON)
router.post('/', async (req, res) => {
  const provider = (process.env.WHATSAPP_PROVIDER ?? 'twilio').toLowerCase();
  const isTwilio = provider === 'twilio';

  if (process.env.NODE_ENV === 'production' && isTwilio) {
    const sig = req.headers['x-twilio-signature'] as string;
    const url = `${process.env.BOT_URL}/webhook`;
    const valid = validateWebhookSignature(process.env.TWILIO_AUTH_TOKEN!, url, req.body, sig);
    if (!valid) return res.status(403).send('Forbidden');
  }

  const parsed = parseIncoming(req.body, req.headers as any);
  if (!parsed) return res.status(400).send('Bad request');

  // Acknowledge immediately (Twilio requires fast response; Meta is fine with 200 OK)
  res.status(200).send(isTwilio ? '<Response></Response>' : 'ok');

  // Process asynchronously
  routeMessage({ from: parsed.from, body: parsed.body, profileName: (parsed as any).profileName }).catch((err) =>
    console.error('[Bot] routeMessage error:', err.message),
  );
});

export default router;

