import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Users,
  BookOpen,
  Award,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  BadgeCheck,
  ShieldAlert,
  ClipboardCheck,
  Settings,
  BarChart2,
  CreditCard,
  RefreshCw,
  ArrowRight,
  Wand2,
  FileUp,
  Building2,
  Save,
  X,
  Ticket,
  Download,
  Plus,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { api } from '../../lib/api';
import { StatCard } from '../../components/ui/StatCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';
import { toast } from '../../components/ui/Toast';
import { useAuthStore } from '../../store/auth.store';

interface AdminStats {
  totalLearners: number;
  activeSubs: number;
  publishedCourses: number;
  pendingApprovals: number;
  totalPointsIssuedThisYear: number;
}

interface PendingCourse {
  id: string;
  title: string;
  cpdPoints: number;
  status: string;
  aiSourceName?: string | null;
  aiGeneratedAt?: string | null;
  aiGeneratedProvider?: string | null;
  aiReviewNotes?: string | null;
  creator: { fullName: string; email: string };
  _count: { modules: number };
  updatedAt: string;
}

interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: 'ADMIN' | 'CONTENT_MANAGER' | 'NCZ_OFFICER' | 'COUNCIL_OFFICER' | 'LEARNER';
  cadre?: string | null;
  subscriptionTier: 'FREE' | 'STANDARD' | 'INSTITUTION' | 'DIASPORA';
  subscriptionExpiresAt?: string | null;
  isActive: boolean;
  isApproved: boolean;
  institution?: string | null;
  createdAt: string;
  _count: { cpdRecords: number };
}

interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  totalPages: number;
}

interface AuditLog {
  id: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  meta?: unknown;
  createdAt: string;
  user: { fullName: string; email: string };
}

interface AuditResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  totalPages: number;
}

interface AnalyticsPoint {
  month: string;
  learners: number;
  points: number;
}

interface SubscriptionBreakdown {
  tier: 'FREE' | 'STANDARD' | 'INSTITUTION' | 'DIASPORA';
  count: number;
}

interface SystemConfig {
  aiProvider: string;
  availableProviders: string[];
  configuredProviders: string[];
  maintenanceMode: boolean;
  councilSyncSchedule: string;
  cpdRules: Record<string, number>;
  activityPoints: Record<string, number>;
  subscriptionPricing: Array<{ tier: string; priceUsd: number; label: string }>;
}

type CouncilAdminRow = {
  id: string;
  name: string;
  acronym: string;
  requiredPoints: number;
  renewalMonth: number;
  renewalDay: number;
  allowedTitles: string[];
  isActive: boolean;
};

type CouncilsAdminResponse = { councils: CouncilAdminRow[] };

interface AiHealth {
  activeProvider: string | null;
  configuredProviders: string[];
  windowHours: number;
  requests: number;
  cacheHits: number;
  failures: number;
  paywalls: number;
  fallbacks: number;
  avgLatencyMs: number | null;
  lastFailureAt: string | null;
  lastFallbackAt: string | null;
}

interface TelemetrySummary {
  windowHours: number;
  enrollments: { inProgress: number; completed: number };
  quizAttempts24h: number;
  offlineDownloads24h: number;
  botAiTutorEvents24h: number;
}

interface SubscriptionSummary {
  activeTotal: number;
  expiringSoon: number;
  byGateway: Array<{ gateway: string; count: number }>;
  byTier: Array<{ tier: string; count: number }>;
}

interface RecentSubscription {
  id: string;
  tier: string;
  gateway?: string | null;
  paymentRef?: string | null;
  startsAt: string;
  expiresAt: string;
  createdAt: string;
  learner: { fullName: string; email: string } | null;
}

interface RecentSubscriptionsResponse {
  subscriptions: RecentSubscription[];
}

interface NczSyncSummary {
  pending: number;
  blocked: number;
  failed: number;
  synced: number;
  mode?: 'dry_run' | 'live' | 'disabled';
  configured?: boolean;
}

interface NczSyncLog {
  id: string;
  triggeredBy?: string | null;
  recordCount: number;
  success: boolean;
  errorMessage?: string | null;
  dryRun?: boolean;
  syncedAt: string;
}

interface IngestGuidelineResponse {
  courseId: string;
  title: string;
  status: string;
  moduleCount: number;
  sourceType?: string;
  sourceLabel?: string;
  extractedCharacters?: number;
  warnings?: string[];
  message: string;
}

const ADMIN_SECTIONS = [
  { key: 'dashboard', label: 'Dashboard', path: '/admin', icon: Users },
  { key: 'councils', label: 'Councils', path: '/admin/councils', icon: Building2 },
  { key: 'creator-approvals', label: 'Creator Approvals', path: '/admin/creator-approvals', icon: BadgeCheck },
  { key: 'users', label: 'Users', path: '/admin/users', icon: Users },
  { key: 'courses', label: 'Course Approvals', path: '/admin/courses', icon: BookOpen },
  { key: 'guidelines', label: 'Guideline Lab', path: '/admin/guidelines', icon: Wand2 },
  { key: 'analytics', label: 'Analytics', path: '/admin/analytics', icon: BarChart2 },
  { key: 'payments', label: 'Payments', path: '/admin/payments', icon: CreditCard },
  { key: 'vouchers', label: 'Vouchers', path: '/admin/vouchers', icon: Ticket },
  { key: 'council-sync', label: 'Council Sync', path: '/admin/council-sync', icon: RefreshCw },
  { key: 'audit', label: 'Audit Log', path: '/admin/audit', icon: ShieldAlert },
  { key: 'release', label: 'Release Readiness', path: '/admin/release', icon: ClipboardCheck },
  { key: 'settings', label: 'Settings', path: '/admin/settings', icon: Settings },
] as const;

const ROLE_OPTIONS = ['ALL', 'ADMIN', 'CONTENT_MANAGER', 'NCZ_OFFICER', 'COUNCIL_OFFICER', 'LEARNER'] as const;
const PIE_COLOURS = ['#e11d48', '#3b82f6', '#2563eb', '#f59e0b'];

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-ZW', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-ZW', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getSection(pathname: string) {
  // Important: `/admin` is a prefix of every admin route, so we must not match it
  // for sub-pages like `/admin/users` or `/admin/settings`.
  const matches = (section: (typeof ADMIN_SECTIONS)[number]) => {
    if (section.path === '/admin') return pathname === '/admin';
    return pathname === section.path || pathname.startsWith(`${section.path}/`);
  };

  // Prefer the most specific (longest) match.
  const sorted = [...ADMIN_SECTIONS].sort((a, b) => b.path.length - a.path.length);
  return sorted.find(matches)?.key ?? 'dashboard';
}

