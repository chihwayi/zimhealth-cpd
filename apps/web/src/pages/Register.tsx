import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, BadgeCheck, Building2, Eye, EyeOff, Sparkles, UserPlus } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth.store';

type Council = {
  id: string;
  name: string;
  acronym: string;
  requiredPoints: number;
  renewalMonth: number;
  renewalDay: number;
  registrationPrefix?: string | null;
  allowedTitles: string[];
};

export default function Register() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [councilId, setCouncilId] = useState('');
  const [professionalTitle, setProfessionalTitle] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const councilsQuery = useQuery<{ councils: Council[] }>({
    queryKey: ['councils'],
    queryFn: () => api.get('/api/councils'),
  });

  const councils = councilsQuery.data?.councils ?? [];
  const selectedCouncil = useMemo(() => councils.find((c) => c.id === councilId) ?? null, [councilId, councils]);
  const titles = selectedCouncil?.allowedTitles ?? [];

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
          role: 'LEARNER' | 'ADMIN' | 'CONTENT_MANAGER' | 'NCZ_OFFICER' | 'COUNCIL_OFFICER';
          councilId?: string | null;
          professionalTitle?: string | null;
          registrationNumber?: string | null;
          subscriptionTier?: string;
        };
        accessToken: string;
        refreshToken: string;
      }>('/api/auth/register', {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        councilId,
        professionalTitle,
        registrationNumber: registrationNumber.trim().toUpperCase(),
      });

      setAuth(res.user as unknown as Parameters<typeof setAuth>[0], res.accessToken, res.refreshToken);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#071510] text-[#0B1F1A] relative flex items-center justify-center p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_85%,rgba(78,203,160,0.16),transparent_55%),radial-gradient(circle_at_80%_18%,rgba(251,191,36,0.10),transparent_40%)]" />
      <div className="absolute left-8 top-12 hidden h-48 w-48 rounded-full border border-emerald-200/80 lg:block" />
      <div className="absolute bottom-8 right-12 hidden h-64 w-64 rounded-[4rem] bg-white/40 rotate-12 lg:block" />

      <div className="relative grid w-full max-w-6xl grid-cols-1 overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 shadow-2xl backdrop-blur lg:grid-cols-[0.95fr_1.05fr]">
        <section className="relative hidden min-h-[720px] flex-col justify-between overflow-hidden bg-slate-950 p-10 text-white lg:flex">
          <div className="absolute inset-0 bg-[linear-gradient(140deg,_rgba(20,184,166,0.35),_transparent_45%),radial-gradient(circle_at_80%_20%,_rgba(251,191,36,0.24),_transparent_30%)]" />
          <div className="relative">
            <img
              src="/logo.png"
              alt="ZimHealth CPD"
              className="mb-8 w-full max-w-xs h-auto rounded-2xl bg-white text-slate-950 shadow-xl ring-1 ring-white/10 p-2"
            />
            <h1 className="mt-8 max-w-md text-5xl font-black leading-[0.95] tracking-tight">
              One CPD home for every health council.
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-6 text-slate-300">
              Your council and professional title shape the courses, renewal targets, and compliance journey you see after login.
            </p>
          </div>

          <div className="relative grid gap-3">
            {[
              ['Council-aware learning', 'No unrelated course noise after registration.'],
              ['Automatic renewal target', 'Required points come from your council rules.'],
              ['Ready for mobile', 'The same profile will power app and WhatsApp flows.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles size={15} className="text-emerald-300" />
                  {title}
                </div>
                <p className="mt-1 text-xs text-slate-300">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="p-6 sm:p-10">
          <header className="mb-8">
            <img
              src="/logo.png"
              alt="ZimHealth CPD"
              className="mx-auto mb-4 w-full max-w-xs h-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-2 lg:hidden"
            />
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">
              <BadgeCheck size={14} />
              Professional identity
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Create your ZimHealth account</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Select your council and title once. We will use that to show only relevant CPD content after login.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="fullName">
                <input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} placeholder="Grace Moyo" className="field-input" />
              </Field>
              <Field label="Email address" htmlFor="email">
                <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="field-input" />
              </Field>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-emerald-50/70 p-4 shadow-sm">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <Building2 size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-950">Council and title</p>
                  <p className="text-xs text-slate-500">This controls your dashboard, course library, and compliance reports.</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Council" htmlFor="council">
                  <select
                    id="council"
                    value={councilId}
                    onChange={(e) => {
                      setCouncilId(e.target.value);
                      setProfessionalTitle('');
                    }}
                    required
                    className="field-input bg-white"
                  >
                    <option value="">{councilsQuery.isLoading ? 'Loading councils...' : 'Select your council'}</option>
                    {councils.map((council) => (
                      <option key={council.id} value={council.id}>
                        {council.acronym} - {council.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Professional title" htmlFor="professionalTitle">
                  <select
                    id="professionalTitle"
                    value={professionalTitle}
                    onChange={(e) => setProfessionalTitle(e.target.value)}
                    required
                    disabled={!selectedCouncil}
                    className="field-input bg-white disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">{selectedCouncil ? 'Select your title' : 'Choose council first'}</option>
                    {titles.map((title) => (
                      <option key={title} value={title}>{title}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <Field label="Registration number" htmlFor="registrationNumber">
                  <input
                    id="registrationNumber"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    required
                    placeholder={selectedCouncil?.registrationPrefix ? `${selectedCouncil.registrationPrefix}-2026-000123` : 'Council registration number'}
                    className="field-input uppercase"
                  />
                </Field>
                <div className="rounded-2xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-slate-200">
                  <p className="text-xs text-slate-500">Annual target</p>
                  <p className="font-black text-slate-950">{selectedCouncil ? `${selectedCouncil.requiredPoints} CPD pts` : 'Set by council'}</p>
                </div>
              </div>
            </div>

            <Field label="Password" htmlFor="password">
              <div className="relative">
                <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="At least 8 characters" className="field-input pr-10" />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            {error && (
              <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700" role="alert">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading || councilsQuery.isLoading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 py-4 text-sm font-black text-white shadow-xl shadow-slate-300 transition-all hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <UserPlus size={17} />}
              {loading ? 'Creating your account...' : 'Create council-aware account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account? <Link to="/login" className="font-bold text-emerald-700 hover:underline">Sign in</Link>
          </p>
        </section>
      </div>
    </main>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-bold text-slate-800">{label}</label>
      {children}
    </div>
  );
}
