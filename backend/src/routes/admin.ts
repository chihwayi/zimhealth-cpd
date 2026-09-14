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
import { canAssignRole } from '../lib/roles';
import type { Prisma, Role } from '@prisma/client';

const router: ExpressRouter = Router();
const AVAILABLE_PROVIDERS = ['anthropic', 'openai', 'gemini', 'ollama'] as const;
const AVAILABLE_ROLES = ['PLATFORM_OWNER', 'COUNTRY_ADMIN', 'CONTENT_MANAGER', 'COUNCIL_OFFICER', 'LEARNER', 'HELPDESK'] as const;
const AVAILABLE_TIERS = ['FREE', 'STANDARD', 'INSTITUTION', 'DIASPORA'] as const;

// A COUNTRY_ADMIN only ever sees/touches: learners whose council is in their
// country, and CONTENT_MANAGER/HELPDESK accounts stamped with their own
// countryCode (set when that admin created them — see PATCH /users/:id).
// COUNCIL_OFFICER, COUNTRY_ADMIN, and PLATFORM_OWNER accounts are never
// reachable through this scope, regardless of country.
function countryScopeWhere(countryCode: string): Prisma.UserWhereInput {
  return {
    OR: [
      { role: 'LEARNER', council: { countryCode } },
      { role: { in: ['CONTENT_MANAGER', 'HELPDESK'] }, countryCode },
    ],
  };
}

async function isUserInCountryScope(userId: string, countryCode: string): Promise<boolean> {
  const match = await db.user.findFirst({
    where: { id: userId, ...countryScopeWhere(countryCode) },
    select: { id: true },
  });
  return Boolean(match);
}

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
  { tier: 'STANDARD', priceUsd: 10, label: 'Standard annual subscription' },
  { tier: 'INSTITUTION', priceUsd: 99, label: 'Institution seat bundle' },
  { tier: 'DIASPORA', priceUsd: 15, label: 'Diaspora annual subscription' },
];

function getConfiguredProviders(): string[] {
  const providers: string[] = [];
  if (process.env.ANTHROPIC_API_KEY) providers.push('anthropic');
  if (process.env.OPENAI_API_KEY) providers.push('openai');
  if (process.env.GEMINI_API_KEY) providers.push('gemini');
  if (process.env.OLLAMA_BASE_URL) providers.push('ollama');
  return providers;
}

router.get('/config/ai', requireAuth, requireRole('PLATFORM_OWNER'), async (_req, res) => {
  const provider = await getAIProvider();
  res.json({
    provider,
    availableProviders: AVAILABLE_PROVIDERS,
    configuredProviders: getConfiguredProviders(),
  });
});

router.get('/ai/health', requireAuth, requireRole('PLATFORM_OWNER'), async (_req, res) => {
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

    const lastSuccess = await db.auditLog.findFirst({
      where: { action: 'BOT_AI_TUTOR_SUCCESS' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });

    const avgLatencyMs = latencyCount ? Math.round(latencyTotal / latencyCount) : null;
    return res.json({
      activeProvider: provider,
      configuredProviders: getConfiguredProviders(),
      anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
      claudeConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
      fallbackProvidersEnabled: getConfiguredProviders().filter((p) => p !== 'anthropic').length > 0,
      windowHours: 24,
      requests,
      cacheHits,
      failures,
      paywalls,
      fallbacks,
      avgLatencyMs,
      lastFailureAt,
      lastFallbackAt,
      lastSuccessAt: lastSuccess?.createdAt.toISOString() ?? null,
    });
  } catch {
    return res.status(500).json({ error: 'Could not load AI health' });
  }
});

