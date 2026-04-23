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
        include: { course: { select: { title: true, cpdPoints: true } } },
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

    return res.json({ learner, records, certificates });
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
      if (err?.code === 'P2002') return res.status(409).json({ error: 'NCZ registration number is already in use.' });
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
    return res.json({ pending, blocked, failed, synced });
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
