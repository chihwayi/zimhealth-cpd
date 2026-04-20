# Sprints 21–23 — Admin Portal & AI Features

---

# Sprint 21 — Admin Portal — Core

**Phase:** 5 — Admin Portal
**Duration:** 1 week
**Goal:** Full System Admin portal — user management, course approval workflow, platform settings panel.

---

## Design Reference
See `docs/design/DESIGN_SYSTEM.md` → Section 7.6 "Admin Dashboard"
- Rose-600 sidebar accent
- 4-stat hero row
- Pending approvals table is the primary action item

---

## Tasks

### T21.1 — Admin user management routes

EDIT FILE: `backend/src/routes/admin.ts`
Expand with:
```typescript
import { db } from '../lib/db';
import { z } from 'zod';

// GET /api/admin/users — paginated user list with filters
router.get('/users', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { search, role, page = '1', limit = '25' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = {};
    if (role) where.role = role;
    if (search) where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { nczRegistrationNumber: { contains: search, mode: 'insensitive' } },
    ];

    const [users, total] = await Promise.all([
      db.user.findMany({
        where, skip, take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, fullName: true, email: true, role: true, cadre: true,
          subscriptionTier: true, isActive: true, isApproved: true,
          institution: true, createdAt: true,
          _count: { select: { cpdRecords: true } },
        },
      }),
      db.user.count({ where }),
    ]);

    res.json({ users, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch {
    res.status(500).json({ error: 'Could not fetch users' });
  }
});

// PATCH /api/admin/users/:id — update user role, active status, subscription
const UpdateUserSchema = z.object({
  role: z.enum(['ADMIN','CONTENT_MANAGER','NCZ_OFFICER','LEARNER']).optional(),
  isActive: z.boolean().optional(),
  isApproved: z.boolean().optional(),
  subscriptionTier: z.enum(['FREE','STANDARD','INSTITUTION','DIASPORA']).optional(),
  subscriptionExpiresAt: z.string().datetime().optional(),
});

router.patch('/users/:id', requireAuth, requireRole('ADMIN'), async (req: any, res) => {
  try {
    const data = UpdateUserSchema.parse(req.body);

    // Prevent admin from demoting themselves
    if (req.params.id === req.user.id && data.role && data.role !== 'ADMIN') {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    const updated = await db.user.update({ where: { id: req.params.id }, data });

    // Audit log
    await db.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'ADMIN_USER_UPDATED',
        entityType: 'User',
        entityId: req.params.id,
        meta: data,
      },
    });

    res.json(updated);
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: 'Could not update user' });
  }
});

// DELETE /api/admin/users/:id — soft delete (sets isActive: false)
router.delete('/users/:id', requireAuth, requireRole('ADMIN'), async (req: any, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
  try {
    await db.user.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'User deactivated' });
  } catch {
    res.status(500).json({ error: 'Could not deactivate user' });
  }
});

// GET /api/admin/courses/pending — courses awaiting approval
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
    res.json(courses);
  } catch {
    res.status(500).json({ error: 'Could not fetch pending courses' });
  }
});

// GET /api/admin/stats — platform-wide stats for dashboard
router.get('/stats', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const year = new Date().getFullYear();
    const [totalLearners, activeSubs, publishedCourses, pendingApprovals, totalPointsResult] = await Promise.all([
      db.user.count({ where: { role: 'LEARNER', isActive: true } }),
      db.user.count({ where: { role: 'LEARNER', subscriptionTier: { not: 'FREE' }, subscriptionExpiresAt: { gte: new Date() } } }),
      db.course.count({ where: { status: 'PUBLISHED' } }),
      db.course.count({ where: { status: 'UNDER_REVIEW' } }),
      db.cPDRecord.aggregate({ where: { cycleYear: year }, _sum: { pointsEarned: true } }),
    ]);

    res.json({
      totalLearners,
      activeSubs,
      publishedCourses,
      pendingApprovals,
      totalPointsIssuedThisYear: totalPointsResult._sum.pointsEarned ?? 0,
    });
  } catch {
    res.status(500).json({ error: 'Could not fetch admin stats' });
  }
});

// GET /api/admin/audit — audit log (paginated)
router.get('/audit', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { page = '1' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * 50;
    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        skip, take: 50,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { fullName: true, email: true } } },
      }),
      db.auditLog.count(),
    ]);
    res.json({ logs, total, totalPages: Math.ceil(total / 50) });
  } catch {
    res.status(500).json({ error: 'Could not fetch audit logs' });
  }
});
```

