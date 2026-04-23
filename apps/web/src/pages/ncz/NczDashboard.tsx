import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Download,
  CheckCircle,
  XCircle,
  Users,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  FileText,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { StatCard } from '../../components/ui/StatCard';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { toast } from '../../components/ui/Toast';
import { useAuthStore } from '../../store/auth.store';

interface ComplianceData {
  year: number;
  totalLearners: number;
  compliantCount: number;
  nonCompliantCount: number;
  complianceRate: number;
}

interface Learner {
  id: string;
  fullName: string;
  email: string;
  nczRegistrationNumber?: string | null;
  registrationNumber?: string | null;
  professionalTitle?: string | null;
  cadre?: string | null; // legacy (kept for old NCZ data)
  institution?: string | null;
  province?: string | null;
  district?: string | null;
  subscriptionTier: string;
  isActive: boolean;
  currentYearPoints: number;
  isCompliant: boolean;
}

interface LearnersResponse {
  learners: Learner[];
  total: number;
  page: number;
  totalPages: number;
}

interface HistoryRecord {
  id: string;
  activityType: string;
  pointsEarned: number;
  completedAt: string;
  cycleYear: number;
  course?: { title: string; cpdPoints: number } | null;
}

interface CertificateRecord {
  id: string;
  certificateUuid: string;
  cycleYear: number;
  totalPoints: number;
  issuedAt: string;
}

interface LearnerHistoryResponse {
  learner: Learner;
  records: HistoryRecord[];
  certificates: CertificateRecord[];
}

interface SyncLog {
  id: string;
  triggeredBy?: string | null;
  recordCount: number;
  success: boolean;
  errorMessage?: string | null;
  dryRun?: boolean;
  meta?: unknown;
  syncedAt: string;
}

interface SyncSummary {
  pending: number;
  blocked: number;
  failed: number;
  synced: number;
}

interface SyncRecordRow {
  id: string;
  pointsEarned: number;
  activityType: string;
  completedAt: string;
  cycleYear: number;
  nczLastError?: string | null;
  nczLastAttemptAt?: string | null;
  learner: { id: string; fullName: string; email: string; nczRegistrationNumber?: string | null };
  course?: { title: string } | null;
}

type CouncilCourseReviewStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

interface CouncilCourseReviewRow {
  id: string;
  courseId: string;
  councilId: string;
  status: CouncilCourseReviewStatus;
  points?: number | null;
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  updatedAt: string;
  course: {
    id: string;
    title: string;
    subtitle?: string | null;
    category: string;
    difficulty: string;
    language: string;
    estimatedMinutes: number;
    thumbnailUrl?: string | null;
    tags: string[];
    status: string;
    creator: { id: string; fullName: string; email: string };
  };
  reviewedBy?: { id: string; fullName: string; email: string } | null;
}

type TitleOption = { value: string; label: string };

type SectionKey = 'dashboard' | 'search' | 'courses' | 'reports' | 'sync' | 'settings';

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month1to12: number) {
  const m = Math.min(Math.max(month1to12, 1), 12);
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[m - 1];
}

function clampRenewalDay(year: number, month1to12: number, day1to31: number) {
  const m = Math.min(Math.max(month1to12, 1), 12);
  return Math.min(Math.max(day1to31, 1), daysInMonth(year, m));
}

function toDateInputValue(year: number, month1to12: number, day1to31: number) {
  const m = Math.min(Math.max(month1to12, 1), 12);
  const d = clampRenewalDay(year, m, day1to31);
  return `${year}-${pad2(m)}-${pad2(d)}`;
}

function formatRenewalLabel(month1to12: number, day1to31: number) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const m = Math.min(Math.max(month1to12, 1), 12);
  const d = Math.min(Math.max(day1to31, 1), 31);
  return `${d} ${months[m - 1]}`;
}

function buildSections(basePath: '/ncz' | '/council') {
  return [
    { key: 'dashboard' as const, label: 'Dashboard', path: `${basePath}` },
    { key: 'search' as const, label: 'Learner Search', path: `${basePath}/search` },
    { key: 'courses' as const, label: 'Course Reviews', path: `${basePath}/courses` },
    { key: 'reports' as const, label: 'Reports', path: `${basePath}/reports` },
    { key: 'sync' as const, label: 'Sync Status', path: `${basePath}/sync` },
    { key: 'settings' as const, label: 'Council Settings', path: `${basePath}/settings` },
  ];
}

