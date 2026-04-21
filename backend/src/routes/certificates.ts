import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { db } from '../lib/db';
import { generateCertificate } from '../services/certificate';
import { canGenerateCertificate } from '../services/entitlements';
import { z } from 'zod';

const router: ExpressRouter = Router();
const GenerateCertificateSchema = z.object({
  cycleYear: z.number().int().min(2020).max(2100).optional(),
});

// POST /api/certificates/generate (LEARNER) — generates cert if eligible
router.post('/generate', requireAuth, requireRole('LEARNER'), async (req: AuthRequest, res) => {
  try {
    const data = GenerateCertificateSchema.parse({
      cycleYear: req.body?.cycleYear ? Number(req.body.cycleYear) : undefined,
    });
    const cycleYear = data.cycleYear ?? new Date().getFullYear();

    const allowed = await canGenerateCertificate(req.user!.id, cycleYear);
    if (!allowed) {
      return res.status(402).json({
        error: 'Upgrade required to generate certificates on the web.',
        code: 'UPGRADE_REQUIRED',
      });
    }

    const cert = await generateCertificate(req.user!.id, cycleYear);
    res.json(cert);
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
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
