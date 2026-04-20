import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
          <div className="text-xs text-slate-500">NursePro CPD</div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Certificate Verification</h1>

          {isLoading ? (
            <div className="mt-6 h-24 bg-slate-100 rounded-xl animate-pulse" />
          ) : error ? (
            <div className="mt-6 text-sm text-red-600">{(error as Error).message}</div>
          ) : data ? (
            <div className="mt-6 space-y-3">
              <div className="text-sm text-slate-700">
                Learner: <span className="font-semibold text-slate-900">{data.learner.fullName}</span>
              </div>
              {data.learner.nczRegistrationNumber ? (
                <div className="text-sm text-slate-700">NCZ Reg No: {data.learner.nczRegistrationNumber}</div>
              ) : null}
              <div className="text-sm text-slate-700">
                Cycle: <span className="font-medium">{data.cycleYear}</span>
              </div>
              <div className="text-sm text-slate-700">
                Total points: <span className="font-medium">{data.totalPoints}</span>
              </div>
              <div className="text-xs text-slate-500">
                Issued {new Date(data.issuedAt).toLocaleDateString('en-ZW')} • UUID {data.certificateUuid}
              </div>

              {data.coursesCompleted?.length ? (
                <div className="pt-3 border-t border-slate-200">
                  <div className="text-sm font-semibold text-slate-900">Courses completed</div>
                  <ul className="mt-2 text-sm text-slate-600 space-y-1">
                    {data.coursesCompleted.slice(0, 8).map((t) => (
                      <li key={t}>- {t}</li>
                    ))}
                    {data.coursesCompleted.length > 8 ? (
                      <li className="text-slate-400">- …and {data.coursesCompleted.length - 8} more</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-8 flex items-center justify-between">
            <Link to="/login" className="text-sm text-slate-600 hover:underline">
              Back to NursePro
            </Link>
            <div className="text-xs text-slate-400">Verified by NursePro CPD</div>
          </div>
        </div>
      </div>
    </div>
  );
}

