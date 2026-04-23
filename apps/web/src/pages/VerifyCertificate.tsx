import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { ShieldCheck, Award, BookOpen, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';

type VerifyResponse = {
  certificateUuid: string;
  cycleYear: number;
  totalPoints: number;
  coursesCompleted: string[];
  issuedAt: string;
  learner: { fullName: string; nczRegistrationNumber?: string | null };
};

export default function VerifyCertificatePage() {
  const { uuid } = useParams<{ uuid: string }>();

  const { data, isLoading, error } = useQuery<VerifyResponse>({
    queryKey: ['cert-verify', uuid],
    queryFn: () => api.get(`/api/certificates/verify/${uuid}`),
    enabled: !!uuid,
    retry: false,
  });

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-primary-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-full shadow-sm">
            <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center">
              <Award size={12} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-800">ZimHealth CPD</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
          {/* Top gradient bar */}
          <div className="h-2 bg-gradient-to-r from-primary-400 via-primary-500 to-teal-400" />

          <div className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                <ShieldCheck size={20} className="text-primary-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Certificate Verification</h1>
                <p className="text-xs text-slate-500 mt-0.5">Official ZimHealth CPD record</p>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-2/3" />
                <div className="h-4 bg-slate-200 rounded w-1/2" />
                <div className="h-4 bg-slate-200 rounded w-3/4" />
              </div>
            ) : error ? (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Certificate not found</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    This certificate could not be verified. It may be invalid or the UUID is incorrect.
                  </p>
                </div>
              </div>
            ) : data ? (
              <div className="space-y-5">
                {/* Valid banner */}
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-2.5 rounded-xl">
                  <ShieldCheck size={16} />
                  <p className="text-sm font-semibold">This certificate is authentic and valid</p>
                </div>

                {/* Credential details */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Holder</span>
                    <span className="text-sm font-bold text-slate-900 text-right">{data.learner.fullName}</span>
                  </div>
                  {data.learner.nczRegistrationNumber && (
                    <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-100">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">NCZ Reg No</span>
                      <span className="text-sm font-medium text-slate-700">{data.learner.nczRegistrationNumber}</span>
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">CPD Cycle</span>
                    <span className="text-sm font-medium text-slate-700">{data.cycleYear}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Points Earned</span>
                    <span className="text-sm font-bold text-primary-700">{data.totalPoints} CPD points</span>
                  </div>
                  <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Date Issued</span>
                    <span className="text-sm text-slate-700">
                      {new Date(data.issuedAt).toLocaleDateString('en-ZW', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4 py-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">UUID</span>
                    <span className="font-mono text-xs text-slate-400 text-right break-all">{data.certificateUuid}</span>
                  </div>
                </div>

                {/* Courses */}
                {data.coursesCompleted?.length > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen size={14} className="text-slate-500" />
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                        Courses completed ({data.coursesCompleted.length})
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {data.coursesCompleted.slice(0, 10).map((title) => (
                        <span
                          key={title}
                          className="text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full"
                        >
                          {title}
                        </span>
                      ))}
                      {data.coursesCompleted.length > 10 && (
                        <span className="text-xs text-slate-400 px-2 py-1">
                          +{data.coursesCompleted.length - 10} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="bg-slate-50 border-t border-slate-100 px-8 py-4 flex items-center justify-between">
            <Link to="/login" className="text-xs text-slate-500 hover:text-primary-600 hover:underline">
              ← Back to ZimHealth
            </Link>
            <span className="text-xs text-slate-400">Powered by ZimHealth CPD · Zimbabwe</span>
          </div>
        </div>
      </div>
    </main>
  );
}
