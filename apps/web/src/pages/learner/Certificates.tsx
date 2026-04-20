import { useMutation, useQuery } from '@tanstack/react-query';
import { Award, Download, ExternalLink, ShieldCheck, FileText } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { toast } from '../../components/ui/Toast';
import { EmptyState } from '../../components/ui/EmptyState';

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
    mutationFn: async () =>
      api.post<Certificate>('/api/certificates/generate', { cycleYear: new Date().getFullYear() }),
    onSuccess: () => {
      toast.success('Certificate generated successfully!');
      refetch();
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Could not generate certificate');
    },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CPD Certificates</h1>
          <p className="text-sm text-slate-500 mt-1">
            Generate and download your annual CPD completion certificate.
          </p>
        </div>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="flex items-center gap-2 bg-primary-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-primary-600 disabled:opacity-40 transition-colors shadow-sm"
        >
          <FileText size={15} />
          {generateMutation.isPending ? 'Generating…' : 'Generate Certificate'}
        </button>
      </div>

      {/* Learner identity card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4 shadow-sm">
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
          <Award size={18} className="text-primary-700" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{user?.fullName ?? '—'}</p>
          {user?.nczRegistrationNumber && (
            <p className="text-xs text-slate-500 mt-0.5">NCZ Reg: {user.nczRegistrationNumber}</p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full">
          <ShieldCheck size={12} />
          Verified Learner
        </div>
      </div>

      {/* Certificate list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-40 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : !certs?.length ? (
        <div className="bg-white border border-slate-200 rounded-2xl">
          <EmptyState
            icon={<Award size={28} />}
            title="No certificates yet"
            description="Complete your required CPD points for the year, then generate your certificate here."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {certs.map((c) => (
            <CertificateCard key={c.id} cert={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function CertificateCard({ cert }: { cert: Certificate }) {
  const year = cert.cycleYear;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Top accent bar */}
      <div className="h-1.5 bg-gradient-to-r from-primary-400 via-primary-500 to-teal-400" />

      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          {/* Left — credential info */}
          <div className="flex items-start gap-4">
            {/* Seal icon */}
            <div className="w-14 h-14 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={26} className="text-primary-600" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  CPD Certificate — {year}
                </h3>
                <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  <ShieldCheck size={10} />
                  Verified
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-0.5">
                <span className="font-semibold text-primary-700">{cert.totalPoints} CPD points</span> earned
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Issued {new Date(cert.issuedAt).toLocaleDateString('en-ZW', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              {/* UUID */}
              <p className="mt-2 font-mono text-xs text-slate-400 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md inline-block">
                {cert.certificateUuid}
              </p>
            </div>
          </div>

          {/* Right — actions */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {cert.pdfUrl ? (
              <a
                href={cert.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 bg-primary-500 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors shadow-sm"
              >
                <Download size={14} />
                Download PDF
              </a>
            ) : (
              <span className="text-xs text-slate-400 italic">PDF generating…</span>
            )}
            <a
              href={`/verify/${cert.certificateUuid}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-primary-600 hover:underline"
            >
              <ExternalLink size={11} />
              View verification page
            </a>
          </div>
        </div>

        {/* Courses completed */}
        {cert.coursesCompleted?.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
              Courses completed
            </p>
            <div className="flex flex-wrap gap-2">
              {cert.coursesCompleted.slice(0, 8).map((title) => (
                <span
                  key={title}
                  className="text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full"
                >
                  {title}
                </span>
              ))}
              {cert.coursesCompleted.length > 8 && (
                <span className="text-xs text-slate-400 px-2 py-1">
                  +{cert.coursesCompleted.length - 8} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
