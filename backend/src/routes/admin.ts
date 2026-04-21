import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import {
  getAIProvider,
  getMaintenanceMode,
  setAIProvider,
  setMaintenanceMode,
  getAIFeaturesEnabled,
  setAIFeaturesEnabled,
} from '../lib/redis';
import { ACTIVITY_POINTS, REQUIRED_POINTS } from '../services/cpd-rules';
import type { AuthRequest } from '../middleware/auth.middleware';

const router: ExpressRouter = Router();
const AVAILABLE_PROVIDERS = ['anthropic', 'openai', 'gemini', 'ollama'] as const;
const AVAILABLE_ROLES = ['ADMIN', 'CONTENT_MANAGER', 'NCZ_OFFICER', 'LEARNER'] as const;
const AVAILABLE_TIERS = ['FREE', 'STANDARD', 'INSTITUTION', 'DIASPORA'] as const;

const UpdateUserSchema = z.object({
  role: z.enum(AVAILABLE_ROLES).optional(),
  isActive: z.boolean().optional(),
  isApproved: z.boolean().optional(),
  subscriptionTier: z.enum(AVAILABLE_TIERS).optional(),
  subscriptionExpiresAt: z.string().datetime().nullable().optional(),
});

const UpdateSystemConfigSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  aiFeaturesEnabled: z.boolean().optional(),
});

const SUBSCRIPTION_PRICING = [
  { tier: 'FREE', priceUsd: 0, label: 'Free learner access' },
  { tier: 'STANDARD', priceUsd: 10, label: 'Standard monthly subscription' },
  { tier: 'INSTITUTION', priceUsd: 99, label: 'Institution seat bundle' },
  { tier: 'DIASPORA', priceUsd: 15, label: 'Diaspora learner subscription' },
];

function getConfiguredProviders(): string[] {
  const providers: string[] = [];
  if (process.env.ANTHROPIC_API_KEY) providers.push('anthropic');
  if (process.env.OPENAI_API_KEY) providers.push('openai');
  if (process.env.GEMINI_API_KEY) providers.push('gemini');
  if (process.env.OLLAMA_BASE_URL) providers.push('ollama');
  return providers;
}

router.get('/config/ai', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  const provider = await getAIProvider();
  res.json({
    provider,
    availableProviders: AVAILABLE_PROVIDERS,
    configuredProviders: getConfiguredProviders(),
  });
});

router.get('/ai/health', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const provider = await getAIProvider();
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24);
    const events = await db.auditLog.findMany({
      where: {
        action: { startsWith: 'BOT_AI_TUTOR_' },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { action: true, meta: true, createdAt: true },
    });

    let requests = 0;
    let cacheHits = 0;
    let failures = 0;
    let paywalls = 0;
    let fallbacks = 0;
    let latencyTotal = 0;
    let latencyCount = 0;
    let lastFailureAt: string | null = null;
    let lastFallbackAt: string | null = null;

    for (const e of events) {
      if (e.action === 'BOT_AI_TUTOR_REQUEST') requests++;
      if (e.action === 'BOT_AI_TUTOR_CACHE_HIT') cacheHits++;
      if (e.action === 'BOT_AI_TUTOR_FAILURE') {
        failures++;
        if (!lastFailureAt) lastFailureAt = e.createdAt.toISOString();
      }
      if (e.action === 'BOT_AI_TUTOR_PAYWALL') paywalls++;
      const meta = (e.meta ?? null) as any;
      if (meta?.fallbackUsed) {
        fallbacks++;
        if (!lastFallbackAt) lastFallbackAt = e.createdAt.toISOString();
      }
      if (typeof meta?.latencyMs === 'number') {
        latencyTotal += meta.latencyMs;
        latencyCount++;
      }
    }

    const avgLatencyMs = latencyCount ? Math.round(latencyTotal / latencyCount) : null;
    return res.json({
      activeProvider: provider,
      configuredProviders: getConfiguredProviders(),
      windowHours: 24,
      requests,
      cacheHits,
      failures,
      paywalls,
      fallbacks,
      avgLatencyMs,
      lastFailureAt,
      lastFallbackAt,
    });
  } catch {
    return res.status(500).json({ error: 'Could not load AI health' });
  }
});

