# Sprints 19–20 — NCZ Portal & Sync Adapter

---

# Sprint 19 — NCZ Portal

**Phase:** 4 — NCZ Integration
**Duration:** 1 week
**Goal:** Full NCZ Officer interface — learner search, individual CPD history view, bulk compliance reports, certificate verification. Clean, report-focused UI with no decorative elements.

---

## Design Reference
See `docs/design/DESIGN_SYSTEM.md` → Section 7.7 "NCZ Portal"
- No sidebar decoration beyond the blue-600 accent
- Tables are the primary UI element
- Export buttons are always visible at the top
- Search filters are inline, not in a sidebar

---

## Tasks

### T19.1 — NCZ backend routes

CREATE FILE: `backend/src/routes/ncz.ts`
```typescript
import { Router } from 'express';
import { db } from '../lib/db';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import PDFDocument from 'pdfkit';

const router = Router();

// All NCZ routes require NCZ_OFFICER or ADMIN role

// GET /api/ncz/learners — search learners with filters
router.get('/learners', requireAuth, requireRole('NCZ_OFFICER', 'ADMIN'), async (req, res) => {
  try {
    const { search, cadre, institution, province, district, page = '1', limit = '25' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = { role: 'LEARNER' };
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
        where, skip, take: parseInt(limit),
        orderBy: { fullName: 'asc' },
        select: {
          id: true, fullName: true, email: true, nczRegistrationNumber: true,
          cadre: true, institution: true, province: true, district: true,
          subscriptionTier: true, isActive: true,
        },
      }),
      db.user.count({ where }),
    ]);

    // Attach CPD summary for current year to each learner
    const year = new Date().getFullYear();
    const learnerIds = learners.map((l) => l.id);
    const cpdTotals = await db.cPDRecord.groupBy({
      by: ['learnerId'],
      where: { learnerId: { in: learnerIds }, cycleYear: year },
      _sum: { pointsEarned: true },
    });
    const pointsMap = Object.fromEntries(cpdTotals.map((r) => [r.learnerId, r._sum.pointsEarned ?? 0]));

    const withCPD = learners.map((l) => ({
      ...l,
      currentYearPoints: pointsMap[l.id] ?? 0,
      isCompliant: (pointsMap[l.id] ?? 0) >= 12, // default 12 pts required
    }));

    res.json({ learners: withCPD, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch {
    res.status(500).json({ error: 'Could not fetch learners' });
  }
});

// GET /api/ncz/learners/:id/history — full CPD history
router.get('/learners/:id/history', requireAuth, requireRole('NCZ_OFFICER', 'ADMIN'), async (req, res) => {
  try {
    const [learner, records, certificates] = await Promise.all([
      db.user.findUnique({
        where: { id: req.params.id },
        select: {
          id: true, fullName: true, email: true, nczRegistrationNumber: true,
          cadre: true, institution: true, province: true, isActive: true,
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

    if (!learner) return res.status(404).json({ error: 'Learner not found' });
    res.json({ learner, records, certificates });
  } catch {
    res.status(500).json({ error: 'Could not fetch learner history' });
  }
});

// GET /api/ncz/compliance — aggregate compliance dashboard
router.get('/compliance', requireAuth, requireRole('NCZ_OFFICER', 'ADMIN'), async (req, res) => {
  try {
    const year = parseInt((req.query.year as string) ?? String(new Date().getFullYear()));
    const totalLearners = await db.user.count({ where: { role: 'LEARNER', isActive: true } });

    // Get all learner IDs
    const learners = await db.user.findMany({ where: { role: 'LEARNER', isActive: true }, select: { id: true } });
    const learnerIds = learners.map((l) => l.id);

    // Get CPD totals per learner for the year
    const cpdTotals = await db.cPDRecord.groupBy({
      by: ['learnerId'],
      where: { learnerId: { in: learnerIds }, cycleYear: year },
      _sum: { pointsEarned: true },
    });

    const compliantCount = cpdTotals.filter((r) => (r._sum.pointsEarned ?? 0) >= 12).length;

    res.json({
      year,
      totalLearners,
      compliantCount,
      nonCompliantCount: totalLearners - compliantCount,
      complianceRate: totalLearners ? Math.round((compliantCount / totalLearners) * 100) : 0,
    });
  } catch {
    res.status(500).json({ error: 'Could not fetch compliance data' });
  }
});

// GET /api/ncz/export/csv — export learner compliance as CSV
router.get('/export/csv', requireAuth, requireRole('NCZ_OFFICER', 'ADMIN'), async (req, res) => {
  try {
    const year = parseInt((req.query.year as string) ?? String(new Date().getFullYear()));
    const learners = await db.user.findMany({
      where: { role: 'LEARNER', isActive: true },
      select: { id: true, fullName: true, nczRegistrationNumber: true, cadre: true, institution: true, province: true },
    });

    const learnerIds = learners.map((l) => l.id);
    const cpdTotals = await db.cPDRecord.groupBy({
      by: ['learnerId'],
      where: { learnerId: { in: learnerIds }, cycleYear: year },
      _sum: { pointsEarned: true },
    });
    const pointsMap = Object.fromEntries(cpdTotals.map((r) => [r.learnerId, r._sum.pointsEarned ?? 0]));

    const rows = [
      ['Name', 'NCZ Reg Number', 'Cadre', 'Institution', 'Province', 'CPD Points', 'Compliant', 'Year'],
      ...learners.map((l) => [
        l.fullName,
        l.nczRegistrationNumber ?? '',
        l.cadre ?? '',
        l.institution ?? '',
        l.province ?? '',
        String(pointsMap[l.id] ?? 0),
        (pointsMap[l.id] ?? 0) >= 12 ? 'Yes' : 'No',
        String(year),
      ]),
    ];

    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="ncz-compliance-${year}.csv"`);
    res.send(csv);
  } catch {
    res.status(500).json({ error: 'Export failed' });
  }
});

