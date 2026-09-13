import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Mail, Phone, UserPlus } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from '../../components/ui/Toast';
import clsx from 'clsx';

type Batch = {
  id: string;
  name: string;
  sponsorName: string;
  tier: string;
  totalCount: number;
  createdAt: string;
  _count: { vouchers: number };
};

type RosterEntry = {
  voucherId: string;
  code: string;
  invitedEmail: string | null;
  invitedPhone: string | null;
  status: 'REDEEMED' | 'INVITED' | 'UNASSIGNED';
  learner: { id: string; fullName: string; email: string; cadre: string | null } | null;
  compliance: { totalPoints: number; requiredPoints: number; percentComplete: number } | null;
};

const STATUS_STYLES: Record<RosterEntry['status'], string> = {
  REDEEMED: 'bg-emerald-100 text-emerald-800',
  INVITED: 'bg-amber-100 text-amber-800',
  UNASSIGNED: 'bg-slate-100 text-slate-500',
};

export default function InstitutionDashboard() {
  const queryClient = useQueryClient();
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [inviteText, setInviteText] = useState('');

  const batchesQuery = useQuery<{ batches: Batch[] }>({
    queryKey: ['institution-batches'],
    queryFn: () => api.get('/api/institutions/my-batches'),
  });

  const batches = batchesQuery.data?.batches ?? [];
  const activeBatchId = selectedBatchId ?? batches[0]?.id ?? null;

  const rosterQuery = useQuery<{ batch: Batch; roster: RosterEntry[] }>({
    queryKey: ['institution-roster', activeBatchId],
    queryFn: () => api.get(`/api/institutions/${activeBatchId}/roster`),
    enabled: !!activeBatchId,
  });

  const inviteMutation = useMutation({
    mutationFn: (invitees: Array<{ email?: string; phone?: string }>) =>
      api.post<{ invited: number }>(`/api/institutions/${activeBatchId}/invite`, { invitees }),
    onSuccess: (data: { invited: number }) => {
      toast.success(`Invited ${data.invited} staff member${data.invited === 1 ? '' : 's'}`);
      setInviteText('');
      queryClient.invalidateQueries({ queryKey: ['institution-roster', activeBatchId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const roster = rosterQuery.data?.roster ?? [];
  const summary = useMemo(() => {
    const redeemed = roster.filter((r) => r.status === 'REDEEMED').length;
    const invited = roster.filter((r) => r.status === 'INVITED').length;
    const compliant = roster.filter((r) => r.compliance && r.compliance.percentComplete >= 100).length;
    return { redeemed, invited, compliant, total: roster.length };
  }, [roster]);

  function handleInvite() {
    const invitees = inviteText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => (line.includes('@') ? { email: line } : { phone: line }));

    if (invitees.length === 0) {
      toast.error('Add at least one email or phone number, one per line.');
      return;
    }
    inviteMutation.mutate(invitees);
  }

  if (batchesQuery.isLoading) {
    return <div className="p-6 text-sm text-slate-500">Loading...</div>;
  }

  if (batches.length === 0) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <Building2 className="mx-auto text-slate-300" size={40} />
        <h1 className="text-lg font-bold text-slate-900 mt-3">No institution batches yet</h1>
        <p className="text-sm text-slate-500 mt-1">
          Ask your ZimHealth CPD administrator to set up a sponsored batch for your organization and assign you as the
          institution contact.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
          <Building2 size={18} />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Institution Dashboard</h1>
      </div>

      {batches.length > 1 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {batches.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBatchId(b.id)}
              className={clsx(
                'text-sm px-3 py-1.5 rounded-full border',
                activeBatchId === b.id ? 'bg-slate-950 text-white border-slate-950' : 'bg-white border-slate-300 text-slate-600',
              )}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Total seats</p>
          <p className="text-2xl font-bold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Invited</p>
          <p className="text-2xl font-bold text-amber-600">{summary.invited}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Redeemed</p>
          <p className="text-2xl font-bold text-emerald-600">{summary.redeemed}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">CPD compliant</p>
          <p className="text-2xl font-bold text-slate-900">{summary.compliant}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <UserPlus size={16} className="text-slate-700" />
          <h2 className="text-sm font-semibold text-slate-900">Invite staff</h2>
        </div>
        <p className="text-xs text-slate-500 mb-3">One email or phone number per line. Each will get a voucher code.</p>
        <textarea
          value={inviteText}
          onChange={(e) => setInviteText(e.target.value)}
          rows={4}
          placeholder={'nurse1@hospital.org\n+263771234567'}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
        <button
          onClick={handleInvite}
          disabled={inviteMutation.isPending}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-950 text-white text-sm font-semibold px-4 py-2.5 hover:bg-slate-800 disabled:opacity-60"
        >
          {inviteMutation.isPending ? 'Sending...' : 'Send invites'}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Invitee / Learner</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">CPD Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {roster.map((entry) => (
              <tr key={entry.voucherId}>
                <td className="px-4 py-3">
                  <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', STATUS_STYLES[entry.status])}>
                    {entry.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {entry.learner ? (
                    <div>
                      <p className="font-medium text-slate-900">{entry.learner.fullName}</p>
                      <p className="text-xs text-slate-500">{entry.learner.email}</p>
                    </div>
                  ) : entry.invitedEmail || entry.invitedPhone ? (
                    <div className="flex items-center gap-1.5 text-slate-600">
                      {entry.invitedEmail ? <Mail size={13} /> : <Phone size={13} />}
                      {entry.invitedEmail ?? entry.invitedPhone}
                    </div>
                  ) : (
                    <span className="text-slate-400">Not yet assigned</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{entry.code}</td>
                <td className="px-4 py-3">
                  {entry.compliance ? (
                    <span className="text-slate-700">
                      {entry.compliance.totalPoints} / {entry.compliance.requiredPoints} pts
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
