import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  BookOpen,
  Award,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  ShieldAlert,
  Settings,
  BarChart2,
  CreditCard,
  RefreshCw,
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
  creator: { fullName: string; email: string };
  _count: { modules: number };
  updatedAt: string;
}

interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: 'ADMIN' | 'CONTENT_MANAGER' | 'NCZ_OFFICER' | 'LEARNER';
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
  nczSyncSchedule: string;
  cpdRules: Record<string, number>;
  activityPoints: Record<string, number>;
  subscriptionPricing: Array<{ tier: string; priceUsd: number; label: string }>;
}

const ADMIN_SECTIONS = [
  { key: 'dashboard', label: 'Dashboard', path: '/admin', icon: Users },
  { key: 'users', label: 'Users', path: '/admin/users', icon: Users },
  { key: 'courses', label: 'Course Approvals', path: '/admin/courses', icon: BookOpen },
  { key: 'analytics', label: 'Analytics', path: '/admin/analytics', icon: BarChart2 },
  { key: 'payments', label: 'Payments', path: '/admin/payments', icon: CreditCard },
  { key: 'ncz-sync', label: 'NCZ Sync', path: '/admin/ncz-sync', icon: RefreshCw },
  { key: 'audit', label: 'Audit Log', path: '/admin/audit', icon: ShieldAlert },
  { key: 'settings', label: 'Settings', path: '/admin/settings', icon: Settings },
] as const;

const ROLE_OPTIONS = ['ALL', 'ADMIN', 'CONTENT_MANAGER', 'NCZ_OFFICER', 'LEARNER'] as const;
const PIE_COLOURS = ['#e11d48', '#14b8a6', '#2563eb', '#f59e0b'];

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
      {section === 'users' && <UsersSection />}
      {section === 'courses' && <ApprovalsSection standalone />}
      {section === 'analytics' && <AnalyticsSection />}
      {section === 'audit' && <AuditSection />}
      {section === 'settings' && <SettingsSection />}
      {section === 'payments' && (
        <PlaceholderSection
          title="Payments Oversight"
          description="Payment reconciliation and gateway-level controls are next in the admin roadmap."
          icon={<CreditCard size={28} />}
        />
      )}
      {section === 'ncz-sync' && (
        <PlaceholderSection
          title="NCZ Sync Oversight"
          description="Use the NCZ portal for live sync status. Admin-level sync controls can be added here later."
          icon={<RefreshCw size={28} />}
        />
      )}
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
  const pendingQuery = useQuery<PendingCourse[]>({
    queryKey: ['pending-courses'],
    queryFn: () => api.get('/api/admin/courses/pending'),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'APPROVE' | 'REJECT' }) =>
      api.post(`/api/courses/${id}/approve`, { action }),
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
                {['Course', 'Creator', 'Points', 'Modules', 'Submitted', 'Actions'].map((heading) => (
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
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-slate-700">{course.creator.fullName}</div>
                    <div className="text-xs text-slate-500 mt-1">{course.creator.email}</div>
                  </td>
                  <td className="px-4 py-4 tabular-nums">{course.cpdPoints}</td>
                  <td className="px-4 py-4 tabular-nums">{course._count.modules}</td>
                  <td className="px-4 py-4 text-slate-500">{formatDate(course.updatedAt)}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => approveMutation.mutate({ id: course.id, action: 'APPROVE' })}
                        disabled={approveMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-60"
                      >
                        <CheckCircle size={12} />
                        Approve
                      </button>
                      <button
                        onClick={() => approveMutation.mutate({ id: course.id, action: 'REJECT' })}
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
              placeholder="Search by name, email, or NCZ number"
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
              <Bar dataKey="points" fill="#14b8a6" radius={[8, 8, 0, 0]} />
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
        <h2 className="text-base font-semibold text-slate-900">NCZ Sync Schedule</h2>
        <p className="text-sm text-slate-500 mt-1">Current backend schedule: <span className="font-mono text-xs">{configQuery.data.nczSyncSchedule}</span></p>
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

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500 mt-1 mb-4">{description}</p>
      <div className="h-[280px]">{children}</div>
    </div>
  );
}

function PlaceholderSection({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <EmptyState icon={icon} title={title} description={description} />
    </div>
  );
}