router.get('/telemetry/summary', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const since24h = new Date(Date.now() - 1000 * 60 * 60 * 24);
    const [enrollmentsCompleted, enrollmentsInProgress, quizAttempts24h, offlineDownloads24h, botTutorEvents24h] = await Promise.all([
      db.enrollment.count({ where: { completedAt: { not: null } } }),
      db.enrollment.count({ where: { completedAt: null } }),
      db.quizAttempt.count({ where: { completedAt: { gte: since24h } } }),
      db.auditLog.count({ where: { action: 'WEB_OFFLINE_MODULE_DOWNLOADED', createdAt: { gte: since24h } } }),
      db.auditLog.count({ where: { action: { startsWith: 'BOT_AI_TUTOR_' }, createdAt: { gte: since24h } } }),
    ]);

    return res.json({
      windowHours: 24,
      enrollments: { inProgress: enrollmentsInProgress, completed: enrollmentsCompleted },
      quizAttempts24h,
      offlineDownloads24h,
      botAiTutorEvents24h: botTutorEvents24h,
    });
  } catch {
    return res.status(500).json({ error: 'Could not load telemetry summary' });
  }
});

router.patch('/config/ai', requireAuth, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const { provider } = req.body as { provider?: string };

  if (!provider || !AVAILABLE_PROVIDERS.includes(provider as (typeof AVAILABLE_PROVIDERS)[number])) {
    return res.status(400).json({ error: 'Invalid provider' });
  }

  await setAIProvider(provider);
  if (req.user) {
    await db.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'ADMIN_AI_PROVIDER_UPDATED',
        entityType: 'SystemConfig',
        entityId: 'ai-provider',
        meta: { provider },
      },
    });
  }
  return res.json({ provider });
});

router.get('/config/public', async (_req, res) => {
  const [maintenanceMode, aiFeaturesEnabled] = await Promise.all([
    getMaintenanceMode(),
    getAIFeaturesEnabled(),
  ]);
  res.json({ maintenanceMode, aiFeaturesEnabled });
});

router.get('/config/system', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  const [provider, maintenanceMode, aiFeaturesEnabled] = await Promise.all([
    getAIProvider(),
    getMaintenanceMode(),
    getAIFeaturesEnabled(),
  ]);
  res.json({
    aiProvider: provider,
    availableProviders: AVAILABLE_PROVIDERS,
    configuredProviders: getConfiguredProviders(),
    maintenanceMode,
    aiFeaturesEnabled,
    nczSyncSchedule: process.env.NCZ_SYNC_SCHEDULE ?? '0 2 * * *',
    cpdRules: REQUIRED_POINTS,
    activityPoints: ACTIVITY_POINTS,
    subscriptionPricing: SUBSCRIPTION_PRICING,
  });
});

router.patch('/config/system', requireAuth, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const data = UpdateSystemConfigSchema.parse(req.body);

    if (typeof data.maintenanceMode === 'boolean') {
      await setMaintenanceMode(data.maintenanceMode);
    }
    if (typeof data.aiFeaturesEnabled === 'boolean') {
      await setAIFeaturesEnabled(data.aiFeaturesEnabled);
    }

    if (req.user) {
      await db.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'ADMIN_SYSTEM_CONFIG_UPDATED',
          entityType: 'SystemConfig',
          entityId: 'system',
          meta: data,
        },
      });
    }

    return res.json({
      maintenanceMode: await getMaintenanceMode(),
      aiFeaturesEnabled: await getAIFeaturesEnabled(),
    });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'Could not update system config' });
  }
});

router.get('/users', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { search, role, page = '1', limit = '25' } = req.query as Record<string, string>;
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
    const skip = (pageNumber - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { nczRegistrationNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          cadre: true,
          subscriptionTier: true,
          subscriptionExpiresAt: true,
          isActive: true,
          isApproved: true,
          institution: true,
          createdAt: true,
          _count: { select: { cpdRecords: true } },
        },
      }),
      db.user.count({ where }),
    ]);

    return res.json({ users, total, page: pageNumber, totalPages: Math.ceil(total / pageSize) });
  } catch {
    return res.status(500).json({ error: 'Could not fetch users' });
  }
});

