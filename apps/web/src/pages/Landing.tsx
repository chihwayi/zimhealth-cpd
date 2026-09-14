import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Globe2,
  GraduationCap,
  ShieldCheck,
  Smartphone,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/brand/Logo';
import { WhatsAppIcon } from '../components/brand/WhatsAppIcon';
import { api } from '../lib/api';

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Matched to your council',
    body: 'Register with your council and professional title — your dashboard, course library, and renewal targets are set automatically.',
  },
  {
    icon: GraduationCap,
    title: 'Real CPD credit',
    body: 'Points, quizzes, and certificates map directly to what your regulatory council requires for licence renewal.',
  },
  {
    icon: WifiOff,
    title: 'Works without signal',
    body: 'Download modules for offline study and sync your progress automatically the next time you’re online.',
  },
  {
    icon: Smartphone,
    title: 'Learn on WhatsApp',
    body: 'No app, no data-heavy downloads — earn CPD points through bite-sized lessons and quizzes over WhatsApp.',
  },
];

const STEPS = [
  { step: '01', title: 'Pick your country & council', body: 'Every council sees only its own registered nurses — your data stays with your regulator.' },
  { step: '02', title: 'Learn your way', body: 'Web, offline downloads, or WhatsApp — study however fits your shift.' },
  { step: '03', title: 'Renew with confidence', body: 'Track points in real time and download a verifiable certificate when you’re done.' },
];

export default function Landing() {
  const councilsQuery = useQuery<{ councils: Array<{ id: string; name: string; acronym: string; countryName?: string }> }>({
    queryKey: ['councils', 'landing'],
    queryFn: () => api.get('/api/councils'),
    staleTime: 5 * 60 * 1000,
  });
  const supportedCouncils = councilsQuery.data?.councils ?? [];

  return (
    <main className="min-h-screen bg-[#030c1a] text-white overflow-x-hidden">
      {/* Ambient background — no static hero image, just soft animated light */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -left-40 -top-32 h-[420px] w-[420px] rounded-full bg-blue-500/10 blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute right-0 top-1/3 h-[380px] w-[380px] rounded-full bg-teal-400/10 blur-3xl animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute left-1/4 bottom-0 h-[320px] w-[320px] rounded-full bg-amber-400/5 blur-3xl" />
      </div>

      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo theme="dark" size="md" />
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/login"
            className="rounded-xl px-3.5 py-2 text-sm font-semibold text-white/75 hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white text-slate-950 px-4 py-2 text-sm font-bold hover:bg-blue-50 transition-colors shadow-lg shadow-black/20"
          >
            Get started
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-8 sm:pt-14">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/25 bg-blue-400/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-200">
          <Globe2 size={13} />
          One platform, every council
        </div>

        <h1
          className="mt-6 max-w-2xl text-[2.4rem] leading-[1.1] sm:text-5xl sm:leading-[1.08]"
          style={{ fontFamily: '"DM Serif Display", ui-serif, Georgia, serif' }}
        >
          CPD built for <span className="text-blue-300">Africa&apos;s</span> health workforce
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-7 text-white/60">
          Earn continuing professional development points, renew your licence, and grow clinical
          skills — matched to your own country&apos;s council, online, offline, or over WhatsApp.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            to="/register"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-500 px-6 py-4 text-sm font-black text-white shadow-xl shadow-blue-900/30 transition-colors"
          >
            Create your account
            <ArrowRight size={16} />
          </Link>
          <a
            href="https://wa.me/263771234567"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-[#25D366]/15 border border-[#25D366]/30 hover:bg-[#25D366]/25 px-6 py-4 text-sm font-black text-[#25D366] transition-colors"
          >
            <WhatsAppIcon className="h-4 w-4" />
            Start on WhatsApp
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>

        {/* Supported councils strip */}
        <div className="mt-10">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">
            {supportedCouncils.length ? 'Supported councils' : councilsQuery.isLoading ? 'Loading councils…' : ''}
          </div>
          {supportedCouncils.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {supportedCouncils.map((c) => (
                <span
                  key={c.id}
                  title={c.name}
                  className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-black tracking-wide text-blue-200"
                >
                  {c.acronym}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                <f.icon size={18} />
              </div>
              <div className="mt-4 text-sm font-bold text-white/90">{f.title}</div>
              <p className="mt-1.5 text-xs leading-6 text-white/50">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-200">
          <Sparkles size={13} />
          How it works
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.step} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-3xl font-black text-white/10">{s.step}</div>
              <div className="mt-2 text-sm font-bold text-white/90">{s.title}</div>
              <p className="mt-1.5 text-xs leading-6 text-white/50">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-blue-600/20 via-white/5 to-teal-500/10 p-8 sm:p-10">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-white/90">
                <BookOpen size={16} className="text-blue-300" />
                Ready when you are
              </div>
              <p className="mt-2 max-w-md text-sm text-white/55">
                Set up your account in a couple of minutes — your council and title decide everything else.
              </p>
            </div>
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white text-slate-950 px-6 py-3.5 text-sm font-black hover:bg-blue-50 transition-colors shadow-xl shadow-black/20 flex-shrink-0"
            >
              Create free account
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl border-t border-white/10 px-5 py-6 text-center text-xs text-white/35 sm:px-8">
        © {new Date().getFullYear()} <span className="font-semibold text-white/60">Central and Southern African CPD Hub</span>
      </footer>
    </main>
  );
}
