import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireAuth } from '../middleware/auth.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router: ExpressRouter = Router();

const CreateIssueSchema = z.object({
  title: z.string().min(3).max(150),
  description: z.string().min(5).max(2000),
  source: z.enum(['WEB', 'MOBILE']).default('WEB'),
});

// POST /api/issues — any authenticated user reports an issue from web/mobile
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = CreateIssueSchema.parse(req.body);
    const issue = await db.issueReport.create({
      data: {
        reporterId: req.user!.id,
        title: data.title,
        description: data.description,
        source: data.source,
      },
    });
    return res.status(201).json(issue);
  } catch (err: any) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'Could not submit issue report' });
  }
});

const ListIssuesQuerySchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'WONT_FIX']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  source: z.enum(['WEB', 'MOBILE', 'WHATSAPP']).optional(),
});

const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

// GET /api/issues — helpdesk/admin triage queue, ranked by priority then age
router.get('/', requireAuth, requireRole('PLATFORM_OWNER', 'HELPDESK'), async (req, res) => {
  try {
    const query = ListIssuesQuerySchema.parse(req.query);
    const issues = await db.issueReport.findMany({
      where: {
        status: query.status,
        priority: query.priority,
        source: query.source,
      },
      include: {
        reporter: { select: { id: true, fullName: true, email: true, phone: true, role: true } },
        assignedTo: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    issues.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
    return res.json({ issues });
  } catch (err: any) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'Could not fetch issue reports' });
  }
});

const UpdateIssueSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'WONT_FIX']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  assignedToUserId: z.string().nullable().optional(),
  resolutionNotes: z.string().max(2000).nullable().optional(),
});

// PATCH /api/issues/:id — helpdesk/admin triage: rank, assign, resolve
router.patch('/:id', requireAuth, requireRole('PLATFORM_OWNER', 'HELPDESK'), async (req: AuthRequest, res) => {
  try {
    const data = UpdateIssueSchema.parse(req.body);
    const updated = await db.issueReport.update({
      where: { id: req.params.id },
      data: {
        ...data,
        resolvedAt: data.status === 'RESOLVED' ? new Date() : undefined,
      },
    });

    await db.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'ISSUE_TRIAGED',
        entityType: 'IssueReport',
        entityId: updated.id,
        meta: data as any,
      },
    });

    return res.json(updated);
  } catch (err: any) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'Could not update issue report' });
  }
});

export default router;
