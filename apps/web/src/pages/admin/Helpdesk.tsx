import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, MessageSquareWarning } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from '../../components/ui/Toast';
import clsx from 'clsx';

type Issue = {
  id: string;
  title: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'WONT_FIX';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  source: 'WEB' | 'MOBILE' | 'WHATSAPP';
  reporterContact: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  reporter: { id: string; fullName: string; email: string; phone: string | null; role: string } | null;
  assignedTo: { id: string; fullName: string } | null;
};

const PRIORITY_STYLES: Record<Issue['priority'], string> = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  MEDIUM: 'bg-amber-100 text-amber-800 border-amber-200',
  LOW: 'bg-slate-100 text-slate-600 border-slate-200',
};

const STATUS_STYLES: Record<Issue['status'], string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
  RESOLVED: 'bg-emerald-100 text-emerald-800',
  WONT_FIX: 'bg-slate-100 text-slate-500',
};

export default function Helpdesk() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  const params = new URLSearchParams();
  if (statusFilter) params.set('status', statusFilter);
  if (sourceFilter) params.set('source', sourceFilter);

  const { data, isLoading } = useQuery<{ issues: Issue[] }>({
    queryKey: ['issues', statusFilter, sourceFilter],
    queryFn: () => api.get(`/api/issues?${params.toString()}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; status?: string; priority?: string; resolutionNotes?: string }) =>
      api.patch(`/api/issues/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      toast.success('Issue updated');
    },
    onError: () => toast.error('Could not update issue'),
  });

  const issues = data?.issues ?? [];
  const openCount = issues.filter((i) => i.status === 'OPEN').length;
  const criticalCount = issues.filter((i) => i.priority === 'CRITICAL' && i.status !== 'RESOLVED').length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <MessageSquareWarning size={22} className="text-slate-900" />
        <h1 className="text-xl font-bold text-slate-900">Helpdesk — Issue Reports</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Ranked by priority. {openCount} open, {criticalCount} critical unresolved.
      </p>

      <div className="flex items-center gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
        >
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="WONT_FIX">Won't fix</option>
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
        >
          <option value="">All sources</option>
          <option value="WEB">Web</option>
          <option value="MOBILE">Mobile</option>
          <option value="WHATSAPP">WhatsApp</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : issues.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No issue reports match these filters.
        </div>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => (
            <div key={issue.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full border', PRIORITY_STYLES[issue.priority])}>
                      {issue.priority}
                    </span>
                    <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', STATUS_STYLES[issue.status])}>
                      {issue.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs font-medium text-slate-400">{issue.source}</span>
                  </div>
                  <p className="font-semibold text-slate-900 mt-1.5">{issue.title}</p>
                  <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{issue.description}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    {issue.reporter
                      ? `${issue.reporter.fullName} (${issue.reporter.email})`
                      : issue.reporterContact
                        ? `Unregistered — ${issue.reporterContact}`
                        : 'Anonymous'}
                    {' · '}
                    {new Date(issue.createdAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0 w-40">
                  <select
                    value={issue.priority}
                    onChange={(e) => updateMutation.mutate({ id: issue.id, priority: e.target.value })}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-white"
                  >
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                  <select
                    value={issue.status}
                    onChange={(e) => updateMutation.mutate({ id: issue.id, status: e.target.value })}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-white"
                  >
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="WONT_FIX">Won't fix</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {issues.some((i) => i.priority === 'CRITICAL' && i.status === 'OPEN') && (
        <div className="mt-6 flex items-center gap-2 text-sm text-red-600">
          <AlertOctagon size={16} />
          Critical open issues need attention above.
        </div>
      )}
    </div>
  );
}
