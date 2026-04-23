import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

type Portal = 'learner' | 'creator' | 'council' | 'admin';

const PORTALS: Array<{
  key: Portal;
  label: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  icon: JSX.Element;
  accent: 'teal' | 'slate';
}> = [
  {
    key: 'learner',
    label: 'Learner',
    eyebrow: 'Earn CPD points',
    title: 'Welcome back',
    subtitle: 'Sign in to see only courses eligible for your council and professional title.',
    cta: 'Sign in to Learner Portal',
    icon: <BookOpen size={16} />,
    accent: 'teal',
  },
  {
    key: 'creator',
    label: 'Creator',
    eyebrow: 'Publish council-aware courses',
    title: 'Creator portal',
    subtitle: 'Build courses, set audience by council/title, and publish with confidence.',
    cta: 'Sign in to Creator Portal',
    icon: <Sparkles size={16} />,
    accent: 'teal',
  },
  {
    key: 'council',
    label: 'Council',
    eyebrow: 'Compliance oversight',
    title: 'Council portal',
    subtitle: 'Access CPD compliance data for professionals registered under your council.',
    cta: 'Access Council Dashboard',
    icon: <Building2 size={16} />,
    accent: 'teal',
  },
  {
    key: 'admin',
    label: 'Admin',
    eyebrow: 'System operations',
    title: 'System administration',
    subtitle: 'Restricted access for authorised personnel. All sessions are audited.',
    cta: 'Secure sign in',
    icon: <ShieldCheck size={16} />,
    accent: 'slate',
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const [portal, setPortal] = useState<Portal>('learner');

  const active = useMemo(() => PORTALS.find((p) => p.key === portal) ?? PORTALS[0], [portal]);

  const goLogin = () => navigate('/login', { state: { from: { pathname: portal === 'admin' ? '/admin' : portal === 'council' ? '/ncz' : portal === 'creator' ? '/creator' : '/dashboard' } } });

  return (
    <main className="min-h-screen bg-[#F2F8F5] text-[#0B1F1A]">
      <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[480px_1fr]">
        {/* Left panel */}
        <aside className="relative hidden lg:flex flex-col overflow-hidden bg-[#071510] px-12 py-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_90%,rgba(78,203,160,0.14),transparent_52%),radial-gradient(circle_at_75%_10%,rgba(29,158,117,0.14),transparent_42%)]" />
          <div className="pointer-events-none absolute -left-40 -bottom-40 h-[520px] w-[520px] rounded-full border border-emerald-400/10" />
          <div className="pointer-events-none absolute -left-24 -bottom-24 h-[380px] w-[380px] rounded-full border border-emerald-400/10" />
          <div className="pointer-events-none absolute -left-10 -bottom-10 h-[240px] w-[240px] rounded-full border border-emerald-400/15" />
          <div className="pointer-events-none absolute -right-16 -top-16 h-[180px] w-[180px] rounded-full border border-emerald-400/10" />
          <div className="pointer-events-none absolute -right-8 -top-8 h-[110px] w-[110px] rounded-full border border-emerald-400/15" />

          <div className="relative">
            <Link to="/" className="inline-flex items-center gap-4 no-underline">
              <div className="h-12 w-12 rounded-2xl overflow-hidden shadow-[0_18px_50px_rgba(0,0,0,0.35)] ring-1 ring-white/10 bg-white/5">
                <img src="/logo.png" alt="ZimHealth CPD" className="h-full w-full object-cover" />
              </div>
              <div className="leading-none">
                <div
                  className="text-white text-[22px] tracking-[-0.02em]"
                  style={{ fontFamily: '"DM Serif Display", ui-serif, Georgia, serif' }}
                >
                  Zim<span className="text-emerald-300">Health</span>
                </div>
                <div className="mt-1 text-[10px] font-semibold tracking-[0.45em] uppercase text-emerald-200/50">
                  CPD
                </div>
              </div>
            </Link>

            <div className="mt-14">
              <h1
                className="text-white text-[34px] leading-[1.2] max-w-sm"
                style={{ fontFamily: '"DM Serif Display", ui-serif, Georgia, serif' }}
              >
                Professional development for Zimbabwe&apos;s <span className="text-emerald-300">health workforce</span>
              </h1>
              <p className="mt-5 text-sm leading-7 text-white/45 max-w-sm">
                Earn CPD points, renew your licence, and grow clinical skills — online, offline, and via WhatsApp.
              </p>
            </div>

            <div className="mt-12">
              <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-white/25">
                Supported regulatory councils
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {[
                  'Nurses Council of Zimbabwe',
                  'Medical & Dental Practitioners Council',
                  'Pharmacists Council of Zimbabwe',
                ].map((name) => (
                  <div
                    key={name}
                    className="flex items-center gap-3 rounded-xl border border-emerald-300/15 bg-emerald-300/5 px-4 py-3 text-[13px] text-white/55 hover:bg-emerald-300/10 hover:text-white/75 transition-colors"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    {name}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-12 text-[11px] text-white/20">© {new Date().getFullYear()} ZimHealth CPD · zimhealthcpd.co.zw</div>
          </div>
        </aside>

        {/* Right panel */}
        <section className="flex items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-[460px]">
            {/* Mobile header */}
            <div className="lg:hidden mb-8 flex items-center justify-between">
              <Link to="/" className="inline-flex items-center gap-3 no-underline">
                <div className="h-11 w-11 rounded-2xl overflow-hidden ring-1 ring-slate-200 bg-white shadow-sm">
                  <img src="/logo.png" alt="ZimHealth CPD" className="h-full w-full object-cover" />
                </div>
                <div className="leading-none">
                  <div
                    className="text-slate-900 text-[20px] tracking-[-0.02em]"
                    style={{ fontFamily: '"DM Serif Display", ui-serif, Georgia, serif' }}
                  >
                    Zim<span className="text-emerald-700">Health</span>
                  </div>
                  <div className="mt-1 text-[10px] font-semibold tracking-[0.45em] uppercase text-slate-400">
                    CPD
                  </div>
                </div>
              </Link>
              <Link to="/register" className="text-xs font-bold text-emerald-700 hover:underline">
                Create account
              </Link>
            </div>

            {/* Portal tabs */}
            <div className="grid grid-cols-4 gap-1 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-1.5 shadow-sm">
              {PORTALS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPortal(p.key)}
                  className={clsx(
                    'rounded-xl px-2 py-2 text-xs font-semibold transition-all',
                    portal === p.key
                      ? p.accent === 'slate'
                        ? 'bg-slate-950 text-white shadow'
                        : 'bg-emerald-600 text-white shadow'
                      : 'text-emerald-900/60 hover:bg-white/70 hover:text-emerald-950',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Form panel */}
            <div className="mt-10">
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-800">
                  {portal === 'admin' ? <ShieldCheck size={14} /> : <Award size={14} />}
                  {active.eyebrow}
                </div>
                <h2
                  className="mt-4 text-[28px] leading-tight text-slate-950"
                  style={{ fontFamily: '"DM Serif Display", ui-serif, Georgia, serif' }}
                >
                  {active.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{active.subtitle}</p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_22px_60px_rgba(11,31,26,0.08)] overflow-hidden">
                <div className="p-6 sm:p-7 space-y-4">
                  <div className="grid gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-xs font-semibold text-slate-500">Sign in</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        Use your email and password on the next screen.
                      </div>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
                        <Users size={14} />
                        Council-aware learning
                      </div>
                      <p className="mt-1 text-xs leading-5 text-emerald-800">
                        Courses are filtered automatically based on your council and professional title — no more irrelevant noise.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={goLogin}
                    className={clsx(
                      'w-full inline-flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black text-white transition-all',
                      portal === 'admin'
                        ? 'bg-slate-950 hover:bg-slate-900 shadow-xl shadow-slate-200'
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-100',
                    )}
                  >
                    {active.icon}
                    {active.cta}
                    <ArrowRight size={16} />
                  </button>

                  <div className="flex items-center gap-3 py-1">
                    <div className="h-px flex-1 bg-slate-200" />
                    <div className="text-[11px] font-semibold text-slate-400">or</div>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>

                  <a
                    href="https://wa.me/263771234567"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-[#25D366] hover:bg-[#F0FFF6] transition-colors"
                  >
                    <div className="h-10 w-10 rounded-2xl bg-[#25D366] flex items-center justify-center text-white font-black">
                      WA
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900">Continue via WhatsApp</div>
                      <div className="text-xs text-slate-600">No app download needed · Micro-lessons on your phone</div>
                    </div>
                    <ArrowRight className="ml-auto text-slate-300 group-hover:text-[#25D366]" size={16} />
                  </a>
                </div>

                <div className="border-t border-slate-100 bg-slate-50 px-6 py-5 text-center">
                  <p className="text-sm text-slate-600">
                    New to ZimHealth CPD?{' '}
                    <Link to="/register" className="font-black text-emerald-700 hover:underline">
                      Create a free account
                    </Link>
                  </p>
                </div>
              </div>

              <p className="mt-7 text-center text-xs text-slate-400">
                ZimHealth CPD · Harare, Zimbabwe
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

