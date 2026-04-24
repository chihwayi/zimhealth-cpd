import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { db } from '../lib/db';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { retryNczRecord, runNczSync } from '../services/ncz-sync';
import type { AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';

const router: ExpressRouter = Router();
async function getOfficerCouncilId(req: AuthRequest): Promise<string | null> {
  if (req.user?.role === 'ADMIN') return null;
  const officer = await db.user.findUnique({
    where: { id: req.user!.id },
    select: { councilId: true },
  });
  return officer?.councilId ?? '__NO_COUNCIL__';
}

async function getCouncilRequiredPoints(councilId: string | null): Promise<number> {
  if (!councilId || councilId === '__NO_COUNCIL__') return 12;
  const council = await db.council.findUnique({ where: { id: councilId }, select: { requiredPoints: true } });
  return council?.requiredPoints ?? 12;
}

const UpdateOwnCouncilSchema = z.object({
  requiredPoints: z.number().int().min(1).max(500).optional(),
  renewalMonth: z.number().int().min(1).max(12).optional(),
  renewalDay: z.number().int().min(1).max(31).optional(),
});

const CouncilCourseReviewListSchema = z.object({
  status: z.enum(['PENDING_REVIEW', 'APPROVED', 'REJECTED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const ApproveCouncilCourseSchema = z.object({
  points: z.number().int().min(0).max(100),
});

const RejectCouncilCourseSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

// PATCH /api/ncz/settings (also available under /api/council/settings via alias mounting)
// Council officers can update THEIR council CPD requirements.
router.patch(
  '/settings',
  requireAuth,
  requireRole('NCZ_OFFICER', 'COUNCIL_OFFICER', 'ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      if (req.user?.role === 'ADMIN') {
        return res.status(400).json({ error: 'Admins should use /api/councils/:id to update council settings.' });
      }

      const councilId = await getOfficerCouncilId(req);
      if (!councilId || councilId === '__NO_COUNCIL__') {
        return res.status(400).json({ error: 'Council officer is not assigned to a council.' });
      }

      const data = UpdateOwnCouncilSchema.parse(req.body);
      if (!Object.keys(data).length) {
        return res.status(400).json({ error: 'No updates provided.' });
      }

      const updated = await db.council.update({
        where: { id: councilId },
        data,
        select: {
          id: true,
          name: true,
          acronym: true,
          requiredPoints: true,
          renewalMonth: true,
          renewalDay: true,
          allowedTitles: true,
          isActive: true,
        },
      });

      return res.json({ council: updated });
    } catch (err: any) {
      if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors });
      return res.status(500).json({ error: 'Could not update council settings' });
    }
  },
);

// ─── Council course approvals + points (Council-owned) ───────────────────────
// These endpoints are mounted at /api/ncz/* and also /api/council/* via alias.

router.get(
  '/courses/reviews',
  requireAuth,
  requireRole('NCZ_OFFICER', 'COUNCIL_OFFICER', 'ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      if (req.user?.role === 'ADMIN') {
        return res.status(400).json({ error: 'Admins should use a council-specific review view (not implemented yet).' });
      }

      const councilId = await getOfficerCouncilId(req);
      if (!councilId || councilId === '__NO_COUNCIL__') {
        return res.status(400).json({ error: 'Council officer is not assigned to a council.' });
      }

      const { status, limit } = CouncilCourseReviewListSchema.parse(req.query);
      const take = limit ?? 50;

      const rows = await db.councilCourseReview.findMany({
        where: {
          councilId,
          ...(status ? { status } : {}),
        },
        orderBy: [{ updatedAt: 'desc' }],
        take,
        include: {
          course: {
            select: {
              id: true,
              title: true,
              subtitle: true,
              category: true,
              difficulty: true,
              language: true,
              estimatedMinutes: true,
              thumbnailUrl: true,
              tags: true,
              status: true,
              creator: { select: { id: true, fullName: true, email: true } },
            },
          },
          reviewedBy: { select: { id: true, fullName: true, email: true } },
        },
      });

      return res.json({ reviews: rows });
    } catch (err: any) {
      if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors });
      return res.status(500).json({ error: 'Could not fetch course reviews' });
    }
  },
);

