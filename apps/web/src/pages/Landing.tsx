import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Globe, LogIn, MessageCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function Landing() {
  const navigate = useNavigate();

  const councilsQuery = useQuery<{ councils: Array<{ id: string; name: string; acronym: string }> }>({
    queryKey: ['councils', 'landing'],
    queryFn: () => api.get('/api/councils'),
    staleTime: 5 * 60 * 1000,
  });
  const supportedCouncils = councilsQuery.data?.councils ?? [];

  return (
    <main className="min-h-screen lg:h-dvh lg:overflow-hidden bg-[#071510] text-white">
      <div className="relative h-full">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_85%,rgba(78,203,160,0.16),transparent_55%),radial-gradient(circle_at_80%_18%,rgba(251,191,36,0.10),transparent_40%)]" />
        <div className="pointer-events-none absolute -left-40 -bottom-40 h-[520px] w-[520px] rounded-full border border-emerald-400/10" />
        <div className="pointer-events-none absolute -left-24 -bottom-24 h-[380px] w-[380px] rounded-full border border-emerald-400/10" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-[180px] w-[180px] rounded-full border border-emerald-400/10" />

        <div className="relative mx-auto flex h-full max-w-6xl flex-col px-6 py-10 sm:px-10 lg:px-12 lg:py-12">
          {/* Top bar */}
          <div className="flex items-center justify-between gap-4">
            <img
              src="/logo.png"
              alt="ZimHealth CPD"
              className="h-12 w-auto max-w-[240px] rounded-2xl bg-white/5 shadow-[0_18px_50px_rgba(0,0,0,0.35)] ring-1 ring-white/10 p-2 object-contain"
            />
            <Link
              to="/register"
              className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            >
              Create account
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* Main content */}
          <div className="mt-10 grid flex-1 min-h-0 grid-cols-1 gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
            <section className="min-h-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-200">
                <Globe size={14} />
                Council-aware CPD
              </div>

              <h1
                className="mt-5 text-[34px] leading-[1.15] max-w-xl"
                style={{ fontFamily: '"DM Serif Display", ui-serif, Georgia, serif' }}
              >
                Professional development for Zimbabwe&apos;s <span className="text-emerald-300">health workforce</span>
              </h1>
              <p className="mt-4 text-sm leading-7 text-white/55 max-w-xl">
                Earn CPD points, renew your licence, and grow clinical skills — online, offline, and via WhatsApp.
              </p>

              <div className="mt-6 grid gap-3 max-w-xl">
                {[
                  { title: 'Matched learning', body: 'Courses are filtered automatically by your council + professional title.' },
                  { title: 'Clear targets', body: 'Required points and renewal deadlines come from your council rules.' },
                  { title: 'Works anywhere', body: 'Learn online, offline, and via WhatsApp micro-lessons.' },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-white/90">
                      <CheckCircle2 size={16} className="text-emerald-300" />
                      {item.title}
                    </div>
                    <p className="mt-1 text-xs leading-6 text-white/55">{item.body}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="min-h-0">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 backdrop-blur">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-white/35">Quick access</div>

                <div className="mt-4 grid gap-2">
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 py-3.5 text-sm font-black text-white shadow-xl shadow-emerald-900/20 transition-colors"
                  >
                    <LogIn size={16} />
                    Sign in
                    <ArrowRight size={16} />
                  </button>

                  <Link
                    to="/register"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3.5 text-sm font-black text-white/85 hover:bg-white/10 transition-colors"
                  >
                    Create account
                    <ArrowRight size={16} className="text-white/40" />
                  </Link>

                  <a
                    href="https://wa.me/263771234567"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3.5 text-sm font-black text-white/85 hover:bg-white/10 transition-colors"
                  >
                    <MessageCircle size={16} />
                    WhatsApp
                    <ArrowRight size={16} className="text-white/40" />
                  </a>
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-white/35">Supported councils</div>
                    <span className="text-xs font-semibold text-white/35">{supportedCouncils.length || '—'}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {supportedCouncils.length ? (
                      supportedCouncils.map((c) => (
                        <span
                          key={c.id}
                          title={c.name}
                          className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-black tracking-wide text-emerald-200 hover:bg-white/10 transition-colors"
                        >
                          {c.acronym}
                        </span>
                      ))
                    ) : (
                      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[12px] text-white/40">
                        {councilsQuery.isLoading ? 'Loading councils…' : 'No councils available yet.'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <footer className="mt-8 border-t border-white/10 pt-5 text-center text-xs text-white/35">
            © {new Date().getFullYear()} <span className="font-semibold text-white/60">ZimHealth CPD</span> ·
            zimhealthcpd.co.zw
          </footer>
        </div>
      </div>
    </main>
  );
}

