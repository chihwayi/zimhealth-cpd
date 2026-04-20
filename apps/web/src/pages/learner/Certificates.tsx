import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';

type Certificate = {
  id: string;
  certificateUuid: string;
  cycleYear: number;
  totalPoints: number;
  coursesCompleted: string[];
  issuedAt: string;
  pdfUrl?: string | null;
};

export default function CertificatesPage() {
  const user = useAuthStore((s) => s.user);

  const { data: certs, isLoading, refetch } = useQuery<Certificate[]>({
    queryKey: ['certificates'],
    queryFn: () => api.get('/api/certificates'),
  });

  const generateMutation = useMutation({
    mutationFn: async () => api.post<Certificate>('/api/certificates/generate', { cycleYear: new Date().getFullYear() }),
    onSuccess: () => refetch(),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Certificates</h1>
          <p className="text-sm text-slate-600 mt-1">Generate and verify your annual CPD certificate.</p>
        </div>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="bg-primary-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary-600 disabled:opacity-40"
        >
          {generateMutation.isPending ? 'Generating…' : 'Generate Certificate'}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="text-sm text-slate-700">
          Learner: <span className="font-medium">{user?.fullName ?? '—'}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
      ) : (
        <div className="space-y-4">
          {(certs ?? []).length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-600">
              No certificates yet. When you reach your required CPD points for a cycle, generate one here.
            </div>
          ) : (
            (certs ?? []).map((c) => (
              <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-slate-500">Cycle {c.cycleYear}</div>
                    <div className="text-lg font-semibold text-slate-900 mt-0.5">
                      {c.totalPoints} points earned
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Issued {new Date(c.issuedAt).toLocaleDateString('en-ZW')}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">UUID: {c.certificateUuid}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {c.pdfUrl ? (
                      <a
                        href={c.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-primary-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary-600"
                      >
                        Download PDF
                      </a>
                    ) : (
                      <span className="text-xs text-slate-500">PDF pending</span>
                    )}
                    <a
                      className="text-sm text-primary-700 hover:underline"
                      href={`/verify/${c.certificateUuid}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Verify →
                    </a>
                  </div>
                </div>

                {c.coursesCompleted?.length ? (
                  <div className="mt-4">
                    <div className="text-sm font-medium text-slate-900">Courses completed</div>
                    <ul className="mt-2 text-sm text-slate-600 space-y-1">
                      {c.coursesCompleted.slice(0, 6).map((t) => (
                        <li key={t}>- {t}</li>
                      ))}
                      {c.coursesCompleted.length > 6 ? (
                        <li className="text-slate-400">- …and {c.coursesCompleted.length - 6} more</li>
                      ) : null}
                    </ul>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

