import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { db } from '../lib/db';
import { generateCertificate } from '../services/certificate';

const router: ExpressRouter = Router();

// POST /api/certificates/generate (LEARNER) — generates cert if eligible
router.post('/generate', requireAuth, requireRole('LEARNER'), async (req: AuthRequest, res) => {
  try {
    const cycleYear = req.body?.cycleYear ? Number(req.body.cycleYear) : new Date().getFullYear();
    const cert = await generateCertificate(req.user!.id, cycleYear);
    res.json(cert);
  } catch (err: any) {
    const msg = err?.message ?? 'Could not generate certificate';
    if (msg.includes('Not eligible')) return res.status(400).json({ error: msg });
    res.status(500).json({ error: msg });
  }
});

// GET /api/certificates (LEARNER) — list learner certificates
router.get('/', requireAuth, requireRole('LEARNER'), async (req: AuthRequest, res) => {
  try {
    const certs = await db.certificate.findMany({
      where: { learnerId: req.user!.id },
      orderBy: { issuedAt: 'desc' },
    });
    res.json(certs);
  } catch {
    res.status(500).json({ error: 'Could not fetch certificates' });
  }
});

// GET /api/certificates/verify/:uuid (public) — returns cert info for QR scan
router.get('/verify/:uuid', async (req, res) => {
  try {
    const cert = await db.certificate.findUnique({
      where: { certificateUuid: req.params.uuid },
      include: { learner: { select: { fullName: true, nczRegistrationNumber: true } } },
    });
    if (!cert) return res.status(404).json({ error: 'Certificate not found' });
    res.json({
      certificateUuid: cert.certificateUuid,
      cycleYear: cert.cycleYear,
      totalPoints: cert.totalPoints,
      coursesCompleted: cert.coursesCompleted,
      issuedAt: cert.issuedAt,
      learner: cert.learner,
    });
  } catch {
    res.status(500).json({ error: 'Could not verify certificate' });
  }
});

export default router;