export default function AdminDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const section = getSection(location.pathname);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Platform operations, governance, analytics, and system configuration.</p>
        </div>
      </div>

      {/* On small screens, use a dropdown to avoid horizontal scrolling. */}
      <div className="sm:hidden">
        <label className="block text-xs font-medium text-slate-600 mb-1.5">Section</label>
        <select
          value={section}
          onChange={(e) => {
            const next = ADMIN_SECTIONS.find((s) => s.key === e.target.value)?.path ?? '/admin';
            navigate(next);
          }}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100"
        >
          {ADMIN_SECTIONS.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden sm:flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl w-full">
        {ADMIN_SECTIONS.map((item) => (
          <Link
            key={item.key}
            to={item.path}
            className={`px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              section === item.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-700'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {section === 'dashboard' && <OverviewSection />}
      {section === 'councils' && <CouncilsSection />}
      {section === 'creator-approvals' && <CreatorApprovalsSection />}
      {section === 'users' && <UsersSection />}
      {section === 'courses' && <ApprovalsSection standalone />}
      {section === 'guidelines' && <GuidelineLabSection />}
      {section === 'analytics' && <AnalyticsSection />}
      {section === 'audit' && <AuditSection />}
      {section === 'release' && <ReleaseReadinessSection />}
      {section === 'settings' && <SettingsSection />}
      {section === 'payments' && <PaymentsSection />}
      {section === 'vouchers' && <VouchersSection />}
      {section === 'council-sync' && <CouncilSyncSection />}
    </div>
  );
}

function CreatorApprovalsSection() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const pendingCreatorsQuery = useQuery<UsersResponse>({
    queryKey: ['admin-pending-creators', search, page],
    queryFn: () =>
      api.get(`/api/admin/users?search=${encodeURIComponent(search)}&role=CONTENT_MANAGER&approved=false&page=${page}&limit=25`),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.patch(`/api/admin/users/${id}`, data),
    onSuccess: () => {
      toast.success('Creator account updated.');
      qc.invalidateQueries({ queryKey: ['admin-pending-creators'] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not update creator account.'),
  });

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-900">Creator Approvals</h2>
            <p className="text-sm md:text-[15px] text-slate-600 mt-2 max-w-2xl leading-relaxed">
              Review course creator signups. Approve verified creators so they can access the creator portal.
            </p>
          </div>
          <div className="hidden sm:inline-flex items-center gap-2 rounded-full bg-rose-50 border border-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700 flex-shrink-0">
            <BadgeCheck size={14} />
            Pending queue
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name or email"
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100"
            />
          </div>
        </div>

        <div className="mt-5">
          {pendingCreatorsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-16 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
              ))}
            </div>
          ) : pendingCreatorsQuery.isError ? (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Could not load pending creators.
            </div>
          ) : !pendingCreatorsQuery.data?.users.length ? (
            <EmptyState
              icon={<BadgeCheck size={28} />}
              title="No pending creators"
              description="New creator signups will appear here for verification."
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Creator', 'Email', 'Created', 'Status', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingCreatorsQuery.data.users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-900">{u.fullName}</div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{u.email}</td>
                      <td className="px-4 py-4 text-slate-500">{formatDate(u.createdAt)}</td>
                      <td className="px-4 py-4">
                        <Badge variant="warning">Pending</Badge>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleMutation.mutate({ id: u.id, data: { isApproved: true } })}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleMutation.mutate({ id: u.id, data: { isActive: false } })}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Deactivate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CouncilsSection() {
  const qc = useQueryClient();
  const councilsQuery = useQuery<CouncilsAdminResponse>({
    queryKey: ['admin-councils'],
    queryFn: () => api.get('/api/councils/all'),
  });

  const [draftByCouncilId, setDraftByCouncilId] = useState<
    Record<string, { requiredPoints: string; renewalMonth: string; renewalDay: string; isActive: boolean } | undefined>
  >({});

  useEffect(() => {
    if (!councilsQuery.data?.councils?.length) return;
    setDraftByCouncilId((current) => {
      const next = { ...current };
      for (const c of councilsQuery.data!.councils) {
        if (next[c.id]) continue;
        next[c.id] = {
          requiredPoints: String(c.requiredPoints),
          renewalMonth: String(c.renewalMonth),
          renewalDay: String(c.renewalDay),
          isActive: c.isActive,
        };
      }
      return next;
    });
  }, [councilsQuery.data]);

  const updateCouncilMutation = useMutation({
    mutationFn: async (payload: { id: string; requiredPoints: number; renewalMonth: number; renewalDay: number; isActive: boolean }) =>
      api.patch(`/api/councils/${payload.id}`, {
        requiredPoints: payload.requiredPoints,
        renewalMonth: payload.renewalMonth,
        renewalDay: payload.renewalDay,
        isActive: payload.isActive,
      }),
    onSuccess: () => {
      toast.success('Council settings updated.');
      qc.invalidateQueries({ queryKey: ['admin-councils'] });
      qc.invalidateQueries({ queryKey: ['cpd-summary'] });
      qc.invalidateQueries({ queryKey: ['council-compliance'] });
      qc.invalidateQueries({ queryKey: ['council-learners'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not update council settings.'),
  });

  const councilRows = useMemo(() => councilsQuery.data?.councils ?? [], [councilsQuery.data]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-900">Councils</h2>
            <p className="text-sm md:text-[15px] text-slate-600 mt-2 max-w-2xl leading-relaxed">
              Manage council CPD targets, renewal dates, and activation status. Learner dashboards and council compliance views read from this data.
            </p>
          </div>
          <div className="hidden sm:inline-flex items-center gap-2 rounded-full bg-rose-50 border border-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700 flex-shrink-0">
            <Building2 size={14} />
            Council registry
          </div>
        </div>

        <div className="mt-6">
          {councilsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-16 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
              ))}
            </div>
          ) : councilsQuery.isError ? (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Could not load councils.
            </div>
          ) : councilRows.length === 0 ? (
            <EmptyState
              icon={<Building2 size={28} />}
              title="No councils found"
              description="Seed councils in the database to begin configuring required points and renewal deadlines."
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-sm bg-white">
                <thead className="bg-slate-50">
                  <tr>
                    {['Council', 'Required points', 'Renewal month', 'Renewal day', 'Status', ''].map((heading) => (
                      <th key={heading} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {councilRows.map((council) => {
                    const draft = draftByCouncilId[council.id];
                    const isSaving = updateCouncilMutation.isPending && updateCouncilMutation.variables?.id === council.id;
                    return (
                      <tr key={council.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-900">{council.acronym}</div>
                          <div className="text-xs text-slate-500 mt-1">{council.name}</div>
                        </td>
                        <td className="px-4 py-4">
                          <input
                            inputMode="numeric"
                            value={draft?.requiredPoints ?? String(council.requiredPoints)}
                            onChange={(e) =>
                              setDraftByCouncilId((prev) => ({
                                ...prev,
                                [council.id]: {
                                  requiredPoints: e.target.value,
                                  renewalMonth: prev[council.id]?.renewalMonth ?? String(council.renewalMonth),
                                  renewalDay: prev[council.id]?.renewalDay ?? String(council.renewalDay),
                                  isActive: prev[council.id]?.isActive ?? council.isActive,
                                },
                              }))
                            }
                            className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <input
                            inputMode="numeric"
                            value={draft?.renewalMonth ?? String(council.renewalMonth)}
                            onChange={(e) =>
                              setDraftByCouncilId((prev) => ({
                                ...prev,
                                [council.id]: {
                                  requiredPoints: prev[council.id]?.requiredPoints ?? String(council.requiredPoints),
                                  renewalMonth: e.target.value,
                                  renewalDay: prev[council.id]?.renewalDay ?? String(council.renewalDay),
                                  isActive: prev[council.id]?.isActive ?? council.isActive,
                                },
                              }))
                            }
                            className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <input
                            inputMode="numeric"
                            value={draft?.renewalDay ?? String(council.renewalDay)}
                            onChange={(e) =>
                              setDraftByCouncilId((prev) => ({
                                ...prev,
                                [council.id]: {
                                  requiredPoints: prev[council.id]?.requiredPoints ?? String(council.requiredPoints),
                                  renewalMonth: prev[council.id]?.renewalMonth ?? String(council.renewalMonth),
                                  renewalDay: e.target.value,
                                  isActive: prev[council.id]?.isActive ?? council.isActive,
                                },
                              }))
                            }
                            className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() =>
                              setDraftByCouncilId((prev) => ({
                                ...prev,
                                [council.id]: {
                                  requiredPoints: prev[council.id]?.requiredPoints ?? String(council.requiredPoints),
                                  renewalMonth: prev[council.id]?.renewalMonth ?? String(council.renewalMonth),
                                  renewalDay: prev[council.id]?.renewalDay ?? String(council.renewalDay),
                                  isActive: !(prev[council.id]?.isActive ?? council.isActive),
                                },
                              }))
                            }
                            className={clsx(
                              'rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors',
                              (draft?.isActive ?? council.isActive)
                                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200',
                            )}
                          >
                            {(draft?.isActive ?? council.isActive) ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setDraftByCouncilId((prev) => ({
                                  ...prev,
                                  [council.id]: {
                                    requiredPoints: String(council.requiredPoints),
                                    renewalMonth: String(council.renewalMonth),
                                    renewalDay: String(council.renewalDay),
                                    isActive: council.isActive,
                                  },
                                }));
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              title="Reset row"
                            >
                              <X size={12} />
                              Reset
                            </button>
                            <button
                              type="button"
                              disabled={isSaving || !draft}
                              onClick={() => {
                                const requiredPoints = Math.max(1, Math.min(500, parseInt(draft!.requiredPoints, 10) || council.requiredPoints));
                                const renewalMonth = Math.max(1, Math.min(12, parseInt(draft!.renewalMonth, 10) || council.renewalMonth));
                                const renewalDay = Math.max(1, Math.min(31, parseInt(draft!.renewalDay, 10) || council.renewalDay));
                                updateCouncilMutation.mutate({
                                  id: council.id,
                                  requiredPoints,
                                  renewalMonth,
                                  renewalDay,
                                  isActive: draft!.isActive,
                                });
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                            >
                              <Save size={12} />
                              {isSaving ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OverviewSection() {
  const statsQuery = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/api/admin/stats'),
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard
          title="Total Learners"
          value={statsQuery.data?.totalLearners ?? '–'}
          subtitle="Active learner accounts"
          icon={<Users size={20} />}
          accent="blue"
        />
        <StatCard
          title="Active Subscriptions"
          value={statsQuery.data?.activeSubs ?? '–'}
          subtitle="Paid learners currently active"
          icon={<Award size={20} />}
          accent="green"
        />
        <StatCard
          title="Published Courses"
          value={statsQuery.data?.publishedCourses ?? '–'}
          subtitle="Live content catalog"
          icon={<BookOpen size={20} />}
          accent="teal"
        />
        <StatCard
          title="Pending Approvals"
          value={statsQuery.data?.pendingApprovals ?? '–'}
          subtitle="Awaiting admin decision"
          icon={<Clock size={20} />}
          accent="amber"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Points Issued This Year</h2>
            <p className="text-sm text-slate-500 mt-1">Total CPD credit distributed across the platform.</p>
          </div>
          <div className="text-3xl font-bold tabular-nums text-rose-600">
            {statsQuery.data?.totalPointsIssuedThisYear ?? '–'}
          </div>
        </div>
      </div>

      <ApprovalsSection />
    </div>
  );
}

function ApprovalsSection({ standalone = false }: { standalone?: boolean }) {
  const qc = useQueryClient();
  const [notesByCourseId, setNotesByCourseId] = useState<Record<string, string>>({});
  const pendingQuery = useQuery<PendingCourse[]>({
    queryKey: ['pending-courses'],
    queryFn: () => api.get('/api/admin/courses/pending'),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, action, reviewerNotes }: { id: string; action: 'APPROVE' | 'REJECT'; reviewerNotes?: string }) =>
      api.post(`/api/courses/${id}/approve`, { action, reviewerNotes }),
    onSuccess: (_data, variables) => {
      toast.success(variables.action === 'APPROVE' ? 'Course approved.' : 'Course sent back to draft.');
      qc.invalidateQueries({ queryKey: ['pending-courses'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Could not process course approval.');
    },
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {standalone ? 'Course Approval Queue' : 'Pending Course Approvals'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">Pending approvals remain the primary admin action item.</p>
        </div>
      </div>

      {pendingQuery.isLoading ? (
        <div className="p-6 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-16 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
          ))}
        </div>
      ) : pendingQuery.isError ? (
        <div className="p-6">
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load pending course approvals.
          </div>
        </div>
      ) : !pendingQuery.data?.length ? (
        <EmptyState
          icon={<CheckCircle size={28} />}
          title="No courses pending review"
          description="The approval queue is clear right now."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Course', 'Creator', 'Points', 'Modules', 'Submitted', 'Review notes', 'Actions'].map((heading) => (
                  <th
                    key={heading}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingQuery.data.map((course) => (
                <tr key={course.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <div className="font-medium text-slate-900">{course.title}</div>
                    <div className="text-xs text-slate-500 mt-1">{course.status}</div>
                    {course.aiGeneratedAt ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="info">AI-generated</Badge>
                        {course.aiSourceName ? <Badge variant="default">{course.aiSourceName}</Badge> : null}
                        {course.aiGeneratedProvider ? <Badge variant="default">{course.aiGeneratedProvider}</Badge> : null}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-slate-700">{course.creator.fullName}</div>
                    <div className="text-xs text-slate-500 mt-1">{course.creator.email}</div>
                  </td>
                  <td className="px-4 py-4 tabular-nums">{course.cpdPoints}</td>
                  <td className="px-4 py-4 tabular-nums">{course._count.modules}</td>
                  <td className="px-4 py-4 text-slate-500">{formatDate(course.updatedAt)}</td>
                  <td className="px-4 py-4">
                    <label htmlFor={`review-notes-${course.id}`} className="sr-only">
                      Review notes for {course.title}
                    </label>
                    <textarea
                      id={`review-notes-${course.id}`}
                      value={notesByCourseId[course.id] ?? ''}
                      onChange={(e) =>
                        setNotesByCourseId((prev) => ({
                          ...prev,
                          [course.id]: e.target.value,
                        }))
                      }
                      placeholder="Optional notes (AI source, guideline reference, changes needed)…"
                      className="w-64 max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100"
                      rows={2}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          approveMutation.mutate({
                            id: course.id,
                            action: 'APPROVE',
                            reviewerNotes: notesByCourseId[course.id]?.trim() || undefined,
                          })
                        }
                        disabled={approveMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-60"
                      >
                        <CheckCircle size={12} />
                        Approve
                      </button>
                      <button
                        onClick={() =>
                          approveMutation.mutate({
                            id: course.id,
                            action: 'REJECT',
                            reviewerNotes: notesByCourseId[course.id]?.trim() || undefined,
                          })
                        }
                        disabled={approveMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        <XCircle size={12} />
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UsersSection() {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]>('ALL');
  const [page, setPage] = useState(1);

  const usersQuery = useQuery<UsersResponse>({
    queryKey: ['admin-users', search, role, page],
    queryFn: () =>
      api.get(
        `/api/admin/users?search=${encodeURIComponent(search)}&role=${role === 'ALL' ? '' : role}&page=${page}&limit=25`,
      ),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.patch(`/api/admin/users/${id}`, data),
    onSuccess: () => {
      toast.success('User updated.');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      qc.invalidateQueries({ queryKey: ['admin-audit'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not update user.'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/users/${id}`),
    onSuccess: () => {
      toast.success('User deactivated.');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-audit'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not deactivate user.'),
  });

  function applySearch() {
    setSearch(searchInput.trim());
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">User Management</h2>
          <p className="text-sm text-slate-500 mt-1">Search, approve, role-manage, and deactivate platform users.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[280px] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applySearch();
              }}
              placeholder="Search by name, email, or registration number"
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100"
            />
          </div>
          <label htmlFor="user-role-filter" className="sr-only">Filter by role</label>
          <select
            id="user-role-filter"
            value={role}
            onChange={(event) => {
              setRole(event.target.value as (typeof ROLE_OPTIONS)[number]);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === 'ALL' ? 'All roles' : option}
              </option>
            ))}
          </select>
          <button
            onClick={applySearch}
            className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
          >
            Search
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {usersQuery.isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-16 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
            ))}
          </div>
        ) : usersQuery.isError ? (
          <div className="p-6">
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Could not load users.
            </div>
          </div>
        ) : !usersQuery.data?.users.length ? (
          <EmptyState
            icon={<Users size={28} />}
            title="No users found"
            description="Try broadening your filters or clearing the current search."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['User', 'Role', 'Tier', 'Records', 'Status', 'Actions'].map((heading) => (
                      <th
                        key={heading}
                        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersQuery.data.users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-900">{user.fullName}</div>
                        <div className="text-xs text-slate-500 mt-1">{user.email}</div>
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={user.role}
                          onChange={(event) =>
                            toggleMutation.mutate({ id: user.id, data: { role: event.target.value } })
                          }
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100"
                        >
                          {ROLE_OPTIONS.filter((option) => option !== 'ALL').map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={user.subscriptionTier}
                          onChange={(event) =>
                            toggleMutation.mutate({ id: user.id, data: { subscriptionTier: event.target.value } })
                          }
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100"
                        >
                          {['FREE', 'STANDARD', 'INSTITUTION', 'DIASPORA'].map((tier) => (
                            <option key={tier} value={tier}>
                              {tier}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4 tabular-nums text-slate-700">{user._count.cpdRecords}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={user.isActive ? 'success' : 'error'}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge variant={user.isApproved ? 'info' : 'warning'}>
                            {user.isApproved ? 'Approved' : 'Pending'}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() =>
                              toggleMutation.mutate({ id: user.id, data: { isApproved: !user.isApproved } })
                            }
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {user.isApproved ? 'Unapprove' : 'Approve'}
                          </button>
                          <button
                            onClick={() =>
                              toggleMutation.mutate({ id: user.id, data: { isActive: !user.isActive } })
                            }
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {user.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => deactivateMutation.mutate(user.id)}
                            className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                          >
                            Soft delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {usersQuery.data.totalPages > 1 && (
              <div className="border-t border-slate-100 px-4 py-4 text-sm text-slate-500">
                Page {usersQuery.data.page} of {usersQuery.data.totalPages} · {usersQuery.data.total} users
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function GuidelineLabSection() {
  const token = useAuthStore((s) => s.accessToken);
  const [sourceMode, setSourceMode] = useState<'text' | 'url' | 'file'>('file');
  const [courseTitle, setCourseTitle] = useState('');
  const [sourceName, setSourceName] = useState('MOHCC / council official guideline');
  const [targetCadre, setTargetCadre] = useState('Registered General Nurse');
  const [category, setCategory] = useState<'CLINICAL' | 'MANAGEMENT' | 'ETHICS' | 'RESEARCH'>('CLINICAL');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<IngestGuidelineResponse | null>(null);

  const ingestMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('You must be logged in as an admin.');

      const form = new FormData();
      form.append('courseTitle', courseTitle);
      form.append('sourceName', sourceName);
      form.append('targetCadre', targetCadre);
      form.append('category', category);
      if (sourceMode === 'text') form.append('text', text);
      if (sourceMode === 'url') form.append('url', url);
      if (sourceMode === 'file' && file) form.append('file', file);

      const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/ai/ingest-guideline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: unknown };
        throw new Error(typeof body.error === 'string' ? body.error : `Guideline ingestion failed (${res.status})`);
      }

      return (await res.json()) as IngestGuidelineResponse;
    },
    onSuccess: (data) => {
      setResult(data);
      setText('');
      setUrl('');
      setFile(null);
      toast.success('Draft course created from guideline.');
      if (data.warnings?.length) {
        toast.info(data.warnings[0]);
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not ingest guideline.'),
  });

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Guideline Lab</h2>
          <p className="text-sm text-slate-500 mt-1">
            Create draft courses from pasted text, public URLs, or uploaded PDF guidelines. Admin-created drafts still require human review before publishing.
          </p>
        </div>

        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {([
            { key: 'file', label: 'Upload PDF' },
            { key: 'url', label: 'URL / PDF URL' },
            { key: 'text', label: 'Paste text' },
          ] as const).map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setSourceMode(option.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                sourceMode === option.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">Draft course title</label>
            <input
              value={courseTitle}
              onChange={(e) => setCourseTitle(e.target.value)}
              placeholder="e.g. Updated Paediatric Pneumonia Protocol"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">Source label</label>
            <input
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="e.g. MOHCC 2026 Guideline"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">Target cadre</label>
            <select
              value={targetCadre}
              onChange={(e) => setTargetCadre(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100"
            >
              <option>Registered General Nurse</option>
              <option>Registered Midwife</option>
              <option>Enrolled Nurse</option>
              <option>Community Health Nurse</option>
              <option>Clinical Nurse Specialist</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as 'CLINICAL' | 'MANAGEMENT' | 'ETHICS' | 'RESEARCH')}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100"
            >
              <option value="CLINICAL">Clinical</option>
              <option value="MANAGEMENT">Management</option>
              <option value="ETHICS">Ethics</option>
              <option value="RESEARCH">Research</option>
            </select>
          </div>
        </div>

        {sourceMode === 'file' ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">Upload guideline file</label>
            <input
              type="file"
              accept="application/pdf,.pdf,text/plain,.txt,text/html,.html"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100 file:mr-3 file:rounded-lg file:border-0 file:bg-rose-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-rose-700"
            />
            <p className="mt-2 text-xs text-slate-500">
              Best for official PDF guidelines. Uploads work best when the PDF contains selectable text instead of scanned images.
            </p>
          </div>
        ) : null}

        {sourceMode === 'url' ? (
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">Guideline URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://... or direct PDF URL"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100"
            />
            <p className="mt-2 text-xs text-slate-500">Supports HTML, plain text, and PDF URLs. Internal/private network URLs are rejected.</p>
          </div>
        ) : null}

        {sourceMode === 'text' ? (
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">Guideline text</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder="Paste the official guideline text here..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100 resize-none"
            />
            <p className="mt-2 text-xs text-slate-500">{text.length} characters</p>
          </div>
        ) : null}

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This creates a draft course only. An admin should still review structure, clinical accuracy, and quiz quality before approval or publication.
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => ingestMutation.mutate()}
            disabled={
              ingestMutation.isPending ||
              courseTitle.trim().length < 3 ||
              (sourceMode === 'text' ? text.trim().length < 100 : sourceMode === 'url' ? url.trim().length < 10 : !file)
            }
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            <FileUp size={16} />
            {ingestMutation.isPending ? 'Generating draft…' : 'Create Draft Course'}
          </button>
        </div>
      </div>

      {result ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Draft created</h3>
              <p className="text-sm text-slate-500 mt-1">{result.message}</p>
            </div>
            <Badge variant="warning">{result.status}</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Title</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{result.title}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source type</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{result.sourceType ?? '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Extracted text</p>
              <p className="mt-2 text-sm font-medium text-slate-900 tabular-nums">
                {result.extractedCharacters?.toLocaleString() ?? '—'} chars
              </p>
            </div>
          </div>

          {result.warnings?.length ? (
            <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {result.warnings[0]}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Link
              to={`/creator/courses/${result.courseId}/edit`}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Open draft in editor
            </Link>
            <Link
              to="/admin/courses"
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
            >
              Review approvals queue
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AnalyticsSection() {
  const monthlyQuery = useQuery<AnalyticsPoint[]>({
    queryKey: ['admin-analytics-monthly'],
    queryFn: () => api.get('/api/admin/analytics/monthly'),
  });
  const subscriptionQuery = useQuery<SubscriptionBreakdown[]>({
    queryKey: ['admin-analytics-subscriptions'],
    queryFn: () => api.get('/api/admin/analytics/subscriptions'),
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard title="Monthly Active Learners" description="Distinct learners with recorded platform activity in the last 6 months.">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyQuery.data ?? []}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="learners" stroke="#e11d48" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="CPD Points Distributed" description="Points credited per month across the platform.">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyQuery.data ?? []}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="points" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Subscription Tier Breakdown" description="Active learner distribution by subscription tier.">
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={subscriptionQuery.data ?? []}
              dataKey="count"
              nameKey="tier"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label
            >
              {(subscriptionQuery.data ?? []).map((entry, index) => (
                <Cell key={entry.tier} fill={PIE_COLOURS[index % PIE_COLOURS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function SettingsSection() {
  const qc = useQueryClient();
  const configQuery = useQuery<SystemConfig>({
    queryKey: ['admin-system-config'],
    queryFn: () => api.get('/api/admin/config/system'),
  });
  const aiHealthQuery = useQuery<AiHealth>({
    queryKey: ['admin-ai-health'],
    queryFn: () => api.get('/api/admin/ai/health'),
    refetchInterval: 30000,
  });

  const [selectedProvider, setSelectedProvider] = useState('');

  useEffect(() => {
    if (configQuery.data?.aiProvider) {
      setSelectedProvider(configQuery.data.aiProvider);
    }
  }, [configQuery.data?.aiProvider]);

  const aiMutation = useMutation({
    mutationFn: (provider: string) => api.patch('/api/admin/config/ai', { provider }),
    onSuccess: () => {
      toast.success('AI provider updated.');
      qc.invalidateQueries({ queryKey: ['admin-system-config'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not update AI provider.'),
  });

  const maintenanceMutation = useMutation({
    mutationFn: (maintenanceMode: boolean) => api.patch('/api/admin/config/system', { maintenanceMode }),
    onSuccess: () => {
      toast.success('System configuration updated.');
      qc.invalidateQueries({ queryKey: ['admin-system-config'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not update system configuration.'),
  });

  // Council management lives in /admin/councils (dedicated home).

  if (configQuery.isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-40 rounded-xl border border-slate-200 bg-white animate-pulse" />
        ))}
      </div>
    );
  }

  if (configQuery.isError || !configQuery.data) {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Could not load system configuration.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">AI Provider</h2>
          <p className="text-sm text-slate-500 mt-1">Select the active AI provider used for platform intelligence features.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedProvider}
            onChange={(event) => setSelectedProvider(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100"
          >
            {configQuery.data.availableProviders.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
          <button
            onClick={() => aiMutation.mutate(selectedProvider)}
            className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
          >
            Save provider
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {configQuery.data.availableProviders.map((provider) => (
            <Badge
              key={provider}
              variant={configQuery.data.configuredProviders.includes(provider) ? 'success' : 'warning'}
            >
              {provider} {configQuery.data.configuredProviders.includes(provider) ? 'configured' : 'missing key'}
            </Badge>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">AI Tutor Health (last 24h)</h2>
          <p className="text-sm text-slate-500 mt-1">Operational visibility into provider stability, latency, cache, and fallbacks.</p>
        </div>

        {aiHealthQuery.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
            ))}
          </div>
        ) : aiHealthQuery.isError || !aiHealthQuery.data ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load AI tutor health telemetry.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Requests</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{aiHealthQuery.data.requests}</p>
              <p className="mt-1 text-xs text-slate-500">
                Cache hits: <span className="font-medium tabular-nums">{aiHealthQuery.data.cacheHits}</span>
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avg latency</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                {aiHealthQuery.data.avgLatencyMs == null ? '—' : `${aiHealthQuery.data.avgLatencyMs}ms`}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Fallbacks: <span className="font-medium tabular-nums">{aiHealthQuery.data.fallbacks}</span>
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Failures</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{aiHealthQuery.data.failures}</p>
              <p className="mt-1 text-xs text-slate-500">
                Last: {aiHealthQuery.data.lastFailureAt ? formatDateTime(aiHealthQuery.data.lastFailureAt) : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paywalls</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{aiHealthQuery.data.paywalls}</p>
              <p className="mt-1 text-xs text-slate-500">
                Active: <span className="font-medium">{aiHealthQuery.data.activeProvider ?? '—'}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Maintenance Mode</h2>
            <p className="text-sm text-slate-500 mt-1">Temporarily restrict access for non-admin users during platform maintenance.</p>
          </div>
          <button
            onClick={() => maintenanceMutation.mutate(!configQuery.data!.maintenanceMode)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              configQuery.data.maintenanceMode
                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                : 'bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            {configQuery.data.maintenanceMode ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">CPD Rules</h2>
          <p className="text-sm text-slate-500 mt-1">Current annual requirements and default activity credits.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(configQuery.data.cpdRules).map(([cadre, points]) => (
            <div key={cadre} className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between">
              <span className="text-sm text-slate-700">{cadre}</span>
              <span className="text-sm font-semibold tabular-nums text-slate-900">{points} pts</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Subscription Pricing</h2>
          <p className="text-sm text-slate-500 mt-1">Read-only pricing reference for current subscription tiers.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {configQuery.data.subscriptionPricing.map((tier) => (
            <div key={tier.tier} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{tier.tier}</p>
                  <p className="text-xs text-slate-500 mt-1">{tier.label}</p>
                </div>
                <div className="text-lg font-bold tabular-nums text-rose-600">${tier.priceUsd}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <h2 className="text-base font-semibold text-slate-900">Council Sync Schedule</h2>
        <p className="text-sm text-slate-500 mt-1">Current backend schedule: <span className="font-mono text-xs">{configQuery.data.councilSyncSchedule}</span></p>
      </div>
    </div>
  );
}

function AuditSection() {
  const auditQuery = useQuery<AuditResponse>({
    queryKey: ['admin-audit'],
    queryFn: () => api.get('/api/admin/audit'),
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-900">Audit Log</h2>
        <p className="text-sm text-slate-500 mt-1">Recent administrative actions and system governance events.</p>
      </div>

      {auditQuery.isLoading ? (
        <div className="p-6 space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-16 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
          ))}
        </div>
      ) : auditQuery.isError ? (
        <div className="p-6">
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load audit log.
          </div>
        </div>
      ) : !auditQuery.data?.logs.length ? (
        <EmptyState
          icon={<ShieldAlert size={28} />}
          title="No audit events yet"
          description="Administrative actions will be recorded here automatically."
        />
      ) : (
        <div className="divide-y divide-slate-100">
          {auditQuery.data.logs.map((log) => (
            <div key={log.id} className="px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{log.action.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {log.user.fullName} · {log.user.email}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {log.entityType ?? 'System'} {log.entityId ? `· ${log.entityId}` : ''}
                  </p>
                </div>
                <div className="text-xs text-slate-500 whitespace-nowrap">{formatDateTime(log.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReleaseReadinessSection() {
  const telemetryQuery = useQuery<TelemetrySummary>({
    queryKey: ['admin-telemetry-summary'],
    queryFn: () => api.get('/api/admin/telemetry/summary'),
    refetchInterval: 30000,
  });

  const checklist = [
    { label: 'Offline quizzes work + sync safely', status: 'done' },
    { label: 'WhatsApp CPD credit dedupe + cap enforced', status: 'done' },
    { label: 'Council sync blocked/failed queues + dry-run safety', status: 'done' },
    { label: 'AI tutor gating + safety wrapper + fallback', status: 'done' },
    { label: 'Recommendations use weakness/deadline signals + reasons', status: 'done' },
    { label: 'AI guideline→course flow has review trail', status: 'done' },
    { label: 'Manual QA checklist completed', status: 'pending' },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-2">
        <h2 className="text-base font-semibold text-slate-900">Feature-truth matrix (internal)</h2>
        <p className="text-sm text-slate-500">
          This is an internal “truth” view: it should match real backend behavior, not marketing copy.
        </p>
        <div className="mt-4 space-y-2">
          {checklist.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-800">{item.label}</p>
              <Badge variant={item.status === 'done' ? 'success' : 'warning'}>
                {item.status === 'done' ? 'Ready' : 'Needs QA'}
              </Badge>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Manual QA doc: <span className="font-mono">docs/QA_PRE_MOBILE.md</span>
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Release telemetry snapshot (last 24h)</h2>
          <p className="text-sm text-slate-500 mt-1">Basic volume signals for launch readiness and ops monitoring.</p>
        </div>

        {telemetryQuery.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
            ))}
          </div>
        ) : telemetryQuery.isError || !telemetryQuery.data ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load telemetry summary.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Offline downloads</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{telemetryQuery.data.offlineDownloads24h}</p>
              <p className="mt-1 text-xs text-slate-500">Web module downloads</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quiz attempts</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{telemetryQuery.data.quizAttempts24h}</p>
              <p className="mt-1 text-xs text-slate-500">All channels</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Enrollments</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                {telemetryQuery.data.enrollments.inProgress}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                In progress · Completed {telemetryQuery.data.enrollments.completed}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI tutor events</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{telemetryQuery.data.botAiTutorEvents24h}</p>
              <p className="mt-1 text-xs text-slate-500">WhatsApp tutor usage</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentsSection() {
  const summaryQuery = useQuery<SubscriptionSummary>({
    queryKey: ['admin-subscriptions-summary'],
    queryFn: () => api.get('/api/admin/subscriptions/summary'),
  });
  const recentQuery = useQuery<RecentSubscriptionsResponse>({
    queryKey: ['admin-subscriptions-recent'],
    queryFn: () => api.get('/api/admin/subscriptions/recent?limit=12'),
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard
          title="Active Paid Subscriptions"
          value={summaryQuery.data?.activeTotal ?? '–'}
          subtitle="Learners currently on paid access"
          icon={<CreditCard size={20} />}
          accent="green"
        />
        <StatCard
          title="Expiring In 30 Days"
          value={summaryQuery.data?.expiringSoon ?? '–'}
          subtitle="Renewal follow-up candidates"
          icon={<Clock size={20} />}
          accent="amber"
        />
        <StatCard
          title="Paynow Transactions"
          value={summaryQuery.data?.byGateway.find((item) => item.gateway === 'paynow')?.count ?? 0}
          subtitle="Recorded subscription payments"
          icon={<CreditCard size={20} />}
          accent="blue"
        />
        <StatCard
          title="Stripe Transactions"
          value={summaryQuery.data?.byGateway.find((item) => item.gateway === 'stripe')?.count ?? 0}
          subtitle="Recorded subscription payments"
          icon={<CreditCard size={20} />}
          accent="teal"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Subscription Tier Distribution</h2>
          <p className="text-sm text-slate-500 mt-1">Current paid-plan mix based on recorded subscription rows.</p>
        </div>
        {summaryQuery.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
            ))}
          </div>
        ) : summaryQuery.isError || !summaryQuery.data ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load subscription summary.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {summaryQuery.data.byTier.map((item) => (
              <div key={item.tier} className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.tier}</p>
                  <p className="text-xs text-slate-500 mt-1">Recorded subscription rows</p>
                </div>
                <div className="text-2xl font-bold tabular-nums text-slate-900">{item.count}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recent Confirmed Payments</h2>
            <p className="text-sm text-slate-500 mt-1">Latest subscription activations from gateway callbacks.</p>
          </div>
        </div>

        {recentQuery.isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-16 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
            ))}
          </div>
        ) : recentQuery.isError ? (
          <div className="p-6">
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Could not load recent payments.
            </div>
          </div>
        ) : !recentQuery.data?.subscriptions.length ? (
          <EmptyState
            icon={<CreditCard size={28} />}
            title="No confirmed payments yet"
            description="Subscription activity will appear here once payment callbacks start recording purchases."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['Learner', 'Tier', 'Gateway', 'Started', 'Expires', 'Reference'].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentQuery.data.subscriptions.map((subscription) => (
                  <tr key={subscription.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900">{subscription.learner?.fullName ?? 'Unknown learner'}</div>
                      <div className="text-xs text-slate-500 mt-1">{subscription.learner?.email ?? 'No email recorded'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant="info">{subscription.tier}</Badge>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{subscription.gateway ?? '—'}</td>
                    <td className="px-4 py-4 text-slate-500">{formatDate(subscription.startsAt)}</td>
                    <td className="px-4 py-4 text-slate-500">{formatDate(subscription.expiresAt)}</td>
                    <td className="px-4 py-4 font-mono text-xs text-slate-400">{subscription.paymentRef ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CouncilSyncSection() {
  const summaryQuery = useQuery<NczSyncSummary>({
    queryKey: ['admin-council-sync-summary'],
    queryFn: () => api.get('/api/council/sync/summary'),
    refetchInterval: 30000,
  });
  const logsQuery = useQuery<NczSyncLog[]>({
    queryKey: ['admin-council-sync-logs'],
    queryFn: () => api.get('/api/council/sync/logs'),
    refetchInterval: 30000,
  });

  const syncMode = summaryQuery.data?.mode ?? 'dry_run';

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Council sync mode</p>
        <p className="mt-1 text-lg font-bold text-slate-900">
          {syncMode === 'live' ? 'Live' : syncMode === 'disabled' ? 'Disabled' : 'Dry run'}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {syncMode === 'live'
            ? 'Records are submitted to the configured council endpoint.'
            : syncMode === 'disabled'
              ? 'Automatic submission is disabled by configuration.'
              : 'No council endpoint/API key is configured, so records are not submitted.'}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard
          title="Pending"
          value={summaryQuery.data?.pending ?? '–'}
          subtitle="Awaiting next sync"
          icon={<RefreshCw size={20} />}
          accent="amber"
        />
        <StatCard
          title="Blocked"
          value={summaryQuery.data?.blocked ?? '–'}
          subtitle="Missing registration number"
          icon={<XCircle size={20} />}
          accent="red"
        />
        <StatCard
          title="Failed"
          value={summaryQuery.data?.failed ?? '–'}
          subtitle="Needs retry or investigation"
          icon={<ShieldAlert size={20} />}
          accent="red"
        />
        <StatCard
          title="Synced"
          value={summaryQuery.data?.synced ?? '–'}
          subtitle="Successfully synced to council"
          icon={<CheckCircle size={20} />}
          accent="green"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Council Sync Operations</h2>
            <p className="text-sm text-slate-500 mt-1">
              Council registry sync logs and integration health. Each council manages its own sync endpoint via the Council Portal.
            </p>
          </div>
          <Link
            to="/council"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Open Council Portal
            <ArrowRight size={15} />
          </Link>
        </div>

        {logsQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-16 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
            ))}
          </div>
        ) : logsQuery.isError ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load council sync logs.
          </div>
        ) : !logsQuery.data?.length ? (
          <EmptyState
            icon={<RefreshCw size={28} />}
            title="No council sync logs yet"
            description="Sync history will appear here once the first scheduled or manual run happens."
          />
        ) : (
          <div className="space-y-3">
            {logsQuery.data.slice(0, 8).map((log) => (
              <div key={log.id} className="rounded-xl border border-slate-200 p-4 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={log.success ? 'success' : 'error'}>{log.success ? 'Success' : 'Issue'}</Badge>
                    {log.dryRun ? <Badge variant="warning">Dry run</Badge> : null}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {log.recordCount} record{log.recordCount === 1 ? '' : 's'} processed
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Triggered by {log.triggeredBy ?? 'system scheduler'}
                  </p>
                  {log.errorMessage ? (
                    <p className="mt-2 text-xs text-red-600">{log.errorMessage}</p>
                  ) : null}
                </div>
                <div className="text-xs text-slate-500 whitespace-nowrap">{formatDateTime(log.syncedAt)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500 mt-1 mb-4">{description}</p>
      <div className="h-[280px]">{children}</div>
    </div>
  );
}

// ─── Vouchers Section ─────────────────────────────────────────────────────────

interface VoucherBatch {
  id: string;
  name: string;
  sponsorName: string;
  tier: string;
  totalCount: number;
  redeemed: number;
  remaining: number;
  expiresAt: string | null;
  notes: string | null;
  createdAt: string;
  createdBy: { fullName: string; email: string };
}

interface VoucherRow {
  id: string;
  code: string;
  tier: string;
  redeemedAt: string | null;
  redeemedBy: {
    id: string;
    fullName: string;
    email: string;
    cadre: string | null;
    nczRegistrationNumber: string | null;
  } | null;
}

interface BatchDetail extends VoucherBatch {
  vouchers: VoucherRow[];
}

interface CreateVoucherBatchResponse {
  batch: Pick<VoucherBatch, 'id' | 'name' | 'sponsorName' | 'tier' | 'totalCount' | 'createdAt'>;
  count: number;
}

interface VoucherLookupResponse {
  voucher: VoucherRow & { batch: { name: string; sponsorName: string } };
}

const TIER_COLOURS: Record<string, string> = {
  STANDARD: 'bg-teal-100 text-teal-800',
  DIASPORA: 'bg-blue-100 text-blue-800',
};

function VouchersSection() {
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.accessToken);
  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [lookupCode, setLookupCode] = useState('');
  const [lookupResult, setLookupResult] = useState<VoucherRow & { batch: { name: string; sponsorName: string } } | null>(null);
  const [lookupError, setLookupError] = useState('');

  // Generate form state
  const [form, setForm] = useState({
    name: '',
    sponsorName: '',
    tier: 'STANDARD' as 'STANDARD' | 'DIASPORA' | 'INSTITUTION',
    count: 100,
    expiresAt: '',
    notes: '',
    institutionContactEmail: '',
  });

  const batchesQuery = useQuery<{ batches: VoucherBatch[] }>({
    queryKey: ['admin-voucher-batches'],
    queryFn: () => api.get('/api/admin/vouchers/batches'),
  });

  const batchDetailQuery = useQuery<{ batch: BatchDetail }>({
    queryKey: ['admin-voucher-batch', selectedBatchId],
    queryFn: () => api.get(`/api/admin/vouchers/batches/${selectedBatchId}`),
    enabled: !!selectedBatchId,
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      api.post<CreateVoucherBatchResponse>('/api/admin/vouchers/batches', {
        ...form,
        count: Number(form.count),
        expiresAt: form.expiresAt || undefined,
        notes: form.notes || undefined,
        institutionContactEmail: form.institutionContactEmail || undefined,
      }),
    onSuccess: (data) => {
      toast.success(`Generated ${data.count} voucher codes for "${form.name}".`);
      qc.invalidateQueries({ queryKey: ['admin-voucher-batches'] });
      setShowGenerate(false);
      setForm({ name: '', sponsorName: '', tier: 'STANDARD', count: 100, expiresAt: '', notes: '', institutionContactEmail: '' });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Generation failed'),
  });

  async function handleLookup() {
    setLookupError('');
    setLookupResult(null);
    try {
      const data = await api.get<VoucherLookupResponse>(
        `/api/admin/vouchers/lookup?code=${encodeURIComponent(lookupCode.trim())}`,
      );
      setLookupResult(data.voucher);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'Not found');
    }
  }

  async function downloadBatchCsv(batchId: string, batchName: string) {
    if (!token) {
      toast.error('You must be logged in as an admin.');
      return;
    }

    try {
      const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
      const response = await fetch(`${baseUrl}/api/admin/vouchers/batches/${batchId}/export.csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`Export failed (${response.status})`);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vouchers-${batchName.replace(/[^a-z0-9]+/gi, '-')}-${batchId.slice(-6)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    }
  }

  const batches = batchesQuery.data?.batches ?? [];
  const detail  = batchDetailQuery.data?.batch;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-900">Sponsor Vouchers</h2>
            <p className="text-sm text-slate-600 mt-2 max-w-2xl leading-relaxed">
              Generate voucher codes for NGOs, sponsors, or institutions. Each code upgrades one
              learner's account when redeemed. Codes are single-use and linked to the learner for audit.
            </p>
          </div>
          <button
            onClick={() => setShowGenerate(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
          >
            <Plus size={16} />
            Generate Batch
          </button>
        </div>

        {/* Stats row */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total batches',  value: batches.length },
            { label: 'Total codes',    value: batches.reduce((s, b) => s + b.totalCount, 0) },
            { label: 'Redeemed',       value: batches.reduce((s, b) => s + b.redeemed, 0) },
            { label: 'Still available', value: batches.reduce((s, b) => s + b.remaining, 0) },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-2xl font-bold tabular-nums text-slate-900">{stat.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Generate modal ── */}
      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Generate Voucher Batch</h3>
              <button onClick={() => setShowGenerate(false)} className="text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Batch name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. UNICEF Q1 2026 – Standard"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Sponsor / NGO name *</label>
                <input
                  value={form.sponsorName}
                  onChange={(e) => setForm((f) => ({ ...f, sponsorName: e.target.value }))}
                  placeholder="e.g. UNICEF Zimbabwe"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Subscription tier *</label>
                  <select
                    value={form.tier}
                    onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value as 'STANDARD' | 'DIASPORA' | 'INSTITUTION' }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  >
                    <option value="STANDARD">Standard ($10/yr value)</option>
                    <option value="DIASPORA">Diaspora ($15/yr value)</option>
                    <option value="INSTITUTION">Institution ($99/yr value)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Number of codes *</label>
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    value={form.count}
                    onChange={(e) => setForm((f) => ({ ...f, count: parseInt(e.target.value, 10) || 1 }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Expiry date (optional)</label>
                <input
                  type="date"
                  value={form.expiresAt ? form.expiresAt.substring(0, 10) : ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      expiresAt: e.target.value ? new Date(e.target.value).toISOString() : '',
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                />
                <p className="text-xs text-slate-400 mt-1">Leave blank for no expiry.</p>
              </div>
              {form.tier === 'INSTITUTION' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Institution contact email (optional)
                  </label>
                  <input
                    type="email"
                    value={form.institutionContactEmail}
                    onChange={(e) => setForm((f) => ({ ...f, institutionContactEmail: e.target.value }))}
                    placeholder="hr-lead@hospital.org (must already have a ZimHealth account)"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    This person gets access to the institution dashboard to invite staff and view compliance — without
                    being a system admin.
                  </p>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Internal notes (optional)</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Sponsored under MoHCC partnership agreement ref #2026-04"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowGenerate(false)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || !form.name || !form.sponsorName || form.count < 1}
                className="flex-1 rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40"
              >
                {generateMutation.isPending ? `Generating ${form.count} codes…` : `Generate ${form.count} codes`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Batch detail panel ── */}
      {selectedBatchId && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedBatchId(null)}
                className="text-slate-400 hover:text-slate-700"
                title="Back to list"
              >
                <ChevronLeft size={20} />
              </button>
              {detail ? (
                <div>
                  <p className="font-semibold text-slate-900">{detail.name}</p>
                  <p className="text-xs text-slate-500">Sponsor: {detail.sponsorName}</p>
                </div>
              ) : (
                <div className="h-5 w-48 animate-pulse bg-slate-200 rounded" />
              )}
            </div>
            {detail && (
              <button
                type="button"
                onClick={() => void downloadBatchCsv(selectedBatchId, detail.name)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download size={14} />
                Export CSV
              </button>
            )}
          </div>

          {batchDetailQuery.isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : detail ? (
            <>
              {/* Batch stats */}
              <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
                {[
                  { label: 'Total codes', value: detail.totalCount },
                  { label: 'Redeemed',    value: detail.redeemed },
                  { label: 'Available',   value: detail.remaining },
                ].map((s) => (
                  <div key={s.label} className="px-6 py-4 text-center">
                    <p className="text-2xl font-bold tabular-nums text-slate-900">{s.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Voucher table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Code</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Redeemed by</th>
                      <th className="px-4 py-3 text-left">Redeemed at</th>
                      <th className="px-4 py-3 text-left">Council Reg</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.vouchers.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">{v.code}</td>
                        <td className="px-4 py-3">
                          {v.redeemedAt ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                              <CheckCircle size={10} />
                              Redeemed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                              Available
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {v.redeemedBy ? (
                            <div>
                              <p className="font-medium">{v.redeemedBy.fullName}</p>
                              <p className="text-xs text-slate-400">{v.redeemedBy.email}</p>
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                          {v.redeemedAt ? formatDateTime(v.redeemedAt) : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs font-mono">
                          {v.redeemedBy?.nczRegistrationNumber ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ── Batch list ── */}
      {!selectedBatchId && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-900">All Voucher Batches</h3>
            <p className="text-sm text-slate-500 mt-0.5">Click a batch to view individual codes and redemption audit trail.</p>
          </div>

          {batchesQuery.isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : batches.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Ticket size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">No voucher batches yet.</p>
              <p className="text-xs text-slate-400 mt-1">Generate a batch to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {batches.map((batch) => {
                const pct = batch.totalCount > 0 ? Math.round((batch.redeemed / batch.totalCount) * 100) : 0;
                const expired = batch.expiresAt && new Date(batch.expiresAt) < new Date();
                return (
                  <button
                    key={batch.id}
                    onClick={() => setSelectedBatchId(batch.id)}
                    className="w-full text-left px-6 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900 truncate">{batch.name}</p>
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TIER_COLOURS[batch.tier] ?? 'bg-slate-100 text-slate-600'}`}>
                            {batch.tier}
                          </span>
                          {expired && (
                            <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
                              Expired
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {batch.sponsorName} · Created by {batch.createdBy.fullName} · {formatDate(batch.createdAt)}
                          {batch.expiresAt ? ` · Expires ${formatDate(batch.expiresAt)}` : ''}
                        </p>
                        {/* Redemption progress bar */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-primary-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-slate-500 whitespace-nowrap tabular-nums">
                            {batch.redeemed} / {batch.totalCount} used
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 flex-shrink-0 mt-1" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Code lookup ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <h3 className="text-base font-semibold text-slate-900">Code Lookup</h3>
        <p className="text-sm text-slate-500 mt-0.5 mb-4">Look up any voucher code to see its status and redemption details.</p>

        <div className="flex gap-3 max-w-md">
          <input
            value={lookupCode}
            onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && void handleLookup()}
            placeholder="ZHCPD-XXXX-XXXX-XXXX"
            className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
          <button
            onClick={handleLookup}
            disabled={!lookupCode.trim()}
            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
          >
            Look up
          </button>
        </div>

        {lookupError && (
          <p className="mt-3 text-sm text-red-600">{lookupError}</p>
        )}

        {lookupResult && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm max-w-lg">
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold text-slate-900">{lookupResult.code}</span>
              {lookupResult.redeemedAt ? (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Redeemed</span>
              ) : (
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">Available</span>
              )}
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIER_COLOURS[lookupResult.tier] ?? ''}`}>
                {lookupResult.tier}
              </span>
            </div>
            <p className="text-slate-500 text-xs">
              Batch: <span className="text-slate-700 font-medium">{lookupResult.batch.name}</span>
              {' '}· Sponsor: <span className="text-slate-700 font-medium">{lookupResult.batch.sponsorName}</span>
            </p>
            {lookupResult.redeemedBy && (
              <div className="border-t border-slate-200 pt-2 mt-2">
                <p className="text-xs font-semibold text-slate-700 mb-1">Redeemed by</p>
                <p className="text-xs text-slate-600">{lookupResult.redeemedBy.fullName} · {lookupResult.redeemedBy.email}</p>
                <p className="text-xs text-slate-500">
                  {lookupResult.redeemedBy.cadre ?? 'Cadre unknown'}
                  {lookupResult.redeemedBy.nczRegistrationNumber ? ` · Reg: ${lookupResult.redeemedBy.nczRegistrationNumber}` : ''}
                </p>
                {lookupResult.redeemedAt && (
                  <p className="text-xs text-slate-400 mt-0.5">At: {formatDateTime(lookupResult.redeemedAt)}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