router.post(
  '/courses/:courseId/reviews/approve',
  requireAuth,
  requireRole('NCZ_OFFICER', 'COUNCIL_OFFICER'),
  async (req: AuthRequest, res) => {
    try {
      const councilId = await getOfficerCouncilId(req);
      if (!councilId || councilId === '__NO_COUNCIL__') {
        return res.status(400).json({ error: 'Council officer is not assigned to a council.' });
      }

      const { points } = ApproveCouncilCourseSchema.parse(req.body);
      const updated = await db.councilCourseReview.update({
        where: { courseId_councilId: { courseId: req.params.courseId, councilId } },
        data: {
          status: 'APPROVED',
          points,
          rejectionReason: null,
          reviewedAt: new Date(),
          reviewedByUserId: req.user!.id,
        },
        include: {
          course: { select: { id: true, title: true, status: true } },
        },
      });

      await db.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'COUNCIL_COURSE_APPROVED',
          entityType: 'Course',
          entityId: req.params.courseId,
          meta: { councilId, points, reviewId: updated.id },
        },
      });

      return res.json({ review: updated });
    } catch (err: any) {
      if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors });
      if (err?.code === 'P2025') return res.status(404).json({ error: 'No pending review found for this council/course.' });
      return res.status(500).json({ error: 'Could not approve course for council' });
    }
  },
);

router.post(
  '/courses/:courseId/reviews/reject',
  requireAuth,
  requireRole('NCZ_OFFICER', 'COUNCIL_OFFICER'),
  async (req: AuthRequest, res) => {
    try {
      const councilId = await getOfficerCouncilId(req);
      if (!councilId || councilId === '__NO_COUNCIL__') {
        return res.status(400).json({ error: 'Council officer is not assigned to a council.' });
      }

      const { reason } = RejectCouncilCourseSchema.parse(req.body);
      const updated = await db.councilCourseReview.update({
        where: { courseId_councilId: { courseId: req.params.courseId, councilId } },
        data: {
          status: 'REJECTED',
          points: null,
          rejectionReason: reason,
          reviewedAt: new Date(),
          reviewedByUserId: req.user!.id,
        },
        include: {
          course: { select: { id: true, title: true, status: true } },
        },
      });

      await db.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'COUNCIL_COURSE_REJECTED',
          entityType: 'Course',
          entityId: req.params.courseId,
          meta: { councilId, reason, reviewId: updated.id },
        },
      });

      return res.json({ review: updated });
    } catch (err: any) {
      if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors });
      if (err?.code === 'P2025') return res.status(404).json({ error: 'No pending review found for this council/course.' });
      return res.status(500).json({ error: 'Could not reject course for council' });
    }
  },
);

router.patch(
  '/courses/:courseId/reviews/points',
  requireAuth,
  requireRole('NCZ_OFFICER', 'COUNCIL_OFFICER'),
  async (req: AuthRequest, res) => {
    try {
      const councilId = await getOfficerCouncilId(req);
      if (!councilId || councilId === '__NO_COUNCIL__') {
        return res.status(400).json({ error: 'Council officer is not assigned to a council.' });
      }

      const { points } = ApproveCouncilCourseSchema.parse(req.body);
      const updated = await db.councilCourseReview.update({
        where: { courseId_councilId: { courseId: req.params.courseId, councilId } },
        data: {
          points,
          reviewedAt: new Date(),
          reviewedByUserId: req.user!.id,
        },
        include: {
          course: { select: { id: true, title: true, status: true } },
        },
      });

      await db.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'COUNCIL_COURSE_POINTS_UPDATED',
          entityType: 'Course',
          entityId: req.params.courseId,
          meta: { councilId, points, reviewId: updated.id },
        },
      });

      return res.json({ review: updated });
    } catch (err: any) {
      if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors });
      if (err?.code === 'P2025') return res.status(404).json({ error: 'No review found for this council/course.' });
      return res.status(500).json({ error: 'Could not update council points' });
    }
  },
);

