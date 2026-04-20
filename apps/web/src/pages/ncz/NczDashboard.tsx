import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  cadre?: string | null;
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
  syncedAt: string;
}

const CADRE_OPTIONS = [
  { value: '', label: 'All cadres' },
  { value: 'NURSE', label: 'Nurse' },
  { value: 'MIDWIFE', label: 'Midwife' },
  { value: 'PHARMACIST', label: 'Pharmacist' },
  { value: 'CLINICAL_OFFICER', label: 'Clinical Officer' },
  { value: 'LAB_TECH', label: 'Lab Tech' },
];

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
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [cadre, setCadre] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLearner, setSelectedLearner] = useState<Learner | null>(null);

  const learnersQuery = useQuery<LearnersResponse>({
    queryKey: ['ncz-learners', search, cadre, page],
    queryFn: () =>
      api.get(
        `/api/ncz/learners?search=${encodeURIComponent(search)}&cadre=${encodeURIComponent(cadre)}&page=${page}&limit=25`,
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
    setCadre('');
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
      link.download = `ncz-compliance-${new Date().getFullYear()}.csv`;
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

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">NCZ Compliance Portal</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor learner compliance, inspect CPD history, and manage NCZ sync activity.
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
            value={cadre}
            onChange={(event) => {
              setCadre(event.target.value);
              setPage(1);
            }}
            className="min-w-[180px] rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            {CADRE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
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
                    {['Learner', 'NCZ Reg', 'Cadre', 'Institution', 'Province', 'Points', 'Status', ''].map((heading) => (
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
                        {learner.nczRegistrationNumber ?? '—'}
                      </td>
                      <td className="px-5 py-4 text-slate-600">{learner.cadre ?? '—'}</td>
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

      <SyncStatusPanel />

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
  const historyQuery = useQuery<LearnerHistoryResponse>({
    queryKey: ['ncz-learner-history', learner.id],
    queryFn: () => api.get(`/api/ncz/learners/${learner.id}/history`),
  });

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
                {learner.nczRegistrationNumber ?? 'No NCZ registration number'} · {learner.cadre ?? 'Cadre not set'}
              </p>
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

function SyncStatusPanel() {
  const [triggering, setTriggering] = useState(false);
  const logsQuery = useQuery<SyncLog[]>({
    queryKey: ['ncz-sync-logs'],
    queryFn: () => api.get('/api/ncz/sync/logs'),
    refetchInterval: 30000,
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

      {logsQuery.isLoading ? (
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
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  {log.recordCount} records processed{log.success ? '' : ' before failure'}.
                </p>
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
      )}
    </div>
  );
}