// GET /api/ncz/verify/:uuid — public certificate verification
router.get('/verify/:uuid', async (req, res) => {
  try {
    const cert = await db.certificate.findUnique({
      where: { certificateUuid: req.params.uuid },
      include: {
        learner: { select: { fullName: true, nczRegistrationNumber: true, cadre: true } },
      },
    });
    if (!cert) return res.status(404).json({ error: 'Certificate not found', valid: false });
    res.json({
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
    res.status(500).json({ error: 'Verification failed' });
  }
});

export default router;
```

EDIT FILE: `backend/src/app.ts`
Add:
```typescript
import nczRouter from './routes/ncz';
// ...
app.use('/api/ncz', nczRouter);
```

---

### T19.2 — NCZ Portal frontend

EDIT FILE: `apps/web/src/pages/ncz/NczDashboard.tsx`
Replace stub with full dashboard:

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Download, CheckCircle, XCircle, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { StatCard } from '../../components/ui/StatCard';

interface ComplianceData {
  year: number; totalLearners: number; compliantCount: number;
  nonCompliantCount: number; complianceRate: number;
}
interface Learner {
  id: string; fullName: string; nczRegistrationNumber: string;
  cadre: string; institution: string; province: string;
  currentYearPoints: number; isCompliant: boolean;
}

export default function NczDashboard() {
  const [search, setSearch] = useState('');
  const [cadre, setCadre] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLearner, setSelectedLearner] = useState<Learner | null>(null);

  const { data: compliance } = useQuery<ComplianceData>({
    queryKey: ['ncz-compliance'],
    queryFn: () => api.get('/api/ncz/compliance'),
  });

  const { data: learnersData, isLoading } = useQuery<{ learners: Learner[]; total: number; totalPages: number }>({
    queryKey: ['ncz-learners', search, cadre, page],
    queryFn: () => api.get(`/api/ncz/learners?search=${search}&cadre=${cadre}&page=${page}&limit=25`),
  });

  function handleExportCSV() {
    window.open(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/ncz/export/csv`, '_blank');
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">NCZ Compliance Portal</h1>
          <p className="text-slate-500 mt-1">Nurses Council of Zimbabwe — CPD Monitoring</p>
        </div>
        <button onClick={handleExportCSV} className="flex items-center gap-2 bg-blue-600 text-white font-semibold px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-sm">
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Compliance stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Registered Learners" value={compliance?.totalLearners ?? '–'} icon={<Users size={20} />} accent="blue" />
        <StatCard title="Compliant" value={compliance?.compliantCount ?? '–'} icon={<CheckCircle size={20} />} accent="green" />
        <StatCard title="Non-Compliant" value={compliance?.nonCompliantCount ?? '–'} icon={<XCircle size={20} />} accent="red" />
        <StatCard title="Compliance Rate" value={compliance ? `${compliance.complianceRate}%` : '–'} icon={<CheckCircle size={20} />} accent="teal" />
      </div>

      {/* Search + filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-64 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text" placeholder="Search by name, NCZ number, or email…"
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={cadre} onChange={(e) => { setCadre(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Cadres</option>
            <option value="NURSE">Nurse</option>
            <option value="MIDWIFE">Midwife</option>
            <option value="PHARMACIST">Pharmacist</option>
            <option value="CLINICAL_OFFICER">Clinical Officer</option>
            <option value="LAB_TECH">Lab Tech</option>
          </select>
        </div>
      </div>

      {/* Learner table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {['Name', 'NCZ Reg Number', 'Cadre', 'Institution', 'CPD Points', 'Status', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td></tr>
              ))
            ) : learnersData?.learners.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedLearner(l)}>
                <td className="px-4 py-3 font-medium text-slate-900">{l.fullName}</td>
                <td className="px-4 py-3 text-slate-500 font-mono text-xs">{l.nczRegistrationNumber ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{l.cadre ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500 truncate max-w-40">{l.institution ?? '—'}</td>
                <td className="px-4 py-3 font-semibold">{l.currentYearPoints}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${l.isCompliant ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {l.isCompliant ? 'Compliant' : 'Non-Compliant'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button className="text-blue-600 hover:underline text-xs" onClick={(e) => { e.stopPropagation(); setSelectedLearner(l); }}>
                    View History
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {learnersData && learnersData.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-sm text-slate-500">Page {page} of {learnersData.totalPages} · {learnersData.total} learners</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 rounded border text-sm disabled:opacity-40">Previous</button>
              <button disabled={page === learnersData.totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 rounded border text-sm disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Learner detail slide-in (simplified) */}
      {selectedLearner && (
        <LearnerHistoryPanel learner={selectedLearner} onClose={() => setSelectedLearner(null)} />
      )}
    </div>
  );
}