router.get('/telemetry/summary', requireAuth, requireRole('PLATFORM_OWNER'), async (_req, res) => {
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

router.patch('/config/ai', requireAuth, requireRole('PLATFORM_OWNER'), async (req: AuthRequest, res) => {
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

router.get('/config/system', requireAuth, requireRole('PLATFORM_OWNER'), async (_req, res) => {
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
    councilSyncSchedule: process.env.COUNCIL_SYNC_SCHEDULE ?? process.env.NCZ_SYNC_SCHEDULE ?? '0 2 * * *',
    cpdRules: REQUIRED_POINTS,
    activityPoints: ACTIVITY_POINTS,
    subscriptionPricing: SUBSCRIPTION_PRICING,
  });
});

router.patch('/config/system', requireAuth, requireRole('PLATFORM_OWNER'), async (req: AuthRequest, res) => {
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

router.get('/users', requireAuth, requireRole('PLATFORM_OWNER', 'COUNTRY_ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { search, role, approved, page = '1', limit = '25' } = req.query as Record<string, string>;
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
    const skip = (pageNumber - 1) * pageSize;

    const where: Prisma.UserWhereInput = {};
    if (role) where.role = role as Role;
    if (approved === 'true') where.isApproved = true;
    if (approved === 'false') where.isApproved = false;

    const and: Prisma.UserWhereInput[] = [];
    if (search) {
      and.push({
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { nczRegistrationNumber: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (req.user!.role === 'COUNTRY_ADMIN') {
      const actor = await db.user.findUnique({ where: { id: req.user!.id }, select: { countryCode: true } });
      if (!actor?.countryCode) {
        return res.status(400).json({ error: 'Country Admin is not assigned to a country.' });
      }
      and.push(countryScopeWhere(actor.countryCode));
    }

    if (and.length) where.AND = and;

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

router.patch('/users/:id', requireAuth, requireRole('PLATFORM_OWNER', 'COUNTRY_ADMIN'), async (req: AuthRequest, res) => {
  try {
    const data = UpdateUserSchema.parse(req.body);
    const actorRole = req.user!.role as Role;

    if (req.params.id === req.user?.id && data.role && data.role !== actorRole) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    if (req.params.id === req.user?.id && data.isActive === false) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    let countryCodeStamp: string | undefined;
    if (actorRole === 'COUNTRY_ADMIN') {
      const actor = await db.user.findUnique({ where: { id: req.user!.id }, select: { countryCode: true } });
      if (!actor?.countryCode) {
        return res.status(400).json({ error: 'Country Admin is not assigned to a country.' });
      }
      countryCodeStamp = actor.countryCode;

      // Country Admin may only touch users already inside their own country
      // scope (or a brand-new role assignment they're about to create — see
      // canAssignRole below, which independently caps what role they can grant).
      const target = await db.user.findUnique({ where: { id: req.params.id }, select: { role: true } });
      if (!target) return res.status(404).json({ error: 'User not found' });
      const inScope = target.role === 'LEARNER' || target.role === 'CONTENT_MANAGER' || target.role === 'HELPDESK'
        ? await isUserInCountryScope(req.params.id, actor.countryCode)
        : false;
      if (!inScope) {
        return res.status(403).json({ error: 'This user is outside your country scope.' });
      }
    }

    if (data.role && !canAssignRole(actorRole, data.role as Role)) {
      return res.status(403).json({ error: `${actorRole} cannot assign the ${data.role} role.` });
    }

    const updated = await db.user.update({
      where: { id: req.params.id },
      data: {
        ...data,
        // Country Admin-created/managed staff accounts are stamped with the
        // admin's own country so they remain in that admin's scope going
        // forward (LEARNER country is always derived from council instead).
        ...(countryCodeStamp && data.role && data.role !== 'LEARNER' ? { countryCode: countryCodeStamp } : {}),
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
          action: data.role ? 'ROLE_ASSIGNED' : 'ADMIN_USER_UPDATED',
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

router.delete('/users/:id', requireAuth, requireRole('PLATFORM_OWNER', 'COUNTRY_ADMIN'), async (req: AuthRequest, res) => {
  if (req.params.id === req.user?.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  try {
    if (req.user!.role === 'COUNTRY_ADMIN') {
      const actor = await db.user.findUnique({ where: { id: req.user!.id }, select: { countryCode: true } });
      if (!actor?.countryCode || !(await isUserInCountryScope(req.params.id, actor.countryCode))) {
        return res.status(403).json({ error: 'This user is outside your country scope.' });
      }
    }

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

router.get('/courses/pending', requireAuth, requireRole('PLATFORM_OWNER'), async (_req, res) => {
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

router.get('/stats', requireAuth, requireRole('PLATFORM_OWNER'), async (_req, res) => {
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

router.get('/audit', requireAuth, requireRole('PLATFORM_OWNER'), async (req, res) => {
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

router.get('/analytics/monthly', requireAuth, requireRole('PLATFORM_OWNER'), async (_req, res) => {
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

router.get('/analytics/subscriptions', requireAuth, requireRole('PLATFORM_OWNER'), async (_req, res) => {
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

router.get('/subscriptions/summary', requireAuth, requireRole('PLATFORM_OWNER'), async (_req, res) => {
  try {
    const now = new Date();
    const [activeTotal, expiringSoon, byGateway, byTier] = await Promise.all([
      db.subscription.count({ where: { expiresAt: { gte: now } } }),
      db.subscription.count({
        where: {
          expiresAt: {
            gte: now,
            lte: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30),
          },
        },
      }),
      db.subscription.groupBy({
        by: ['gateway'],
        _count: true,
      }),
      db.subscription.groupBy({
        by: ['tier'],
        _count: true,
      }),
    ]);

    return res.json({
      activeTotal,
      expiringSoon,
      byGateway: byGateway.map((group) => ({
        gateway: group.gateway ?? 'unknown',
        count: group._count,
      })),
      byTier: byTier.map((group) => ({
        tier: group.tier,
        count: group._count,
      })),
    });
  } catch {
    return res.status(500).json({ error: 'Could not fetch subscription summary' });
  }
});

router.get('/subscriptions/recent', requireAuth, requireRole('PLATFORM_OWNER'), async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '20'), 10) || 20, 1), 100);
    const subscriptions = await db.subscription.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        tier: true,
        gateway: true,
        paymentRef: true,
        startsAt: true,
        expiresAt: true,
        createdAt: true,
        learnerId: true,
      },
    });

    const learnerIds = subscriptions.map((subscription) => subscription.learnerId);
    const learners = learnerIds.length
      ? await db.user.findMany({
          where: { id: { in: learnerIds } },
          select: { id: true, fullName: true, email: true },
        })
      : [];
    const learnerMap = new Map(learners.map((learner) => [learner.id, learner]));

    return res.json({
      subscriptions: subscriptions.map((subscription) => ({
        ...subscription,
        learner: learnerMap.get(subscription.learnerId) ?? null,
      })),
    });
  } catch {
    return res.status(500).json({ error: 'Could not fetch recent subscriptions' });
  }
});

export default router;
