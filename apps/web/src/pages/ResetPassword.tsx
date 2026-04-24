import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, KeyRound, ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import { toast } from '../components/ui/Toast';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get('token') ?? '', [params]);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{
        ok: true;
        user: {
          id: string;
          email: string;
          fullName: string;
          role: 'LEARNER' | 'ADMIN' | 'CONTENT_MANAGER' | 'NCZ_OFFICER' | 'COUNCIL_OFFICER';
          subscriptionTier?: string;
        };
        accessToken: string;
        refreshToken: string;
      }>('/api/auth/reset-password', { token, password });

      setAuth(res.user as unknown as Parameters<typeof setAuth>[0], res.accessToken, res.refreshToken);
      toast.success('Password reset. You are now signed in.');
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not reset password.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const tokenMissing = !token || token.length < 10;

  return (
    <main className="min-h-screen bg-[#030c1a] text-[#0a1628] relative flex items-center justify-center p-4 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_85%,rgba(59,130,246,0.16),transparent_55%),radial-gradient(circle_at_80%_18%,rgba(251,191,36,0.10),transparent_40%)]" />
      <div className="w-full max-w-md">
        <header className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img src="/brand-zimhealthcpd.png" alt="ZimHealth CPD" className="h-14 w-auto max-w-[240px] object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white mt-2">Set a new password</h1>
          <p className="text-white/60 mt-1 text-sm">Choose a strong password you’ll remember.</p>
        </header>

        <section className="bg-white/85 backdrop-blur rounded-2xl border border-white/15 shadow-2xl shadow-black/20 p-8 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">Reset password</h2>
            <Link to="/login" className="text-xs font-semibold text-primary-700 hover:underline inline-flex items-center gap-1">
              <ArrowLeft size={14} />
              Back to login
            </Link>
          </div>

          {tokenMissing ? (
            <div role="alert" className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Reset link is missing</p>
                <p className="text-xs mt-1">Open the reset link from your email again, or request a new one.</p>
                <Link to="/forgot-password" className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-red-700 hover:underline">
                  Request a new link →
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                  New password
                </label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                    aria-invalid={Boolean(error)}
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3" role="alert">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-primary-700 text-white font-semibold py-3 rounded-xl hover:bg-primary-800 active:bg-primary-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm text-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving…
                  </span>
                ) : (
                  'Set new password'
                )}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

