import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, BadgeCheck, Building2, Eye, EyeOff, Sparkles, UserPlus, Wand2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import { Logo } from '../components/brand/Logo';

const PANEL_HIGHLIGHTS: Array<[string, string]> = [
  ['Council-aware learning', 'No unrelated course noise after registration.'],
  ['Automatic renewal target', 'Required points come from your council rules.'],
  ['Ready for mobile', 'The same profile powers the app and WhatsApp flows.'],
  ['Works across the region', 'Every country keeps its own council, its own nurses.'],
  ['Offline-friendly', 'Download modules and sync your progress later.'],
];

type Council = {
  id: string;
  name: string;
  acronym: string;
  countryCode: string;
  countryName: string;
  requiredPoints: number;
  renewalMonth: number;
  renewalDay: number;
  registrationPrefix?: string | null;
  allowedTitles: string[];
};

export default function Register() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [accountType, setAccountType] = useState<'LEARNER' | 'CREATOR'>('LEARNER');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('');
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

  const councils = useMemo(() => councilsQuery.data?.councils ?? [], [councilsQuery.data?.councils]);
  const countries = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of councils) seen.set(c.countryCode, c.countryName);
    return Array.from(seen.entries()).map(([code, name]) => ({ code, name }));
  }, [councils]);
  const councilsInCountry = useMemo(
    () => (countryCode ? councils.filter((c) => c.countryCode === countryCode) : []),
    [councils, countryCode],
  );
  const selectedCouncil = useMemo(() => councils.find((c) => c.id === councilId) ?? null, [councilId, councils]);
  const titles = selectedCouncil?.allowedTitles ?? [];

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (accountType === 'CREATOR') {
        const res = await api.post<{ ok: true; message: string }>(
          '/api/auth/register-creator',
          {
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            password,
            councilId: councilId || undefined,
            professionalTitle: professionalTitle.trim() ? professionalTitle.trim() : undefined,
          },
        );
        navigate('/login', {
          replace: true,
          state: { notice: res.message },
        });
      } else {
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
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#150a26] text-[#0a1628] relative flex items-center justify-center p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_85%,rgba(124,58,237,0.20),transparent_55%),radial-gradient(circle_at_80%_18%,rgba(249,115,22,0.14),transparent_40%)]" />
      <div className="absolute left-8 top-12 hidden h-48 w-48 rounded-full border border-violet-200/80 lg:block" />
      <div className="absolute bottom-8 right-12 hidden h-64 w-64 rounded-[4rem] bg-white/40 rotate-12 lg:block" />

      <div className="relative grid w-full max-w-6xl grid-cols-1 overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 shadow-2xl backdrop-blur lg:grid-cols-[0.95fr_1.05fr]">
        <section className="relative hidden min-h-[720px] flex-col justify-between overflow-hidden bg-[#150a26] p-10 text-white lg:flex">
          <div className="absolute inset-0 bg-[linear-gradient(140deg,_rgba(124,58,237,0.40),_transparent_45%),radial-gradient(circle_at_80%_20%,_rgba(249,115,22,0.28),_transparent_30%)]" />
          <div className="pointer-events-none absolute -left-20 -bottom-20 h-[280px] w-[280px] rounded-full bg-orange-400/10 blur-3xl" />
          <div className="relative">
            <div className="mb-8">
              <Logo theme="dark" size="lg" />
            </div>
            <h1 className="mt-8 max-w-md text-5xl font-black leading-[0.95] tracking-tight">
              One CPD home for every health council.
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-6 text-slate-300">
              Your council and professional title shape the courses, renewal targets, and compliance journey you see after login.
            </p>
          </div>

          {/* Auto-scrolling feature rail — replaces the old static panel */}
          <div className="relative h-[220px] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_85%,transparent)]">
            <div className="auth-rail grid gap-3">
              {[...PANEL_HIGHLIGHTS, ...PANEL_HIGHLIGHTS].map(([title, body], i) => (
                <div key={`${title}-${i}`} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles size={15} className="text-orange-300" />
                    {title}
                  </div>
                  <p className="mt-1 text-xs text-slate-300">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="p-6 sm:p-10">
          <header className="mb-8">
            <div className="mb-5 flex justify-center lg:hidden">
              <Logo theme="light" size="lg" />
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-violet-800">
              <BadgeCheck size={14} />
              Account setup
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Create your account</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Choose learner registration or create a course creator account (admin approval required).
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Account type">
              <button
                type="button"
                role="radio"
                aria-checked={accountType === 'LEARNER'}
                onClick={() => setAccountType('LEARNER')}
                className={[
                  'rounded-2xl border px-4 py-3 text-left transition-colors',
                  accountType === 'LEARNER'
                    ? 'border-slate-950 bg-slate-950 text-white'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-900',
                ].join(' ')}
              >
                <div className="text-sm font-black">Learner</div>
                <div className={accountType === 'LEARNER' ? 'text-xs text-white/70 mt-1' : 'text-xs text-slate-500 mt-1'}>
                  Register with council + title to get matched courses.
                </div>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={accountType === 'CREATOR'}
                onClick={() => setAccountType('CREATOR')}
                className={[
                  'rounded-2xl border px-4 py-3 text-left transition-colors',
                  accountType === 'CREATOR'
                    ? 'border-slate-950 bg-slate-950 text-white'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-900',
                ].join(' ')}
              >
                <div className="flex items-center gap-2 text-sm font-black">
                  <Wand2 size={16} />
                  Course Creator
                </div>
                <div className={accountType === 'CREATOR' ? 'text-xs text-white/70 mt-1' : 'text-xs text-slate-500 mt-1'}>
                  Create an account, then admin verifies & approves you.
                </div>
              </button>
            </div>

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
                  <p className="text-sm font-bold text-slate-950">{accountType === 'CREATOR' ? 'Optional council context' : 'Council and title'}</p>
                  <p className="text-xs text-slate-500">
                    {accountType === 'CREATOR'
                      ? 'Creators can optionally link to a council. Admin approval is required before publishing.'
                      : 'This controls your dashboard, course library, and compliance reports.'}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Country" htmlFor="country">
                  <select
                    id="country"
                    value={countryCode}
                    onChange={(e) => {
                      setCountryCode(e.target.value);
                      setCouncilId('');
                      setProfessionalTitle('');
                    }}
                    required
                    className="field-input bg-white"
                  >
                    <option value="">{councilsQuery.isLoading ? 'Loading countries...' : 'Select your country'}</option>
                    {countries.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Council" htmlFor="council">
                  <select
                    id="council"
                    value={councilId}
                    onChange={(e) => {
                      setCouncilId(e.target.value);
                      setProfessionalTitle('');
                    }}
                    required
                    disabled={!countryCode}
                    className="field-input bg-white disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">{!countryCode ? 'Choose country first' : 'Select your council'}</option>
                    {councilsInCountry.map((council) => (
                      <option key={council.id} value={council.id}>
                        {council.acronym} - {council.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="sm:col-span-2">
                <Field label={accountType === 'CREATOR' ? 'Creator title (optional)' : 'Professional title'} htmlFor="professionalTitle">
                  <select
                    id="professionalTitle"
                    value={professionalTitle}
                    onChange={(e) => setProfessionalTitle(e.target.value)}
                    required={accountType === 'LEARNER'}
                    disabled={!selectedCouncil && accountType === 'LEARNER'}
                    className="field-input bg-white disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">
                      {accountType === 'CREATOR'
                        ? 'Course Creator'
                        : selectedCouncil ? 'Select your title' : 'Choose council first'}
                    </option>
                    {accountType === 'CREATOR'
                      ? ['Course Creator', 'Nurse Educator', 'Medical Educator', 'Pharmacy Educator'].map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))
                      : titles.map((title) => (
                          <option key={title} value={title}>{title}</option>
                        ))}
                  </select>
                </Field>
                </div>
              </div>

              {accountType === 'LEARNER' && (
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
              )}
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

            <button type="submit" disabled={loading || councilsQuery.isLoading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#150a26] py-4 text-sm font-black text-white shadow-xl shadow-slate-300 transition-all hover:-translate-y-0.5 hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <UserPlus size={17} />}
              {loading ? 'Creating your account...' : 'Create council-aware account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account? <Link to="/login" className="font-bold text-violet-700 hover:underline">Sign in</Link>
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
