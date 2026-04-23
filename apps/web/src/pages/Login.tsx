import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Award } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { api } from '../lib/api';

const ROLE_REDIRECT: Record<string, string> = {
  ADMIN: '/admin',
  CONTENT_MANAGER: '/creator',
  NCZ_OFFICER: '/ncz',
  COUNCIL_OFFICER: '/council',
  LEARNER: '/dashboard',
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    typeof (location.state as { from?: { pathname?: string } } | null)?.from?.pathname === 'string'
      ? (location.state as { from: { pathname: string } }).from.pathname
      : '/';

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{
        user: {
          id: string;
          email: string;
          fullName: string;
          role: 'ADMIN' | 'CONTENT_MANAGER' | 'NCZ_OFFICER' | 'COUNCIL_OFFICER' | 'LEARNER';
          subscriptionTier?: string;
          subscriptionExpiresAt?: string;
          avatarUrl?: string;
          nczRegistrationNumber?: string | null;
          councilId?: string | null;
          professionalTitle?: string | null;
          registrationNumber?: string | null;
        };
        accessToken: string;
        refreshToken: string;
      }>(
        '/api/auth/login',
        { email, password },
      );
      setAuth(res.user, res.accessToken, res.refreshToken);
      const dest = from !== '/' ? from : (ROLE_REDIRECT[res.user.role] ?? '/dashboard');
      navigate(dest, { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid email or password.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <header className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-500 shadow-lg mb-4">
            <Award size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">ZimHealth CPD</h1>
          <p className="text-slate-500 mt-2 text-sm">
            Continuing Professional Development for Zimbabwe's health professionals
          </p>
        </header>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                aria-invalid={Boolean(error)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow placeholder:text-slate-400"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="text-sm font-medium text-slate-700">
                  Password
                </label>
                <a href="/forgot-password" className="text-xs text-primary-700 hover:underline">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  aria-invalid={Boolean(error)}
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow placeholder:text-slate-400"
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

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3" role="alert">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-700 text-white font-semibold py-3 rounded-xl hover:bg-primary-800 active:bg-primary-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm text-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Don't have an account?{' '}
            <a href="/register" className="text-primary-700 hover:underline font-medium">
              Register here
            </a>
          </p>
        </section>

        {/* Footer */}
        <footer className="text-center text-xs text-slate-400 mt-6">
          ZimHealth CPD · Zimbabwe · Learn. Earn. Advance.
        </footer>
      </div>
    </main>
  );
}
