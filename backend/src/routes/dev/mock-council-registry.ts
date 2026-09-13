import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { logger } from '../../lib/logger';

// Stand-in for a real council registration system, for local/demo use only.
// Implements the contract documented in docs/integrations/ncz-sync-api-spec.md
// so the full sync flow (syncWorker -> ncz-sync -> here) can be exercised
// end-to-end without a real council partner API. Never mounted in production
// — see backend/src/app.ts.
const router: ExpressRouter = Router();

router.post('/cpd-records', (req, res) => {
  const apiKey = req.header('x-api-key');
  const idempotencyKey = req.header('X-Idempotency-Key');
  const configuredKey = process.env.COUNCIL_SYNC_API_KEY;

  if (configuredKey && apiKey !== configuredKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'X-Idempotency-Key header is required' });
  }

  const records = Array.isArray(req.body?.records) ? req.body.records : [];
  logger.info('[mock-council-registry] Received CPD sync batch', {
    idempotencyKey,
    recordCount: records.length,
    recordIds: records.map((r: { recordId?: string }) => r.recordId),
  });

  return res.status(200).json({
    accepted: records.map((r: { recordId?: string }) => r.recordId),
    idempotencyKey,
    receivedAt: new Date().toISOString(),
  });
});

export default router;