function getSection(pathname: string, sections: Array<{ key: SectionKey; path: string }>) {
  const matches = (section: { key: SectionKey; path: string }) => {
    if (section.path.endsWith('/ncz') || section.path.endsWith('/council')) return pathname === section.path;
    return pathname === section.path || pathname.startsWith(`${section.path}/`);
  };

  const sorted = [...sections].sort((a, b) => b.path.length - a.path.length);
  return sorted.find(matches)?.key ?? 'dashboard';
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-ZW', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
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

function buildCsvUrl(): string {
  const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
  return `${baseUrl}/api/ncz/export/csv`;
}

export default function NczDashboard() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const storeUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const basePath = location.pathname.startsWith('/council') ? '/council' : '/ncz';
  const sections = useMemo(() => buildSections(basePath), [basePath]);
  const section = getSection(location.pathname, sections);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [professionalTitle, setProfessionalTitle] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLearner, setSelectedLearner] = useState<Learner | null>(null);
  const [savingCouncil, setSavingCouncil] = useState(false);

  const meQuery = useQuery({
    queryKey: ['auth-me'],
    queryFn: () =>
      api.get<{
        council?: { id: string; name: string; acronym: string; requiredPoints: number; renewalMonth: number; renewalDay: number } | null;
      }>('/api/auth/me'),
    staleTime: 1000 * 60 * 5,
  });

  const councilName = meQuery.data?.council?.name ?? storeUser?.council?.name ?? 'Council';
  const councilAcronym = meQuery.data?.council?.acronym ?? storeUser?.council?.acronym ?? 'Council';
  const councilTitles = (storeUser?.council?.allowedTitles ?? []) as string[];
  const titleOptions: TitleOption[] = useMemo(() => {
    const titles = councilTitles.length ? councilTitles : [];
    return [{ value: '', label: 'All titles' }, ...titles.map((t) => ({ value: t, label: t }))];
  }, [councilTitles]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('search');
    if (q && q.trim().length > 0) {
      setSearchInput(q);
      setSearch(q);
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const [councilDraft, setCouncilDraft] = useState<{ requiredPoints: string; renewalMonth: string; renewalDay: string } | null>(null);
  useEffect(() => {
    const c = meQuery.data?.council;
    if (!c) return;
    setCouncilDraft((current) => {
      if (current) return current;
      return { requiredPoints: String(c.requiredPoints), renewalMonth: String(c.renewalMonth), renewalDay: String(c.renewalDay) };
    });
  }, [meQuery.data?.council]);

  const learnersQuery = useQuery<LearnersResponse>({
    queryKey: ['ncz-learners', search, professionalTitle, page],
    queryFn: () =>
      api.get(
        `/api/ncz/learners?search=${encodeURIComponent(search)}&professionalTitle=${encodeURIComponent(professionalTitle)}&page=${page}&limit=25`,
      ),
  });

  const complianceQuery = useQuery<ComplianceData>({
    queryKey: ['ncz-compliance'],
    queryFn: () => api.get('/api/ncz/compliance'),
  });

  const learnerCountLabel = useMemo(() => {
    if (!learnersQuery.data) return 'Search and filter learner records';
    return `${learnersQuery.data.total} learners found`;
  }, [learnersQuery.data]);

  function applySearch() {
    setPage(1);
    setSearch(searchInput.trim());
  }

  function clearFilters() {
    setSearchInput('');
    setSearch('');
    setProfessionalTitle('');
    setPage(1);
  }

  async function handleExportCsv() {
    if (!accessToken) {
      toast.error('You must be signed in to export the compliance report.');
      return;
    }

    try {
      const res = await fetch(buildCsvUrl(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        throw new Error('Could not export the compliance report.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${String(councilAcronym).toLowerCase()}-compliance-${new Date().getFullYear()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Compliance report downloaded.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not export the compliance report.';
      toast.error(message);
    }
  }

  async function saveCouncilSettings() {
    if (!councilDraft) return;
    const requiredPoints = Number(councilDraft.requiredPoints);
    const renewalMonth = Number(councilDraft.renewalMonth);
    const renewalDay = Number(councilDraft.renewalDay);
    if (!Number.isFinite(requiredPoints) || !Number.isFinite(renewalMonth) || !Number.isFinite(renewalDay)) {
      toast.error('Please enter valid numbers for required points and renewal date.');
      return;
    }

    setSavingCouncil(true);
    try {
      await api.patch('/api/ncz/settings', { requiredPoints, renewalMonth, renewalDay });
      toast.success('Council settings updated. Learner targets will reflect this automatically.');
      // Refresh key views that depend on council.requiredPoints / renewal date.
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
      queryClient.invalidateQueries({ queryKey: ['cpd-summary'] });
      queryClient.invalidateQueries({ queryKey: ['ncz-compliance'] });
      queryClient.invalidateQueries({ queryKey: ['ncz-learners'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update council settings.');
    } finally {
      setSavingCouncil(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{councilAcronym} Compliance Portal</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor learner compliance, inspect CPD history, and manage sync activity for {councilName}.
          </p>
        </div>
        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      <div className="sm:hidden">
        <label className="block text-xs font-medium text-slate-600 mb-1.5">Section</label>
        <select
          value={section}
          onChange={(e) => {
            const next = sections.find((item) => item.key === e.target.value)?.path ?? basePath;
            navigate(next);
          }}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          {sections.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden sm:flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {sections.map((item) => (
          <Link
            key={item.key}
            to={item.path}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              section === item.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-700',
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {(section === 'dashboard' || section === 'reports') && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <StatCard
            title="Registered Learners"
            value={complianceQuery.data?.totalLearners ?? '–'}
            subtitle="Active learner accounts"
            icon={<Users size={20} />}
            accent="blue"
          />
          <StatCard
            title="Compliant"
            value={complianceQuery.data?.compliantCount ?? '–'}
            subtitle="Meeting annual CPD target"
            icon={<CheckCircle size={20} />}
            accent="green"
          />
          <StatCard
            title="Non-Compliant"
            value={complianceQuery.data?.nonCompliantCount ?? '–'}
            subtitle="Require follow-up"
            icon={<XCircle size={20} />}
            accent="red"
          />
          <StatCard
            title="Compliance Rate"
            value={complianceQuery.data ? `${complianceQuery.data.complianceRate}%` : '–'}
            subtitle={complianceQuery.data ? `Reporting year ${complianceQuery.data.year}` : 'Current reporting year'}
            icon={<FileCheck2 size={20} />}
            accent="blue"
          />
        </div>
      )}

      {section === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            to={`${basePath}/search`}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <h2 className="text-base font-semibold text-slate-900">Learner Search</h2>
            <p className="mt-1 text-sm text-slate-500">Find learners, inspect history, and resolve NCZ numbers.</p>
          </Link>
          <Link
            to={`${basePath}/reports`}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <h2 className="text-base font-semibold text-slate-900">Reports</h2>
            <p className="mt-1 text-sm text-slate-500">Review compliance metrics and export the current CSV report.</p>
          </Link>
          <Link
            to={`${basePath}/sync`}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <h2 className="text-base font-semibold text-slate-900">Sync Status</h2>
            <p className="mt-1 text-sm text-slate-500">Monitor pending, blocked, failed, and synced NCZ records.</p>
          </Link>
        </div>
      )}

      {section === 'search' && (
        <>
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Learner Registry</h2>
                <p className="text-sm text-slate-500 mt-1">{learnerCountLabel}</p>
              </div>
              <button
                onClick={clearFilters}
                className="text-sm font-medium text-blue-700 hover:text-blue-800 transition-colors"
              >
                Clear filters
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[280px] flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applySearch();
                  }}
                  placeholder="Search by learner name, NCZ number, or email"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <select
                value={professionalTitle}
                onChange={(event) => {
                  setProfessionalTitle(event.target.value);
                  setPage(1);
                }}
                className="min-w-[220px] rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {titleOptions.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <button
                onClick={applySearch}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100"
              >
                <Search size={16} />
                Search
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">Compliance Register</h2>
            </div>

            {learnersQuery.isLoading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-14 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
                ))}
              </div>
            ) : learnersQuery.isError ? (
              <div className="p-5">
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  Could not load learner records right now.
                </div>
              </div>
            ) : !learnersQuery.data?.learners.length ? (
              <div className="p-5">
                <EmptyState
                  icon={<Users size={28} />}
                  title="No learners found"
                  description="Try adjusting your search terms or clearing the current filters."
                />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Learner', 'Registration #', 'Title', 'Institution', 'Province', 'Points', 'Status', ''].map((heading) => (
                          <th
                            key={heading}
                            className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {learnersQuery.data.learners.map((learner) => (
                        <tr key={learner.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-4">
                            <div>
                              <div className="font-semibold text-slate-900">{learner.fullName}</div>
                              <div className="text-xs text-slate-500 mt-1">{learner.email}</div>
                            </div>
                          </td>
                          <td className="px-5 py-4 font-mono text-xs text-slate-500">
                            {learner.registrationNumber ?? learner.nczRegistrationNumber ?? '—'}
                          </td>
                          <td className="px-5 py-4 text-slate-600">{learner.professionalTitle ?? learner.cadre ?? '—'}</td>
                          <td className="px-5 py-4 text-slate-600">{learner.institution ?? '—'}</td>
                          <td className="px-5 py-4 text-slate-600">{learner.province ?? '—'}</td>
                          <td className="px-5 py-4">
                            <span className="font-semibold tabular-nums text-slate-900">{learner.currentYearPoints}</span>
                          </td>
                          <td className="px-5 py-4">
                            <Badge variant={learner.isCompliant ? 'success' : 'error'}>
                              {learner.isCompliant ? 'Compliant' : 'Non-Compliant'}
                            </Badge>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={() => setSelectedLearner(learner)}
                              className="text-sm font-medium text-blue-700 hover:text-blue-800 transition-colors"
                            >
                              View history
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {learnersQuery.data.totalPages > 1 && (
                  <div className="flex items-center justify-between gap-4 border-t border-slate-100 px-5 py-4">
                    <p className="text-sm text-slate-500">
                      Page {learnersQuery.data.page} of {learnersQuery.data.totalPages} · {learnersQuery.data.total} learners
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={page === 1}
                        onClick={() => setPage((current) => Math.max(current - 1, 1))}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ChevronLeft size={14} />
                        Previous
                      </button>
                      <button
                        disabled={page === learnersQuery.data.totalPages}
                        onClick={() => setPage((current) => current + 1)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {section === 'reports' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Compliance Reports</h2>
              <p className="text-sm text-slate-500 mt-1">
                Export the current compliance register and use the summary cards above for reporting.
              </p>
            </div>
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm text-slate-700">
              The CSV export includes learner name, NCZ registration number, cadre, institution, province,
              current CPD points, compliance status, and reporting year.
            </p>
          </div>
        </div>
      )}

      {section === 'courses' && <CouncilCourseReviewsPanel />}

      {section === 'sync' && <SyncStatusPanel basePath={basePath} />}

      {section === 'settings' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 md:p-8 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-900">Council CPD Requirements</h2>
              <p className="text-sm md:text-[15px] text-slate-600 mt-2 max-w-2xl leading-relaxed">
                Set your council’s annual CPD target and renewal deadline. The learner portal and compliance checks update automatically from this configuration.
              </p>
            </div>
            <div className="hidden sm:inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 flex-shrink-0">
              <span className="inline-flex h-2 w-2 rounded-full bg-blue-600" />
              Council settings
            </div>
          </div>

          {!meQuery.data?.council ? (
            <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Your account is not linked to a council yet. Ask an admin to assign your council.
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:p-5">
              <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4 lg:gap-6 items-stretch">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Required points</div>
                  <div className="mt-3 flex items-end gap-3">
                    <input
                      inputMode="numeric"
                      value={councilDraft?.requiredPoints ?? ''}
                      onChange={(e) => setCouncilDraft((d) => (d ? { ...d, requiredPoints: e.target.value } : d))}
                      className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <div className="pb-2 text-sm font-semibold text-slate-500">pts</div>
                  </div>
                  <p className="mt-2 text-[12px] text-slate-500 leading-snug">
                    This is the annual CPD target learners must reach to be compliant.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Renewal deadline</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">
                        Every year on{' '}
                        <span className="text-blue-700">
                          {formatRenewalLabel(
                            Number(councilDraft?.renewalMonth ?? meQuery.data?.council?.renewalMonth ?? 1),
                            Number(councilDraft?.renewalDay ?? meQuery.data?.council?.renewalDay ?? 1),
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="hidden sm:inline-flex items-center gap-2 rounded-full bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">
                      Repeats yearly
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px] gap-3 items-start">
                    <div className="text-[12px] text-slate-500 leading-snug">
                      Pick any valid date—only the month/day is stored, and we’ll use it as the yearly renewal deadline (leap years handled automatically).
                    </div>
                    <input
                      type="date"
                      value={(() => {
                        const year = new Date().getFullYear();
                        const month = Number(councilDraft?.renewalMonth ?? meQuery.data?.council?.renewalMonth ?? 1);
                        const day = Number(councilDraft?.renewalDay ?? meQuery.data?.council?.renewalDay ?? 1);
                        return toDateInputValue(year, month, day);
                      })()}
                      onChange={(e) => {
                        const raw = e.target.value; // YYYY-MM-DD
                        const [y, m, d] = raw.split('-').map((v) => Number(v));
                        if (!y || !m || !d) return;
                        setCouncilDraft((prev) =>
                          prev
                            ? { ...prev, renewalMonth: String(m), renewalDay: String(d) }
                            : {
                                requiredPoints: String(meQuery.data?.council?.requiredPoints ?? 12),
                                renewalMonth: String(m),
                                renewalDay: String(d),
                              },
                        );
                      }}
                      className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => void saveCouncilSettings()}
                      disabled={savingCouncil || !councilDraft}
                      className="sm:w-auto w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm shadow-blue-900/10"
                    >
                      {savingCouncil ? 'Saving…' : 'Save settings'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedLearner ? (
        <LearnerHistoryPanel learner={selectedLearner} onClose={() => setSelectedLearner(null)} />
      ) : null}
    </div>
  );
}

function LearnerHistoryPanel({
  learner,
  onClose,
}: {
  learner: Learner;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [editingNcz, setEditingNcz] = useState(false);
  const [nczValue, setNczValue] = useState(learner.nczRegistrationNumber ?? '');

  const historyQuery = useQuery<LearnerHistoryResponse>({
    queryKey: ['ncz-learner-history', learner.id],
    queryFn: () => api.get(`/api/ncz/learners/${learner.id}/history`),
  });

  async function saveNczNumber() {
    setEditingNcz(true);
    try {
      const payload = { nczRegistrationNumber: nczValue.trim() ? nczValue.trim() : null };
      const updated = await api.patch<Learner>(`/api/ncz/learners/${learner.id}`, payload);
      toast.success('NCZ registration number updated.');
      // Keep the panel header in sync and refresh queues/search lists.
      learner.nczRegistrationNumber = updated.nczRegistrationNumber;
      queryClient.invalidateQueries({ queryKey: ['ncz-learners'] });
      queryClient.invalidateQueries({ queryKey: ['ncz-sync-blocked'] });
      queryClient.invalidateQueries({ queryKey: ['ncz-learner-history', learner.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update NCZ number.');
    } finally {
      setEditingNcz(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex justify-end" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{learner.fullName}</h2>
              <p className="text-sm text-slate-500 mt-1">
                {(learner.registrationNumber ?? learner.nczRegistrationNumber ?? 'No registration number')} · {(learner.professionalTitle ?? learner.cadre ?? 'Title not set')}
              </p>
              <div className="mt-4 flex flex-col sm:flex-row sm:items-end gap-2">
                <div className="w-full sm:w-80">
                  <label htmlFor="ncz-number" className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    NCZ registration number
                  </label>
                  <input
                    id="ncz-number"
                    value={nczValue}
                    onChange={(e) => setNczValue(e.target.value)}
                    placeholder="e.g. NCZ-12345"
                    className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void saveNczNumber()}
                  disabled={editingNcz}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <CheckCircle size={16} />
                  {editingNcz ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close learner history"
              className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Institution</p>
              <p className="mt-2 text-sm text-slate-900">{learner.institution ?? '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Province</p>
              <p className="mt-2 text-sm text-slate-900">{learner.province ?? '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current points</p>
              <p className="mt-2 text-sm font-semibold tabular-nums text-slate-900">{learner.currentYearPoints}</p>
            </div>
          </div>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-blue-600" />
              <h3 className="text-base font-semibold text-slate-900">CPD History</h3>
            </div>

            {historyQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-20 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
                ))}
              </div>
            ) : historyQuery.isError ? (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Could not load CPD history for this learner.
              </div>
            ) : historyQuery.data?.records.length ? (
              <div className="space-y-3">
                {historyQuery.data.records.map((record) => (
                  <div key={record.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {record.course?.title ?? record.activityType.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {formatDate(record.completedAt)} · Cycle {record.cycleYear}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums text-blue-700">+{record.pointsEarned} pts</p>
                        <p className="text-xs text-slate-400 mt-1">{record.activityType.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<FileText size={28} />}
                title="No CPD records yet"
                description="This learner has not recorded any CPD activity in the system."
              />
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <FileCheck2 size={16} className="text-blue-600" />
              <h3 className="text-base font-semibold text-slate-900">Certificates</h3>
            </div>

            {historyQuery.data?.certificates.length ? (
              <div className="space-y-3">
                {historyQuery.data.certificates.map((certificate) => (
                  <div key={certificate.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Cycle {certificate.cycleYear} certificate</p>
                        <p className="mt-1 font-mono text-xs text-slate-400 break-all">
                          {certificate.certificateUuid}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums text-slate-900">{certificate.totalPoints} pts</p>
                        <p className="text-xs text-slate-500 mt-1">{formatDate(certificate.issuedAt)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<FileCheck2 size={28} />}
                title="No certificates issued"
                description="Certificate history will appear here once certificates have been generated."
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function SyncStatusPanel({ basePath }: { basePath: '/ncz' | '/council' }) {
  const [triggering, setTriggering] = useState(false);
  const [tab, setTab] = useState<'LOGS' | 'BLOCKED' | 'FAILED'>('LOGS');
  const [retryingRecordId, setRetryingRecordId] = useState<string | null>(null);
  const [retryingAllFailed, setRetryingAllFailed] = useState(false);
  const logsQuery = useQuery<SyncLog[]>({
    queryKey: ['ncz-sync-logs'],
    queryFn: () => api.get('/api/ncz/sync/logs'),
    refetchInterval: 30000,
  });

  const getLogMetaCounts = (meta: unknown): { sent: number; blocked: number } | null => {
    if (!meta || typeof meta !== 'object') return null;
    const m = meta as { sentIds?: unknown; blockedIds?: unknown };
    const sent = Array.isArray(m.sentIds) ? m.sentIds.length : null;
    const blocked = Array.isArray(m.blockedIds) ? m.blockedIds.length : null;
    if (sent == null && blocked == null) return null;
    return { sent: sent ?? 0, blocked: blocked ?? 0 };
  };
  const summaryQuery = useQuery<SyncSummary>({
    queryKey: ['ncz-sync-summary'],
    queryFn: () => api.get('/api/ncz/sync/summary'),
    refetchInterval: 30000,
  });
  const blockedQuery = useQuery<{ records: SyncRecordRow[] }>({
    queryKey: ['ncz-sync-blocked'],
    queryFn: () => api.get('/api/ncz/sync/blocked?limit=50'),
    enabled: tab === 'BLOCKED',
  });
  const failedQuery = useQuery<{ records: SyncRecordRow[] }>({
    queryKey: ['ncz-sync-failed'],
    queryFn: () => api.get('/api/ncz/sync/failed?limit=50'),
    enabled: tab === 'FAILED',
  });

  async function triggerSync() {
    setTriggering(true);
    try {
      const result = await api.post<{ success: boolean; recordCount: number; errorMessage?: string }>(
        '/api/ncz/sync/trigger',
      );

      if (result.success) {
        toast.success(
          result.recordCount > 0
            ? `NCZ sync completed for ${result.recordCount} records.`
            : 'NCZ sync completed. No pending records were found.',
        );
        await logsQuery.refetch();
        await summaryQuery.refetch();
        if (tab === 'BLOCKED') await blockedQuery.refetch();
        if (tab === 'FAILED') await failedQuery.refetch();
      } else {
        toast.error(result.errorMessage ?? 'NCZ sync failed.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'NCZ sync failed.';
      toast.error(message);
    } finally {
      setTriggering(false);
    }
  }

  async function retryAllFailed() {
    setRetryingAllFailed(true);
    try {
      const result = await api.post<{ success: boolean; recordCount: number; errorMessage?: string }>(
        '/api/ncz/sync/trigger?onlyFailed=true',
      );
      if (result.success) {
        toast.success(
          result.recordCount > 0 ? `Retried ${result.recordCount} failed record(s).` : 'No failed records to retry.',
        );
        await logsQuery.refetch();
        await summaryQuery.refetch();
        await failedQuery.refetch();
      } else {
        toast.error(result.errorMessage ?? 'Retry failed.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Retry failed.');
    } finally {
      setRetryingAllFailed(false);
    }
  }

  async function retryRecord(id: string) {
    setRetryingRecordId(id);
    try {
      const result = await api.post<{ success: boolean; recordCount: number; errorMessage?: string }>(`/api/ncz/sync/retry/${id}`);
      if (result.success) {
        toast.success('Record retried successfully.');
        await logsQuery.refetch();
        await summaryQuery.refetch();
        await failedQuery.refetch();
      } else {
        toast.error(result.errorMessage ?? 'Retry failed.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Retry failed.');
    } finally {
      setRetryingRecordId(null);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">NCZ Sync Status</h2>
          <p className="text-sm text-slate-500 mt-1">Daily sync logs and manual resubmission control.</p>
        </div>
        <button
          onClick={triggerSync}
          disabled={triggering}
          className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={15} className={triggering ? 'animate-spin' : ''} />
          {triggering ? 'Syncing…' : 'Sync Now'}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pending</div>
          <div className="mt-1 text-xl font-bold text-slate-900 tabular-nums">{summaryQuery.data?.pending ?? '—'}</div>
        </div>
        <button
          type="button"
          onClick={() => setTab('BLOCKED')}
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left hover:bg-amber-100 transition-colors"
        >
          <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Blocked</div>
          <div className="mt-1 text-xl font-bold text-amber-900 tabular-nums">{summaryQuery.data?.blocked ?? '—'}</div>
          <div className="text-[11px] text-amber-800 mt-1">Missing NCZ number</div>
        </button>
        <button
          type="button"
          onClick={() => setTab('FAILED')}
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left hover:bg-red-100 transition-colors"
        >
          <div className="text-xs font-semibold text-red-700 uppercase tracking-wide">Failed</div>
          <div className="mt-1 text-xl font-bold text-red-900 tabular-nums">{summaryQuery.data?.failed ?? '—'}</div>
          <div className="text-[11px] text-red-800 mt-1">Retry needed</div>
        </button>
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <div className="text-xs font-semibold text-green-700 uppercase tracking-wide">Synced</div>
          <div className="mt-1 text-xl font-bold text-green-900 tabular-nums">{summaryQuery.data?.synced ?? '—'}</div>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { key: 'LOGS' as const, label: 'Logs' },
          { key: 'BLOCKED' as const, label: 'Blocked' },
          { key: 'FAILED' as const, label: 'Failed' },
        ].map((t) => (
          <button
            type="button"
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-700 hover:text-slate-900 hover:bg-white/60',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'BLOCKED' ? (
        blockedQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-14 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
            ))}
          </div>
        ) : blockedQuery.isError ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load blocked records right now.
          </div>
        ) : blockedQuery.data?.records?.length ? (
          <div className="space-y-2">
            {blockedQuery.data.records.slice(0, 10).map((r) => (
              <div key={r.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{r.learner.fullName}</p>
                    <p className="text-xs text-slate-700 mt-1">
                      Missing NCZ registration number · {r.course?.title ?? 'No course'}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">{r.learner.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const q = r.learner.email ? r.learner.email : r.learner.fullName;
                      const params = new URLSearchParams({ search: q });
                      window.location.href = `${basePath}/search?${params.toString()}`;
                    }}
                    className="text-xs font-semibold text-amber-900 hover:underline flex-shrink-0"
                  >
                    Resolve →
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<RefreshCw size={28} />}
            title="No blocked records"
            description="Blocked records appear when a learner is missing an NCZ registration number."
          />
        )
      ) : null}

      {tab === 'FAILED' ? (
        failedQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-14 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
            ))}
          </div>
        ) : failedQuery.isError ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load failed records right now.
          </div>
        ) : failedQuery.data?.records?.length ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-600">
                {failedQuery.data.records.length} failed record{failedQuery.data.records.length !== 1 ? 's' : ''} (showing first 10)
              </p>
              <button
                type="button"
                onClick={() => void retryAllFailed()}
                disabled={retryingAllFailed}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                <RefreshCw size={14} className={retryingAllFailed ? 'animate-spin' : ''} />
                {retryingAllFailed ? 'Retrying…' : 'Retry all failed'}
              </button>
            </div>
            {failedQuery.data.records.slice(0, 10).map((r) => (
              <div key={r.id} className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{r.learner.fullName}</p>
                    <p className="text-xs text-slate-700 mt-1">{r.course?.title ?? 'No course'}</p>
                    {r.nczLastError ? <p className="text-xs text-red-700 mt-2">{r.nczLastError}</p> : null}
                    <button
                      type="button"
                      onClick={() => void retryRecord(r.id)}
                      disabled={retryingRecordId === r.id}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      <RefreshCw size={14} className={retryingRecordId === r.id ? 'animate-spin' : ''} />
                      {retryingRecordId === r.id ? 'Retrying…' : 'Retry record'}
                    </button>
                  </div>
                  <span className="text-xs text-slate-600 flex-shrink-0">
                    {r.nczLastAttemptAt ? formatDateTime(r.nczLastAttemptAt) : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<RefreshCw size={28} />}
            title="No failed records"
            description="Failed records appear when NCZ rejects a payload or the endpoint is unavailable."
          />
        )
      ) : null}

      {tab === 'LOGS'
        ? logsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-14 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
              ))}
            </div>
          ) : logsQuery.isError ? (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Could not load NCZ sync logs right now.
            </div>
          ) : logsQuery.data?.length ? (
            <div className="space-y-2">
              {logsQuery.data.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex h-2.5 w-2.5 rounded-full ${log.success ? 'bg-green-500' : 'bg-red-500'}`} />
                      <p className="text-sm font-medium text-slate-900">{formatDateTime(log.syncedAt)}</p>
                      {log.dryRun ? (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          Dry run
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-600 mt-1">
                      {log.recordCount} records processed{log.success ? '' : ' before failure'}.
                    </p>
                    {(() => {
                      const counts = getLogMetaCounts(log.meta);
                      if (!counts) return null;
                      return (
                        <p className="text-xs text-slate-500 mt-1">
                          Sent: <span className="font-semibold tabular-nums text-slate-700">{counts.sent}</span> · Blocked:{' '}
                          <span className="font-semibold tabular-nums text-slate-700">{counts.blocked}</span>
                        </p>
                      );
                    })()}
                    {log.errorMessage ? (
                      <p className="text-xs text-red-600 mt-2">{log.errorMessage}</p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <Badge variant={log.success ? 'success' : 'error'}>{log.success ? 'Success' : 'Failed'}</Badge>
                    <p className="text-xs text-slate-500 mt-2">{log.triggeredBy ?? 'system'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<RefreshCw size={28} />}
              title="No sync history yet"
              description="Sync logs will appear here after the first scheduled or manual NCZ sync run."
            />
          )
        : null}
    </div>
  );
}

function CouncilCourseReviewsPanel() {
  const [tab, setTab] = useState<CouncilCourseReviewStatus>('PENDING_REVIEW');
  const [actionCourse, setActionCourse] = useState<CouncilCourseReviewRow | null>(null);
  const [points, setPoints] = useState('3');
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const listQuery = useQuery<{ reviews: CouncilCourseReviewRow[] }>({
    queryKey: ['council-course-reviews', tab],
    queryFn: () => api.get(`/api/ncz/courses/reviews?status=${encodeURIComponent(tab)}&limit=100`),
    refetchInterval: tab === 'PENDING_REVIEW' ? 20000 : false,
  });

  useEffect(() => {
    if (!actionCourse) return;
    setPoints(String(actionCourse.points ?? 3));
    setRejectReason(actionCourse.rejectionReason ?? '');
  }, [actionCourse]);

  async function approve(courseId: string) {
    const value = Number(points);
    if (!Number.isFinite(value) || value < 0) {
      toast.error('Please enter a valid points value (0 or above).');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/api/ncz/courses/${courseId}/reviews/approve`, { points: value });
      toast.success('Course approved and points assigned.');
      setActionCourse(null);
      await listQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not approve course.');
    } finally {
      setSubmitting(false);
    }
  }

  async function reject(courseId: string) {
    const reason = rejectReason.trim();
    if (reason.length < 3) {
      toast.error('Please enter a short rejection reason.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/api/ncz/courses/${courseId}/reviews/reject`, { reason });
      toast.success('Course rejected.');
      setActionCourse(null);
      await listQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not reject course.');
    } finally {
      setSubmitting(false);
    }
  }

  async function updatePoints(courseId: string) {
    const value = Number(points);
    if (!Number.isFinite(value) || value < 0) {
      toast.error('Please enter a valid points value (0 or above).');
      return;
    }
    setSubmitting(true);
    try {
      await api.patch(`/api/ncz/courses/${courseId}/reviews/points`, { points: value });
      toast.success('Points updated.');
      setActionCourse(null);
      await listQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update points.');
    } finally {
      setSubmitting(false);
    }
  }

  const items = listQuery.data?.reviews ?? [];

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Course Reviews</h2>
          <p className="text-sm text-slate-500 mt-1">
            Approve courses for your council and assign CPD points. Learners will only see courses after approval + points (Sprint 5 will enforce this).
          </p>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {([
            { key: 'PENDING_REVIEW' as const, label: 'Waiting for points' },
            { key: 'APPROVED' as const, label: 'Approved' },
            { key: 'REJECTED' as const, label: 'Rejected' },
          ] satisfies Array<{ key: CouncilCourseReviewStatus; label: string }>).map((t) => (
            <button
              type="button"
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-700 hover:text-slate-900 hover:bg-white/60',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {listQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-20 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
          ))}
        </div>
      ) : listQuery.isError ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load course reviews right now.
        </div>
      ) : !items.length ? (
        <EmptyState
          icon={<FileCheck2 size={28} />}
          title="No courses in this queue"
          description={tab === 'PENDING_REVIEW' ? 'When creators submit a course to your council, it will appear here.' : 'Nothing to show for this filter yet.'}
        />
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-900 truncate">{r.course.title}</p>
                    <Badge
                      variant={
                        r.status === 'APPROVED' ? 'success' : r.status === 'REJECTED' ? 'error' : 'info'
                      }
                    >
                      {r.status === 'PENDING_REVIEW' ? 'Pending' : r.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                    </Badge>
                    <span className="text-xs text-slate-500">· Course: {r.course.status}</span>
                  </div>
                  {r.course.subtitle ? <p className="text-xs text-slate-500 mt-1">{r.course.subtitle}</p> : null}
                  <p className="text-xs text-slate-500 mt-2">
                    Creator: <span className="font-medium text-slate-700">{r.course.creator.fullName}</span> · {r.course.estimatedMinutes} min
                  </p>
                  {r.status === 'REJECTED' && r.rejectionReason ? (
                    <p className="mt-2 text-xs text-red-700">Reason: {r.rejectionReason}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setActionCourse(r)}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {r.status === 'PENDING_REVIEW' ? 'Review' : 'Edit'}
                  </button>
                </div>
              </div>
              {r.status === 'APPROVED' ? (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-green-50 border border-green-100 px-3 py-2">
                  <span className="text-xs text-green-800 font-semibold">Points: {r.points ?? 0}</span>
                  <span className="text-[11px] text-green-700">
                    {r.reviewedAt ? `Reviewed ${formatDateTime(r.reviewedAt)}` : 'Reviewed'}
                  </span>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {actionCourse ? (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={() => !submitting && setActionCourse(null)}>
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900 truncate">{actionCourse.course.title}</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {actionCourse.status === 'PENDING_REVIEW' ? 'Assign points and approve, or reject with a reason.' : 'Update points or rejection reason.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActionCourse(null)}
                disabled={submitting}
                className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">CPD points</label>
                  <input
                    value={points}
                    onChange={(e) => setPoints(e.target.value)}
                    inputMode="numeric"
                    className="mt-2 w-full h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <p className="mt-2 text-xs text-slate-500">Set to 0 if this course should not earn points.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">Rejection reason</label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="Only required if rejecting"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
              <button
                type="button"
                onClick={() => actionCourse && reject(actionCourse.courseId)}
                disabled={submitting}
                className="h-11 inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                Reject
              </button>
              {actionCourse.status === 'APPROVED' ? (
                <button
                  type="button"
                  onClick={() => actionCourse && updatePoints(actionCourse.courseId)}
                  disabled={submitting}
                  className="h-11 inline-flex items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-5 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                >
                  Update points
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => actionCourse && approve(actionCourse.courseId)}
                  disabled={submitting}
                  className="h-11 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Approve + assign points
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