---

### T21.2 — Admin Dashboard page

EDIT FILE: `apps/web/src/pages/admin/AdminDashboard.tsx`
Replace stub with full dashboard:

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Users, BookOpen, Award, Clock, CheckCircle, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { StatCard } from '../../components/ui/StatCard';

interface AdminStats {
  totalLearners: number; activeSubs: number; publishedCourses: number;
  pendingApprovals: number; totalPointsIssuedThisYear: number;
}
interface PendingCourse {
  id: string; title: string; cpdPoints: number; status: string;
  creator: { fullName: string; email: string };
  _count: { modules: number };
  updatedAt: string;
}

export default function AdminDashboard() {
  const qc = useQueryClient();
  const { data: stats } = useQuery<AdminStats>({ queryKey: ['admin-stats'], queryFn: () => api.get('/api/admin/stats') });
  const { data: pending } = useQuery<PendingCourse[]>({ queryKey: ['pending-courses'], queryFn: () => api.get('/api/admin/courses/pending') });

  const approveMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'APPROVE' | 'REJECT' }) =>
      api.post(`/api/courses/${id}/approve`, { action }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pending-courses'] }); qc.invalidateQueries({ queryKey: ['admin-stats'] }); },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="text-slate-500 mt-1">NursePro CPD — System Administration</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Learners" value={stats?.totalLearners ?? '–'} icon={<Users size={20} />} accent="teal" />
        <StatCard title="Active Subscriptions" value={stats?.activeSubs ?? '–'} icon={<Award size={20} />} accent="green" />
        <StatCard title="Published Courses" value={stats?.publishedCourses ?? '–'} icon={<BookOpen size={20} />} accent="blue" />
        <StatCard title="Pending Approvals" value={stats?.pendingApprovals ?? '–'} icon={<Clock size={20} />} accent="amber" />
      </div>

      {/* Pending Course Approvals */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Pending Course Approvals</h2>
          <Link to="/admin/courses" className="text-sm text-primary-600 hover:underline">View all →</Link>
        </div>
        {!pending?.length ? (
          <div className="p-8 text-center text-slate-400 text-sm">No courses pending review. ✅</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Course', 'Creator', 'Points', 'Modules', 'Submitted', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pending.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900 max-w-48 truncate">{c.title}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{c.creator.fullName}</td>
                  <td className="px-4 py-3">{c.cpdPoints}</td>
                  <td className="px-4 py-3">{c._count.modules}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{new Date(c.updatedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 flex items-center gap-2">
                    <button
                      onClick={() => approveMutation.mutate({ id: c.id, action: 'APPROVE' })}
                      className="flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 px-2.5 py-1.5 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      <CheckCircle size={12} /> Approve
                    </button>
                    <button
                      onClick={() => approveMutation.mutate({ id: c.id, action: 'REJECT' })}
                      className="flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-200 px-2.5 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      <XCircle size={12} /> Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

---

## Validation Checklist (S21)

- [ ] Admin dashboard shows correct stat cards from API
- [ ] Pending course approvals table loads correctly
- [ ] "Approve" button changes course status to PUBLISHED
- [ ] "Reject" button changes course status back to DRAFT
- [ ] `GET /api/admin/users` returns paginated user list
- [ ] `PATCH /api/admin/users/:id` can toggle isActive and change role
- [ ] Admin cannot change their own role
- [ ] `GET /api/admin/audit` returns audit log entries
- [ ] All admin actions create audit log entries

---

# Sprint 22 — Admin Portal — Analytics & System Config

**Phase:** 5
**Duration:** 1 week
**Goal:** Platform-wide analytics charts and the system configuration panel (AI provider switcher, payment gateway config, CPD rules).

---

## Tasks

### T22.1 — Analytics endpoint (time series)

EDIT FILE: `backend/src/routes/admin.ts`
Add:
```typescript
// GET /api/admin/analytics/monthly — monthly learner activity (last 6 months)
router.get('/analytics/monthly', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const months: Array<{ month: string; learners: number; points: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

      const [learnerCount, pointsResult] = await Promise.all([
        db.enrollment.groupBy({
          by: ['learnerId'],
          where: { lastAccessAt: { gte: start, lte: end } },
          _count: true,
        }).then((r) => r.length),
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
    res.json(months);
  } catch {
    res.status(500).json({ error: 'Could not fetch analytics' });
  }
});
```

### T22.2 — System Config panel

Create `apps/web/src/pages/admin/SystemConfig.tsx`:

Sections:
1. **AI Provider** — dropdown to select active AI provider (calls PATCH /api/admin/config/ai). Shows current provider. Shows which providers have API keys configured.
2. **CPD Rules** — read-only display of points required per cadre. "Edit" button (future feature — placeholder for now).
3. **Subscription Pricing** — read-only display of tiers and prices. 
4. **Maintenance Mode** — toggle switch (stores in Redis, app checks on load).
5. **NCZ Sync Schedule** — displays current cron expression. Link to sync logs.

### T22.3 — Admin Analytics page

Create `apps/web/src/pages/admin/AdminAnalytics.tsx` using Recharts:
- `LineChart` — Monthly Active Learners (last 6 months)
- `BarChart` — CPD Points Distributed per month
- `PieChart` — Subscription tier breakdown (Free/Standard/Diaspora)

---

## Validation Checklist (S22)

- [ ] Admin analytics page renders all 3 charts with real data
- [ ] AI provider selector shows current provider and allows switching
- [ ] Changing AI provider updates Redis and is reflected in bot behaviour
- [ ] Monthly active learners chart shows data from API

---

# Sprint 23 — AI Features — Adaptive Learning & Smart Reminders

**Phase:** 5
**Duration:** 1 week
**Goal:** AI-powered course recommendations on the learner dashboard + smart personalised renewal reminders via WhatsApp/email.

---

## Tasks

### T23.1 — Adaptive learning recommendations endpoint

CREATE FILE: `backend/src/services/adaptive-learning.ts`
```typescript
import { AIClient, SYSTEM_PROMPTS, type AIProviderConfig } from '@nursepro/ai-client';
import { db } from '../lib/db';
import { redis } from '../lib/redis';
import { getLearnerCPDSummary } from './cpd-engine';

const CACHE_TTL = 60 * 60 * 12; // 12 hours

export async function getRecommendations(learnerId: string): Promise<{
  courseIds: string[]; explanations: Record<string, string>;
}> {
  const cacheKey = `ai:recs:${learnerId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // Gather learner context
  const [learner, summary, completedEnrollments] = await Promise.all([
    db.user.findUnique({ where: { id: learnerId }, select: { cadre: true, specialtyArea: true } as any }),
    getLearnerCPDSummary(learnerId),
    db.enrollment.findMany({
      where: { learnerId, completedAt: { not: null } },
      select: { courseId: true, course: { select: { title: true, category: true, tags: true } } },
      take: 20,
    }),
  ]);

  if (completedEnrollments.length < 3) {
    // Not enough data — return empty (show popular courses instead)
    return { courseIds: [], explanations: {} };
  }

  // Get available courses not yet enrolled in
  const enrolledIds = await db.enrollment.findMany({
    where: { learnerId },
    select: { courseId: true },
  }).then((r) => r.map((e) => e.courseId));

  const availableCourses = await db.course.findMany({
    where: { status: 'PUBLISHED', id: { notIn: enrolledIds } },
    select: { id: true, title: true, category: true, tags: true, cpdPoints: true },
    take: 20,
  });

  if (!availableCourses.length) return { courseIds: [], explanations: {} };

  const config: AIProviderConfig = {
    anthropic: process.env.ANTHROPIC_API_KEY ? { apiKey: process.env.ANTHROPIC_API_KEY, defaultModel: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6' } : undefined,
    openai: process.env.OPENAI_API_KEY ? { apiKey: process.env.OPENAI_API_KEY, defaultModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini' } : undefined,
    gemini: process.env.GEMINI_API_KEY ? { apiKey: process.env.GEMINI_API_KEY, defaultModel: process.env.GEMINI_MODEL ?? 'gemini-1.5-pro' } : undefined,
    ollama: process.env.OLLAMA_BASE_URL ? { baseUrl: process.env.OLLAMA_BASE_URL, defaultModel: process.env.OLLAMA_MODEL ?? 'llama3' } : undefined,
  };
  const ai = new AIClient(config);

  const prompt = `Learner profile:
- Cadre: ${(learner as any)?.cadre ?? 'NURSE'}
- CPD Points: ${summary.totalPoints}/${summary.requiredPoints} (${summary.percentComplete}% complete)
- Days to renewal: ${Math.ceil((new Date(new Date().getFullYear(), 11, 31).getTime() - Date.now()) / 86400000)}
- Completed courses: ${completedEnrollments.map((e: any) => e.course.title).join(', ')}

Available courses:
${availableCourses.map((c) => `- ${c.id}: "${c.title}" (${c.category}, ${c.cpdPoints} pts)`).join('\n')}

Return a JSON object:
{ "recommendations": [ { "courseId": "...", "reason": "short reason under 20 words" } ] }
Order by highest value for this learner first. Max 3 recommendations.`;

  try {
    const raw = await ai.complete(prompt, {
      systemPrompt: SYSTEM_PROMPTS.COURSE_RECOMMENDER,
      maxTokens: 500,
      temperature: 0.3,
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid AI response');

    const parsed = JSON.parse(jsonMatch[0]);
    const result = {
      courseIds: parsed.recommendations.map((r: any) => r.courseId),
      explanations: Object.fromEntries(parsed.recommendations.map((r: any) => [r.courseId, r.reason])),
    };

    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
    return result;
  } catch {
    return { courseIds: [], explanations: {} };
  }
}
```

Add route to backend:
```typescript
// GET /api/recommendations — learner's AI-powered course recommendations
router.get('/recommendations', requireAuth, requireRole('LEARNER'), async (req: any, res) => {
  try {
    const recs = await getRecommendations(req.user.id);
    if (!recs.courseIds.length) return res.json({ courses: [], message: 'Complete 3 or more courses to unlock personalised recommendations.' });

    const courses = await db.course.findMany({
      where: { id: { in: recs.courseIds }, status: 'PUBLISHED' },
      include: { creator: { select: { fullName: true } } },
    });

    const withReasons = courses.map((c) => ({ ...c, aiReason: recs.explanations[c.id] }));
    res.json({ courses: withReasons });
  } catch {
    res.status(500).json({ error: 'Could not fetch recommendations' });
  }
});
```

Wire to `app.ts`:
```typescript
import recommendationsRouter from './routes/recommendations'; // Create this file
app.use('/api', recommendationsRouter);
```

---

### T23.2 — Add recommendations to Learner Dashboard

EDIT FILE: `apps/web/src/pages/learner/Dashboard.tsx`
Add after the "Continue Learning" section:
```tsx
function AIRecommendations() {
  const { data } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => api.get<{ courses: any[]; message?: string }>('/api/recommendations'),
  });
  if (!data?.courses?.length) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={18} className="text-primary-500" />
        <h2 className="text-lg font-semibold text-slate-900">Recommended for You</h2>
        <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">AI-powered</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {data.courses.map((c) => (
          <CourseCard key={c.id} course={c} aiReason={c.aiReason} />
        ))}
      </div>
    </div>
  );
}
```

Import `Sparkles` from lucide-react.

---

### T23.3 — Smart renewal reminders (notification worker)

CREATE FILE: `backend/src/jobs/notificationWorker.ts`
```typescript
import Bull from 'bull';
import { db } from '../lib/db';
import { getLearnerCPDSummary } from '../services/cpd-engine';
import { AIClient, SYSTEM_PROMPTS, type AIProviderConfig } from '@nursepro/ai-client';
import { sendMessage } from '../../apps/whatsapp-bot/src/twilio'; // Use shared client or HTTP call
import { logger } from '../lib/logger';

export const notificationQueue = new Bull('notifications', {
  redis: process.env.REDIS_URL ?? 'redis://localhost:6379',
});

notificationQueue.process('renewal-reminder', async () => {
  const today = new Date();
  const yearEnd = new Date(today.getFullYear(), 11, 31);
  const daysLeft = Math.ceil((yearEnd.getTime() - today.getTime()) / 86400000);

  // Only send at: 90, 60, 30, 7 days before deadline
  const reminderDays = [90, 60, 30, 7];
  if (!reminderDays.includes(daysLeft)) return { skipped: true, daysLeft };

  const learners = await db.user.findMany({
    where: { role: 'LEARNER', isActive: true, phone: { not: null } },
    select: { id: true, fullName: true, phone: true, cadre: true },
  });

  let sent = 0;
  const config: AIProviderConfig = {
    anthropic: process.env.ANTHROPIC_API_KEY ? { apiKey: process.env.ANTHROPIC_API_KEY, defaultModel: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6' } : undefined,
    openai: process.env.OPENAI_API_KEY ? { apiKey: process.env.OPENAI_API_KEY, defaultModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini' } : undefined,
    gemini: process.env.GEMINI_API_KEY ? { apiKey: process.env.GEMINI_API_KEY, defaultModel: process.env.GEMINI_MODEL ?? 'gemini-1.5-pro' } : undefined,
    ollama: process.env.OLLAMA_BASE_URL ? { baseUrl: process.env.OLLAMA_BASE_URL, defaultModel: process.env.OLLAMA_MODEL ?? 'llama3' } : undefined,
  };
  const ai = new AIClient(config);

  for (const learner of learners.slice(0, 100)) { // batch of 100 per run
    try {
      const summary = await getLearnerCPDSummary(learner.id);
      if (summary.percentComplete >= 100) continue; // already done

      const pointsNeeded = summary.requiredPoints - summary.totalPoints;

      const prompt = `Write a WhatsApp reminder message for this nurse:
Name: ${learner.fullName.split(' ')[0]}
Days until CPD renewal deadline: ${daysLeft}
CPD points still needed: ${pointsNeeded}
Under 80 words. Warm and motivating. End with "Reply 1 to start learning."`;

      const message = await ai.complete(prompt, {
        systemPrompt: SYSTEM_PROMPTS.REMINDER_WRITER,
        maxTokens: 150,
        temperature: 0.7,
      });

      // TODO: Use actual Twilio sendMessage from whatsapp-bot
      // For now, log it
      logger.info('Reminder (dry run)', { to: learner.phone, message });
      sent++;
    } catch (err: any) {
      logger.warn('Failed to send reminder', { learnerId: learner.id, error: err.message });
    }
  }

  return { sent, daysLeft };
});

export async function scheduleRenewalReminders(): Promise<void> {
  await notificationQueue.add(
    'renewal-reminder',
    {},
    { repeat: { cron: '0 8 * * *' }, removeOnComplete: 10 },
  );
  logger.info('Renewal reminders scheduled (daily 8am)');
}
```

---

## Validation Checklist (S23)

- [ ] `GET /api/recommendations` returns up to 3 courses for a learner with ≥3 completions
- [ ] Recommendations are cached in Redis for 12 hours
- [ ] Recommendations section appears on learner dashboard with "AI-powered" badge
- [ ] AI reason shown on each recommended course card
- [ ] Renewal reminder worker processes learners and logs messages
- [ ] Smart reminder uses AI to personalise (not just template)
- [ ] Works with all 4 AI providers (test with ANTHROPIC at minimum)

**Sign-off:** Claude Code validates recommendations API response and cache behaviour.
