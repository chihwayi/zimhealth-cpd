import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { db } from '../lib/db';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { z } from 'zod';

const router: ExpressRouter = Router();

router.get('/', async (_req, res) => {
  try {
    const councils = await db.council.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        acronym: true,
        requiredPoints: true,
        renewalMonth: true,
        renewalDay: true,
        registrationPrefix: true,
        allowedTitles: true,
      },
    });
    res.json({ councils });
  } catch {
    res.status(500).json({ error: 'Could not fetch councils' });
  }
});

// GET /api/councils/all — admin-only list (includes inactive)
router.get('/all', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const councils = await db.council.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        acronym: true,
        requiredPoints: true,
        renewalMonth: true,
        renewalDay: true,
        registrationPrefix: true,
        allowedTitles: true,
        isActive: true,
      },
    });
    res.json({ councils });
  } catch {
    res.status(500).json({ error: 'Could not fetch councils' });
  }
});

const UpdateCouncilSchema = z.object({
  requiredPoints: z.number().int().min(1).max(500).optional(),
  renewalMonth: z.number().int().min(1).max(12).optional(),
  renewalDay: z.number().int().min(1).max(31).optional(),
  registrationPrefix: z.string().min(1).max(40).nullable().optional(),
  allowedTitles: z.array(z.string().min(2).max(120)).optional(),
  isActive: z.boolean().optional(),
});

// PATCH /api/councils/:id — admin-only council config updates (required points, renewal date, titles)
router.patch('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const data = UpdateCouncilSchema.parse(req.body);
    const updated = await db.council.update({
      where: { id: req.params.id },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        acronym: true,
        requiredPoints: true,
        renewalMonth: true,
        renewalDay: true,
        registrationPrefix: true,
        allowedTitles: true,
        isActive: true,
      },
    });
    return res.json(updated);
  } catch (err: any) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'Could not update council' });
  }
});

export default router;