function LearnerHistoryPanel({ learner, onClose }: { learner: Learner; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ['ncz-learner-history', learner.id],
    queryFn: () => api.get<any>(`/api/ncz/learners/${learner.id}/history`),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-xl bg-white h-full overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">{learner.fullName}</h2>
            <p className="text-sm text-slate-500">{learner.nczRegistrationNumber}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          {data?.records?.map((r: any) => (
            <div key={r.id} className="flex items-start justify-between py-3 border-b border-slate-100 last:border-0">
              <div>
                <p className="text-sm font-medium text-slate-900">{r.course?.title ?? r.activityType}</p>
                <p className="text-xs text-slate-400 mt-0.5">{new Date(r.completedAt).toLocaleDateString()}</p>
              </div>
              <span className="text-sm font-semibold text-primary-600">+{r.pointsEarned} pts</span>
            </div>
          ))}
          {!data?.records?.length && <p className="text-slate-400 text-sm">No CPD records found.</p>}
        </div>
      </div>
    </div>
  );
}
```

---

## Validation Checklist (S19)

- [ ] NCZ portal loads at `/ncz`
- [ ] Compliance stats show correct totals
- [ ] Search by name returns matching learners
- [ ] Filter by cadre works
- [ ] Clicking a learner opens slide-in history panel with CPD records
- [ ] "Export CSV" downloads a valid CSV file with all learner data
- [ ] `GET /api/ncz/verify/:uuid` returns cert info without auth (public endpoint)
- [ ] LEARNER role cannot access `/ncz` — redirected to dashboard

---

# Sprint 20 — NCZ Sync Adapter

**Phase:** 4
**Duration:** 1 week
**Goal:** Automated daily sync of CPD point records to the NCZ system. Retry on failure, sync logs, manual trigger.

---

## Tasks

### T20.1 — NCZ Sync service

CREATE FILE: `backend/src/services/ncz-sync.ts`
```typescript
import { db } from '../lib/db';
import { logger } from '../lib/logger';

