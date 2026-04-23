import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { db } from '../lib/db';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { z } from 'zod';

const router: ExpressRouter = Router();

const CreateCouncilSchema = z.object({
  name: z.string().min(3).max(200),
  acronym: z.string().min(2).max(12),
  slug: z.string().min(3).max(200).optional(),
  requiredPoints: z.number().int().min(1).max(500).default(12),
  renewalMonth: z.number().int().min(1).max(12).default(12),
  renewalDay: z.number().int().min(1).max(31).default(31),
  registrationPrefix: z.string().min(1).max(40).nullable().optional(),
  allowedTitles: z.array(z.string().min(2).max(120)).default([]),
  isActive: z.boolean().optional(),
});

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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

// POST /api/councils — admin-only create council
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const data = CreateCouncilSchema.parse(req.body);
    const slug = data.slug?.trim() ? slugify(data.slug) : slugify(data.name);
    const acronym = data.acronym.trim().toUpperCase();
    const created = await db.council.create({
      data: {
        name: data.name.trim(),
        acronym,
        slug,
        requiredPoints: data.requiredPoints,
        renewalMonth: data.renewalMonth,
        renewalDay: data.renewalDay,
        registrationPrefix: data.registrationPrefix ?? acronym,
        allowedTitles: data.allowedTitles,
        isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
      },
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
    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors });
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Council acronym or slug already exists.' });
    return res.status(500).json({ error: 'Could not create council' });
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

