import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Mail, ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../components/ui/Toast';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email: email.trim().toLowerCase() });
      setSent(true);
      toast.success('If that email exists, a reset link has been sent.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not start password reset.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#030c1a] text-[#0a1628] relative flex items-center justify-center p-4 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_85%,rgba(59,130,246,0.16),transparent_55%),radial-gradient(circle_at_80%_18%,rgba(251,191,36,0.10),transparent_40%)]" />
      <div className="w-full max-w-md">
        <header className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img src="/brand-zimhealthcpd.png" alt="ZimHealth CPD" className="h-14 w-auto max-w-[240px] object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white mt-2">Reset your password</h1>
          <p className="text-white/60 mt-1 text-sm">We’ll email you a link to set a new password.</p>
        </header>

        <section className="bg-white/85 backdrop-blur rounded-2xl border border-white/15 shadow-2xl shadow-black/20 p-8 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">Forgot password</h2>
            <Link to="/login" className="text-xs font-semibold text-primary-700 hover:underline inline-flex items-center gap-1">
              <ArrowLeft size={14} />
              Back to login
            </Link>
          </div>

          {sent ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Check your email</p>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                If an account exists for <span className="font-medium">{email.trim().toLowerCase()}</span>, you’ll receive a reset link shortly.
              </p>
              <p className="text-xs text-slate-500 mt-3">
                In dev, if SMTP is not configured, the backend will print the reset link in its console logs.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow placeholder:text-slate-400"
                  />
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
                className="w-full bg-primary-700 text-white font-semibold py-3 rounded-xl hover:bg-primary-800 active:bg-primary-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm text-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending…
                  </span>
                ) : (
                  'Send reset link'
                )}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

