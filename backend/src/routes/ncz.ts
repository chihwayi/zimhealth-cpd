import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { db } from '../lib/db';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { runNczSync } from '../services/ncz-sync';
import type { AuthRequest } from '../middleware/auth.middleware';

const router: ExpressRouter = Router();
const REQUIRED_POINTS = 12;

router.get('/learners', requireAuth, requireRole('NCZ_OFFICER', 'ADMIN'), async (req, res) => {
  try {
    const {
      search,
      cadre,
      institution,
      province,
      district,
      page = '1',
      limit = '25',
    } = req.query as Record<string, string>;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
    const skip = (pageNumber - 1) * pageSize;

    const where: Record<string, unknown> = { role: 'LEARNER' };
    if (cadre) where.cadre = cadre;
    if (institution) where.institution = { contains: institution, mode: 'insensitive' };
    if (province) where.province = province;
    if (district) where.district = { contains: district, mode: 'insensitive' };
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { nczRegistrationNumber: { contains: search, mode: 'insensitive' } },
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
        isCompliant: currentYearPoints >= REQUIRED_POINTS,
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

router.get('/learners/:id/history', requireAuth, requireRole('NCZ_OFFICER', 'ADMIN'), async (req, res) => {
  try {
    const [learner, records, certificates] = await Promise.all([
      db.user.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          fullName: true,
          email: true,
          nczRegistrationNumber: true,
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

    return res.json({ learner, records, certificates });
  } catch {
    return res.status(500).json({ error: 'Could not fetch learner history' });
  }
});

router.get('/compliance', requireAuth, requireRole('NCZ_OFFICER', 'ADMIN'), async (req, res) => {
  try {
    const year = parseInt((req.query.year as string) ?? String(new Date().getFullYear()), 10);
    const totalLearners = await db.user.count({ where: { role: 'LEARNER', isActive: true } });
    const learners = await db.user.findMany({
      where: { role: 'LEARNER', isActive: true },
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

    const compliantCount = cpdTotals.filter((record) => (record._sum.pointsEarned ?? 0) >= REQUIRED_POINTS).length;

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

router.get('/export/csv', requireAuth, requireRole('NCZ_OFFICER', 'ADMIN'), async (req, res) => {
  try {
    const year = parseInt((req.query.year as string) ?? String(new Date().getFullYear()), 10);
    const learners = await db.user.findMany({
      where: { role: 'LEARNER', isActive: true },
      select: {
        id: true,
        fullName: true,
        nczRegistrationNumber: true,
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
      ['Name', 'NCZ Reg Number', 'Cadre', 'Institution', 'Province', 'CPD Points', 'Compliant', 'Year'],
      ...learners.map((learner) => [
        learner.fullName,
        learner.nczRegistrationNumber ?? '',
        learner.cadre ?? '',
        learner.institution ?? '',
        learner.province ?? '',
        String(pointsMap[learner.id] ?? 0),
        (pointsMap[learner.id] ?? 0) >= REQUIRED_POINTS ? 'Yes' : 'No',
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
  requireRole('NCZ_OFFICER', 'ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const result = await runNczSync(req.user?.id ?? 'manual');
      return res.json(result);
    } catch {
      return res.status(500).json({ error: 'Sync trigger failed' });
    }
  },
);

router.get('/sync/logs', requireAuth, requireRole('NCZ_OFFICER', 'ADMIN'), async (_req, res) => {
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

export default router;