router.get(
  '/learners',
  requireAuth,
  requireRole('NCZ_OFFICER', 'COUNCIL_OFFICER', 'ADMIN'),
  async (req: AuthRequest, res) => {
  try {
    const {
      search,
      cadre,
      professionalTitle,
      institution,
      province,
      district,
      page = '1',
      limit = '25',
    } = req.query as Record<string, string>;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
    const skip = (pageNumber - 1) * pageSize;

    const councilId = await getOfficerCouncilId(req);
    const requiredPoints = await getCouncilRequiredPoints(councilId);
    const where: Record<string, unknown> = { role: 'LEARNER' };
    if (councilId) where.councilId = councilId;
    if (cadre) where.cadre = cadre;
    if (professionalTitle) where.professionalTitle = professionalTitle;
    if (institution) where.institution = { contains: institution, mode: 'insensitive' };
    if (province) where.province = province;
    if (district) where.district = { contains: district, mode: 'insensitive' };
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { nczRegistrationNumber: { contains: search, mode: 'insensitive' } },
        { registrationNumber: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [learners, total] = await Promise.all([
      db.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { fullName: 'asc' },
        select: {
          id: true,
          fullName: true,
          email: true,
          nczRegistrationNumber: true,
          registrationNumber: true,
          professionalTitle: true,
          council: { select: { id: true, name: true, acronym: true, requiredPoints: true } },
          cadre: true,
          institution: true,
          province: true,
          district: true,
          subscriptionTier: true,
          isActive: true,
        },
      }),
      db.user.count({ where }),
    ]);

    const year = new Date().getFullYear();
    const learnerIds = learners.map((learner) => learner.id);
    const cpdTotals = learnerIds.length
      ? await db.cPDRecord.groupBy({
          by: ['learnerId'],
          where: { learnerId: { in: learnerIds }, cycleYear: year },
          _sum: { pointsEarned: true },
        })
      : [];
    const pointsMap = Object.fromEntries(
      cpdTotals.map((record) => [record.learnerId, record._sum.pointsEarned ?? 0]),
    );

    const learnersWithCpd = learners.map((learner) => {
      const currentYearPoints = pointsMap[learner.id] ?? 0;
      return {
        ...learner,
        currentYearPoints,
        isCompliant: currentYearPoints >= (learner.council?.requiredPoints ?? requiredPoints),
      };
    });

    res.json({
      learners: learnersWithCpd,
      total,
      page: pageNumber,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch {
    res.status(500).json({ error: 'Could not fetch learners' });
  }
});

router.get(
  '/learners/:id/history',
  requireAuth,
  requireRole('NCZ_OFFICER', 'COUNCIL_OFFICER', 'ADMIN'),
  async (req: AuthRequest, res) => {
    try {
    const councilId = await getOfficerCouncilId(req);
    const [learner, records, certificates] = await Promise.all([
      db.user.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          fullName: true,
          email: true,
          nczRegistrationNumber: true,
          registrationNumber: true,
          professionalTitle: true,
          councilId: true,
          council: { select: { id: true, name: true, acronym: true, requiredPoints: true } },
          cadre: true,
          institution: true,
          province: true,
          district: true,
          isActive: true,
        },
      }),
      db.cPDRecord.findMany({
        where: { learnerId: req.params.id },
        orderBy: { completedAt: 'desc' },
        include: { course: { select: { id: true, title: true, cpdPoints: true } } },
      }),
      db.certificate.findMany({
        where: { learnerId: req.params.id },
        orderBy: { issuedAt: 'desc' },
      }),
    ]);

    if (!learner) {
      return res.status(404).json({ error: 'Learner not found' });
    }
    if (councilId && learner.councilId !== councilId) {
      return res.status(403).json({ error: 'This learner belongs to another council.' });
    }

    // Attach council-effective course points for display consistency.
    const courseIds = records.map((r) => r.course?.id).filter(Boolean) as string[];
    const pointsByCourseId =
      councilId && courseIds.length
        ? Object.fromEntries(
            (
              await db.councilCourseReview.findMany({
                where: { councilId: learner.councilId ?? councilId, courseId: { in: courseIds }, status: 'APPROVED', points: { not: null } },
                select: { courseId: true, points: true },
              })
            ).map((row) => [row.courseId, row.points]),
          )
        : {};

    const recordsWithPoints = records.map((r: any) => {
      const effectivePoints =
        r.course?.id && pointsByCourseId[r.course.id] != null ? pointsByCourseId[r.course.id] : (r.course?.cpdPoints ?? null);
      return {
        ...r,
        course: r.course ? { title: r.course.title, effectivePoints } : null,
      };
    });

    return res.json({ learner, records: recordsWithPoints, certificates });
    } catch {
      return res.status(500).json({ error: 'Could not fetch learner history' });
    }
});

const UpdateLearnerNczSchema = z.object({
  nczRegistrationNumber: z.string().min(4).max(50).nullable(),
});