router.patch('/users/:id', requireAuth, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const data = UpdateUserSchema.parse(req.body);

    if (req.params.id === req.user?.id && data.role && data.role !== 'ADMIN') {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    if (req.params.id === req.user?.id && data.isActive === false) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    const updated = await db.user.update({
      where: { id: req.params.id },
      data: {
        ...data,
        subscriptionExpiresAt:
          data.subscriptionExpiresAt === undefined
            ? undefined
            : data.subscriptionExpiresAt
              ? new Date(data.subscriptionExpiresAt)
              : null,
      },
    });

    if (req.user) {
      await db.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'ADMIN_USER_UPDATED',
          entityType: 'User',
          entityId: req.params.id,
          meta: data,
        },
      });
    }

    return res.json(updated);
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'Could not update user' });
  }
});

router.delete('/users/:id', requireAuth, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  if (req.params.id === req.user?.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  try {
    await db.user.update({ where: { id: req.params.id }, data: { isActive: false } });
    if (req.user) {
      await db.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'ADMIN_USER_DEACTIVATED',
          entityType: 'User',
          entityId: req.params.id,
        },
      });
    }
    return res.json({ message: 'User deactivated' });
  } catch {
    return res.status(500).json({ error: 'Could not deactivate user' });
  }
});

router.get('/courses/pending', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const courses = await db.course.findMany({
      where: { status: 'UNDER_REVIEW' },
      orderBy: { updatedAt: 'asc' },
      include: {
        creator: { select: { fullName: true, email: true } },
        _count: { select: { modules: true } },
      },
    });
    return res.json(courses);
  } catch {
    return res.status(500).json({ error: 'Could not fetch pending courses' });
  }
});

router.get('/stats', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const year = new Date().getFullYear();
    const [totalLearners, activeSubs, publishedCourses, pendingApprovals, totalPointsResult] =
      await Promise.all([
        db.user.count({ where: { role: 'LEARNER', isActive: true } }),
        db.user.count({
          where: {
            role: 'LEARNER',
            subscriptionTier: { not: 'FREE' },
            subscriptionExpiresAt: { gte: new Date() },
          },
        }),
        db.course.count({ where: { status: 'PUBLISHED' } }),
        db.course.count({ where: { status: 'UNDER_REVIEW' } }),
        db.cPDRecord.aggregate({ where: { cycleYear: year }, _sum: { pointsEarned: true } }),
      ]);

    return res.json({
      totalLearners,
      activeSubs,
      publishedCourses,
      pendingApprovals,
      totalPointsIssuedThisYear: totalPointsResult._sum.pointsEarned ?? 0,
    });
  } catch {
    return res.status(500).json({ error: 'Could not fetch admin stats' });
  }
});

router.get('/audit', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { page = '1' } = req.query as Record<string, string>;
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (pageNumber - 1) * 50;
    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        skip,
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { fullName: true, email: true } } },
      }),
      db.auditLog.count(),
    ]);

    return res.json({ logs, total, page: pageNumber, totalPages: Math.ceil(total / 50) });
  } catch {
    return res.status(500).json({ error: 'Could not fetch audit logs' });
  }
});

router.get('/analytics/monthly', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const months: Array<{ month: string; learners: number; points: number }> = [];

    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

      const [learnerCount, pointsResult] = await Promise.all([
        db.enrollment
          .groupBy({
            by: ['learnerId'],
            where: { lastAccessAt: { gte: start, lte: end } },
          })
          .then((rows) => rows.length),
        db.cPDRecord.aggregate({
          where: { completedAt: { gte: start, lte: end } },
          _sum: { pointsEarned: true },
        }),
      ]);

      months.push({
        month: start.toLocaleDateString('en-ZW', { month: 'short', year: '2-digit' }),
        learners: learnerCount,
        points: pointsResult._sum.pointsEarned ?? 0,
      });
    }

    return res.json(months);
  } catch {
    return res.status(500).json({ error: 'Could not fetch analytics' });
  }
});

router.get('/analytics/subscriptions', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const groups = await db.user.groupBy({
      by: ['subscriptionTier'],
      where: { role: 'LEARNER', isActive: true },
      _count: true,
    });

    const allTiers = AVAILABLE_TIERS.map((tier) => ({
      tier,
      count: groups.find((group) => group.subscriptionTier === tier)?._count ?? 0,
    }));

    return res.json(allTiers);
  } catch {
    return res.status(500).json({ error: 'Could not fetch subscription analytics' });
  }
});

export default router;