const NCZ_API_URL = process.env.NCZ_SYNC_API_URL;
const NCZ_API_KEY = process.env.NCZ_API_KEY;

export interface SyncRecord {
  nczRegistrationNumber: string;
  fullName: string;
  pointsEarned: number;
  activityType: string;
  completedAt: string;
  cycleYear: number;
  courseReference?: string;
}

/**
 * Fetch all unsynced CPD records and submit to NCZ system.
 * Marks records as synced on success.
 * Returns sync result.
 */
export async function runNczSync(triggeredBy: string = 'cron'): Promise<{
  success: boolean; recordCount: number; errorMessage?: string;
}> {
  const unsyncedRecords = await db.cPDRecord.findMany({
    where: { syncedToNcz: false },
    include: {
      learner: { select: { fullName: true, nczRegistrationNumber: true } },
      course: { select: { accreditationBody: true, title: true } },
    },
    take: 1000, // batch limit
  });

  if (unsyncedRecords.length === 0) {
    await db.nczSyncLog.create({
      data: { triggeredBy, recordCount: 0, success: true },
    });
    return { success: true, recordCount: 0 };
  }

  const payload: SyncRecord[] = unsyncedRecords
    .filter((r) => r.learner.nczRegistrationNumber) // only learners with NCZ number
    .map((r) => ({
      nczRegistrationNumber: r.learner.nczRegistrationNumber!,
      fullName: r.learner.fullName,
      pointsEarned: r.pointsEarned,
      activityType: r.activityType,
      completedAt: r.completedAt.toISOString(),
      cycleYear: r.cycleYear,
      courseReference: r.course?.accreditationBody ? `${r.course.accreditationBody}: ${r.course.title}` : undefined,
    }));

  // Attempt sync to NCZ API (or SFTP/email fallback)
  try {
    if (NCZ_API_URL && NCZ_API_KEY) {
      const res = await fetch(`${NCZ_API_URL}/cpd-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': NCZ_API_KEY },
        body: JSON.stringify({ records: payload }),
      });
      if (!res.ok) throw new Error(`NCZ API responded with ${res.status}`);
    } else {
      // Fallback: log the payload for manual submission (dev/test mode)
      logger.info('NCZ Sync (dry run — no NCZ_API_URL configured)', { recordCount: payload.length });
    }

    // Mark all as synced
    await db.cPDRecord.updateMany({
      where: { id: { in: unsyncedRecords.map((r) => r.id) } },
      data: { syncedToNcz: true, nczSyncedAt: new Date() },
    });

    await db.nczSyncLog.create({
      data: { triggeredBy, recordCount: payload.length, success: true },
    });

    logger.info('NCZ sync complete', { recordCount: payload.length });
    return { success: true, recordCount: payload.length };
  } catch (err: any) {
    await db.nczSyncLog.create({
      data: { triggeredBy, recordCount: 0, success: false, errorMessage: err.message },
    });
    logger.error('NCZ sync failed', { error: err.message });
    return { success: false, recordCount: 0, errorMessage: err.message };
  }
}
```

---

### T20.2 — NCZ Sync job (Bull + cron)

CREATE FILE: `backend/src/jobs/syncWorker.ts`
```typescript
import Bull from 'bull';
import { runNczSync } from '../services/ncz-sync';
import { logger } from '../lib/logger';

export const syncQueue = new Bull('ncz-sync', {
  redis: process.env.REDIS_URL ?? 'redis://localhost:6379',
});

// Process sync jobs
syncQueue.process('run-sync', async (job) => {
  const { triggeredBy } = job.data;
  logger.info('Running NCZ sync', { triggeredBy });
  return runNczSync(triggeredBy);
});

// Schedule daily at 2am (configurable via NCZ_SYNC_SCHEDULE)
const schedule = process.env.NCZ_SYNC_SCHEDULE ?? '0 2 * * *';

export async function scheduleDailySync(): Promise<void> {
  // Remove any existing repeatable sync jobs
  const repeatableJobs = await syncQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await syncQueue.removeRepeatableByKey(job.key);
  }

  await syncQueue.add(
    'run-sync',
    { triggeredBy: 'cron' },
    { repeat: { cron: schedule }, removeOnComplete: 50 },
  );
  logger.info('NCZ daily sync scheduled', { schedule });
}
```

---

### T20.3 — Manual sync trigger API endpoint

EDIT FILE: `backend/src/routes/ncz.ts`
Add:
```typescript
import { syncQueue } from '../jobs/syncWorker';
import { runNczSync } from '../services/ncz-sync';

// POST /api/ncz/sync/trigger — NCZ Officer or Admin triggers manual sync
router.post('/sync/trigger', requireAuth, requireRole('NCZ_OFFICER', 'ADMIN'), async (req: any, res) => {
  try {
    const result = await runNczSync(req.user.id);
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Sync trigger failed' });
  }
});

// GET /api/ncz/sync/logs — last 20 sync logs
router.get('/sync/logs', requireAuth, requireRole('NCZ_OFFICER', 'ADMIN'), async (_req, res) => {
  try {
    const logs = await db.nczSyncLog.findMany({
      orderBy: { syncedAt: 'desc' },
      take: 20,
    });
    res.json(logs);
  } catch {
    res.status(500).json({ error: 'Could not fetch sync logs' });
  }
});
```

---

### T20.4 — Sync status panel in NCZ portal

Add to `apps/web/src/pages/ncz/NczDashboard.tsx` at the bottom:
```tsx
// Sync status panel
function SyncStatusPanel() {
  const { data: logs } = useQuery({
    queryKey: ['ncz-sync-logs'],
    queryFn: () => api.get<any[]>('/api/ncz/sync/logs'),
    refetchInterval: 30000,
  });
  const [triggering, setTriggering] = useState(false);

  async function triggerSync() {
    setTriggering(true);
    try {
      await api.post('/api/ncz/sync/trigger');
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900">NCZ Sync Status</h2>
        <button onClick={triggerSync} disabled={triggering} className="flex items-center gap-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 disabled:opacity-40">
          <RefreshCw size={14} className={triggering ? 'animate-spin' : ''} />
          {triggering ? 'Syncing…' : 'Sync Now'}
        </button>
      </div>
      <div className="space-y-2">
        {logs?.slice(0, 5).map((log: any) => (
          <div key={log.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-sm">
            <div>
              <span className={`inline-flex w-2 h-2 rounded-full mr-2 ${log.success ? 'bg-green-500' : 'bg-red-500'}`} />
              {new Date(log.syncedAt).toLocaleString()} · {log.recordCount} records
            </div>
            <span className="text-xs text-slate-400">{log.triggeredBy}</span>
          </div>
        ))}
        {!logs?.length && <p className="text-sm text-slate-400">No sync history yet.</p>}
      </div>
    </div>
  );
}
```

Import `RefreshCw` from lucide-react and add `<SyncStatusPanel />` to the page.

---

## Validation Checklist (S20)

- [ ] `runNczSync()` finds unsynced records and processes them
- [ ] After sync, records have `syncedToNcz: true` in database
- [ ] `POST /api/ncz/sync/trigger` manually triggers sync and returns result
- [ ] `GET /api/ncz/sync/logs` returns last 20 sync log entries
- [ ] Sync logs panel shows in NCZ portal with last sync time
- [ ] "Sync Now" button triggers sync and refreshes logs
- [ ] If NCZ_API_URL is not set, sync runs in dry-run mode and logs without crashing
- [ ] Daily cron job is scheduled when backend starts

**Sign-off:** Claude Code verifies sync records are marked correctly in DB and logs are written.