router.patch(
  '/learners/:id',
  requireAuth,
  requireRole('NCZ_OFFICER', 'COUNCIL_OFFICER', 'ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const data = UpdateLearnerNczSchema.parse(req.body);
      const councilId = await getOfficerCouncilId(req);
      const learner = await db.user.findUnique({ where: { id: req.params.id }, select: { councilId: true } });
      if (!learner) return res.status(404).json({ error: 'Learner not found' });
      if (councilId && learner.councilId !== councilId) {
        return res.status(403).json({ error: 'This learner belongs to another council.' });
      }

      const updated = await db.user.update({
        where: { id: req.params.id },
        data: { nczRegistrationNumber: data.nczRegistrationNumber },
        select: {
          id: true,
          fullName: true,
          email: true,
          nczRegistrationNumber: true,
          registrationNumber: true,
          professionalTitle: true,
          council: { select: { id: true, name: true, acronym: true, requiredPoints: true } },
          cadre: true,
          institution: true,
          province: true,
          district: true,
          subscriptionTier: true,
          isActive: true,
        },
      });
      return res.json(updated);
    } catch (err: any) {
      if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
      if (err?.code === 'P2002') return res.status(409).json({ error: 'Council registration number is already in use.' });
      return res.status(500).json({ error: 'Could not update learner' });
    }
});

router.get(
  '/compliance',
  requireAuth,
  requireRole('NCZ_OFFICER', 'COUNCIL_OFFICER', 'ADMIN'),
  async (req: AuthRequest, res) => {
    try {
    const year = parseInt((req.query.year as string) ?? String(new Date().getFullYear()), 10);
    const councilId = await getOfficerCouncilId(req);
    const requiredPoints = await getCouncilRequiredPoints(councilId);
    const learnerWhere: any = { role: 'LEARNER', isActive: true };
    if (councilId) learnerWhere.councilId = councilId;
    const totalLearners = await db.user.count({ where: learnerWhere });
    const learners = await db.user.findMany({
      where: learnerWhere,
      select: { id: true },
    });
    const learnerIds = learners.map((learner) => learner.id);

    const cpdTotals = learnerIds.length
      ? await db.cPDRecord.groupBy({
          by: ['learnerId'],
          where: { learnerId: { in: learnerIds }, cycleYear: year },
          _sum: { pointsEarned: true },
        })
      : [];

    const compliantCount = cpdTotals.filter((record) => (record._sum.pointsEarned ?? 0) >= requiredPoints).length;

    return res.json({
      year,
      totalLearners,
      compliantCount,
      nonCompliantCount: totalLearners - compliantCount,
      complianceRate: totalLearners ? Math.round((compliantCount / totalLearners) * 100) : 0,
    });
    } catch {
      return res.status(500).json({ error: 'Could not fetch compliance data' });
    }
});

