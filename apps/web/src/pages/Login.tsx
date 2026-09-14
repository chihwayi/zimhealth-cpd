import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { api } from '../lib/api';
import { Logo } from '../components/brand/Logo';

const ROLE_REDIRECT: Record<string, string> = {
  PLATFORM_OWNER: '/admin',
  COUNTRY_ADMIN: '/admin',
  CONTENT_MANAGER: '/creator',
  COUNCIL_OFFICER: '/council',
  LEARNER: '/dashboard',
  HELPDESK: '/helpdesk',
};

export default function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    typeof (location.state as { from?: { pathname?: string } } | null)?.from?.pathname === 'string'
      ? (location.state as { from: { pathname: string } }).from.pathname
      : '/';

  useEffect(() => {
    const n = (location.state as { notice?: string } | null)?.notice;
    if (typeof n === 'string' && n.trim()) setNotice(n.trim());
  }, [location.state]);

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
          role: 'PLATFORM_OWNER' | 'COUNTRY_ADMIN' | 'CONTENT_MANAGER' | 'COUNCIL_OFFICER' | 'LEARNER' | 'HELPDESK';
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
    <main className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-gradient-to-br from-[#2e1065] via-[#6d28d9] to-[#ea580c]">
      {/* Sunrise gradient mesh — violet-to-amber, the new brand signature */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.16),transparent_45%),radial-gradient(circle_at_85%_80%,rgba(249,115,22,0.35),transparent_50%),radial-gradient(circle_at_80%_10%,rgba(251,191,36,0.18),transparent_40%)]" />
      <div className="pointer-events-none absolute -left-32 -bottom-32 h-[380px] w-[380px] rounded-full bg-fuchsia-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-[320px] w-[320px] rounded-full bg-orange-300/25 blur-3xl" />

      <div className="w-full max-w-md relative">
        <div className="flex justify-center mb-6">
          <Link to="/" className="inline-flex">
            <Logo theme="dark" size="lg" />
          </Link>
        </div>

        {/* Brand */}
        <header className="text-center mb-8">
          <p className="text-sm font-bold tracking-wide uppercase text-white/90">
            Continuing Professional Development
          </p>
          <p className="mt-1 text-white/70 text-xs">
            For health professionals across Central &amp; Southern Africa
          </p>
        </header>

        <section className="bg-white rounded-[1.75rem] shadow-2xl shadow-indigo-950/40 p-8">
          <h2 className="text-xl font-black text-slate-900 mb-6">{t('auth.welcomeBack')}</h2>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {notice && (
              <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800" role="status">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <p className="text-sm">{notice}</p>
              </div>
            )}
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-800 mb-1.5">
                {t('auth.email')}
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
                className="w-full px-3.5 py-3 rounded-xl border-2 border-violet-100 text-sm focus:outline-none focus:ring-4 focus:ring-violet-100 focus:border-violet-500 transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="text-sm font-semibold text-slate-800">
                  {t('auth.password')}
                </label>
                <a href="/forgot-password" className="text-xs font-semibold text-orange-600 hover:text-orange-700 hover:underline">
                  {t('auth.forgotPassword')}
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
                  className="w-full px-3.5 py-3 pr-11 rounded-xl border-2 border-violet-100 text-sm focus:outline-none focus:ring-4 focus:ring-violet-100 focus:border-violet-500 transition-all placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-600 transition-colors"
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
              className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-orange-500 text-white font-bold py-3.5 rounded-xl hover:from-violet-700 hover:to-orange-600 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-900/20 text-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                <>
                  {t('auth.login')}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            {t('auth.dontHaveAccount')}{' '}
            <a href="/register" className="text-orange-600 hover:text-orange-700 hover:underline font-bold">
              Register here
            </a>
          </p>
        </section>

        {/* Footer */}
        <footer className="text-center text-xs text-white/60 mt-6">
          Central and Southern African CPD Hub · Learn. Earn. Advance.
        </footer>
      </div>
    </main>
  );
}