router.get(
  '/export/csv',
  requireAuth,
  requireRole('NCZ_OFFICER', 'COUNCIL_OFFICER', 'ADMIN'),
  async (req: AuthRequest, res) => {
    try {
    const year = parseInt((req.query.year as string) ?? String(new Date().getFullYear()), 10);
    const councilId = await getOfficerCouncilId(req);
    const requiredPoints = await getCouncilRequiredPoints(councilId);
    const learnerWhere: any = { role: 'LEARNER', isActive: true };
    if (councilId) learnerWhere.councilId = councilId;
    const learners = await db.user.findMany({
      where: learnerWhere,
      select: {
        id: true,
        fullName: true,
        nczRegistrationNumber: true,
        registrationNumber: true,
        professionalTitle: true,
        council: { select: { acronym: true } },
        cadre: true,
        institution: true,
        province: true,
      },
      orderBy: { fullName: 'asc' },
    });

    const learnerIds = learners.map((learner) => learner.id);
    const cpdTotals = learnerIds.length
      ? await db.cPDRecord.groupBy({
          by: ['learnerId'],
          where: { learnerId: { in: learnerIds }, cycleYear: year },
          _sum: { pointsEarned: true },
        })
      : [];
    const pointsMap = Object.fromEntries(
      cpdTotals.map((record) => [record.learnerId, record._sum.pointsEarned ?? 0]),
    );

    const rows = [
      ['Name', 'Council', 'Registration Number', 'Professional Title', 'Institution', 'Province', 'CPD Points', 'Compliant', 'Year'],
      ...learners.map((learner) => [
        learner.fullName,
        learner.council?.acronym ?? '',
        learner.registrationNumber ?? learner.nczRegistrationNumber ?? '',
        learner.professionalTitle ?? learner.cadre ?? '',
        learner.institution ?? '',
        learner.province ?? '',
        String(pointsMap[learner.id] ?? 0),
        (pointsMap[learner.id] ?? 0) >= requiredPoints ? 'Yes' : 'No',
        String(year),
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="ncz-compliance-${year}.csv"`);
    return res.send(csv);
    } catch {
      return res.status(500).json({ error: 'Export failed' });
    }
});

router.get('/verify/:uuid', async (req, res) => {
  try {
    const cert = await db.certificate.findUnique({
      where: { certificateUuid: req.params.uuid },
      include: {
        learner: {
          select: { fullName: true, nczRegistrationNumber: true, cadre: true },
        },
      },
    });

    if (!cert) {
      return res.status(404).json({ error: 'Certificate not found', valid: false });
    }

    return res.json({
      valid: true,
      learnerId: cert.learnerId,
      learnerName: cert.learner.fullName,
      nczRegistrationNumber: cert.learner.nczRegistrationNumber,
      cadre: cert.learner.cadre,
      cycleYear: cert.cycleYear,
      totalPoints: cert.totalPoints,
      issuedAt: cert.issuedAt,
    });
  } catch {
    return res.status(500).json({ error: 'Verification failed' });
  }
});

router.post(
  '/sync/trigger',
  requireAuth,
  requireRole('NCZ_OFFICER', 'COUNCIL_OFFICER', 'ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const onlyFailed = req.query.onlyFailed === 'true';
      const result = await runNczSync(req.user?.id ?? 'manual', { onlyFailed });
      return res.json(result);
    } catch {
      return res.status(500).json({ error: 'Sync trigger failed' });
    }
  },
);

router.post(
  '/sync/retry/:id',
  requireAuth,
  requireRole('NCZ_OFFICER', 'COUNCIL_OFFICER', 'ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const result = await retryNczRecord(req.params.id, req.user?.id ?? 'manual');
      return res.json(result);
    } catch {
      return res.status(500).json({ error: 'Retry failed' });
    }
});

router.get('/sync/logs', requireAuth, requireRole('NCZ_OFFICER', 'COUNCIL_OFFICER', 'ADMIN'), async (_req, res) => {
  try {
    const logs = await db.nczSyncLog.findMany({
      orderBy: { syncedAt: 'desc' },
      take: 20,
    });
    return res.json(logs);
  } catch {
    return res.status(500).json({ error: 'Could not fetch sync logs' });
  }
});

router.get(
  '/sync/summary',
  requireAuth,
  requireRole('NCZ_OFFICER', 'COUNCIL_OFFICER', 'ADMIN'),
  async (_req, res) => {
    try {
    const [pending, blocked, failed, synced] = await Promise.all([
      db.cPDRecord.count({ where: { nczSyncStatus: 'PENDING' } }),
      db.cPDRecord.count({ where: { nczSyncStatus: 'BLOCKED_MISSING_NCZ' } }),
      db.cPDRecord.count({ where: { nczSyncStatus: 'FAILED' } }),
      db.cPDRecord.count({ where: { nczSyncStatus: 'SYNCED' } }),
    ]);
    const disabled = process.env.COUNCIL_SYNC_DISABLED === 'true';
    const configured = Boolean(
      (process.env.COUNCIL_SYNC_API_URL ?? process.env.NCZ_SYNC_API_URL) &&
      (process.env.COUNCIL_SYNC_API_KEY ?? process.env.NCZ_API_KEY),
    );
    const mode = disabled ? 'disabled' : configured ? 'live' : 'dry_run';
    return res.json({ pending, blocked, failed, synced, mode, configured });
    } catch {
      return res.status(500).json({ error: 'Could not fetch sync summary' });
    }
});

router.get(
  '/sync/blocked',
  requireAuth,
  requireRole('NCZ_OFFICER', 'COUNCIL_OFFICER', 'ADMIN'),
  async (req, res) => {
    try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200);
    const rows = await db.cPDRecord.findMany({
      where: { nczSyncStatus: 'BLOCKED_MISSING_NCZ', syncedToNcz: false },
      orderBy: { completedAt: 'desc' },
      take: limit,
      include: {
        learner: { select: { id: true, fullName: true, email: true, nczRegistrationNumber: true } },
        course: { select: { title: true } },
      },
    });
    return res.json({ records: rows });
    } catch {
      return res.status(500).json({ error: 'Could not fetch blocked records' });
    }
});

router.get(
  '/sync/failed',
  requireAuth,
  requireRole('NCZ_OFFICER', 'COUNCIL_OFFICER', 'ADMIN'),
  async (req, res) => {
    try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200);
    const rows = await db.cPDRecord.findMany({
      where: { nczSyncStatus: 'FAILED', syncedToNcz: false },
      orderBy: [{ nczLastAttemptAt: 'desc' }, { completedAt: 'desc' }],
      take: limit,
      include: {
        learner: { select: { id: true, fullName: true, email: true, nczRegistrationNumber: true } },
        course: { select: { title: true } },
      },
    });
    return res.json({ records: rows });
    } catch {
      return res.status(500).json({ error: 'Could not fetch failed records' });
    }
});

export default router;
