import { Sidebar } from './Sidebar';
import { OfflineBanner } from '../ui/OfflineBanner';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Menu, UserCog } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { Logo } from '../brand/Logo';
import { api } from '../../lib/api';

interface Props {
  children: ReactNode;
}

export function AppShell({ children }: Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const ownerSession = useAuthStore((s) => s.ownerSession);
  const stopImpersonation = useAuthStore((s) => s.stopImpersonation);
  const isCouncilRole = user?.role === 'COUNCIL_OFFICER';
  const isAdmin = user?.role === 'PLATFORM_OWNER' || user?.role === 'COUNTRY_ADMIN';

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  async function handleStopImpersonating() {
    try {
      await api.post('/api/auth/impersonate/end', {});
    } catch {
      // best-effort audit call — still restore the owner session locally either way
    }
    stopImpersonation();
    navigate('/admin');
  }

  return (
    <div className="min-h-dvh flex flex-col">
      {ownerSession && (
        <div className="flex-shrink-0 z-[60] flex flex-wrap items-center justify-center gap-3 bg-violet-700 px-4 py-2 text-xs font-semibold text-white text-center">
          <UserCog size={14} className="flex-shrink-0" />
          <span>
            Viewing as {user?.fullName} ({user?.role}) — impersonation session, expires automatically in 30 min.
          </span>
          <button
            type="button"
            onClick={handleStopImpersonating}
            className="rounded-md bg-white/15 px-2.5 py-1 hover:bg-white/25"
          >
            Stop impersonating
          </button>
        </div>
      )}
      <div
        className={
          (isCouncilRole ? 'relative flex flex-1 min-h-0 bg-[#150a26]' : 'relative flex flex-1 min-h-0 bg-slate-100')
        }
      >
      {isCouncilRole ? (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_85%,rgba(124,58,237,0.18),transparent_55%),radial-gradient(circle_at_80%_18%,rgba(249,115,22,0.12),transparent_40%)]" />
      ) : isAdmin ? (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_85%,rgba(244,63,94,0.10),transparent_55%),radial-gradient(circle_at_80%_18%,rgba(124,58,237,0.10),transparent_45%)]" />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_85%,rgba(124,58,237,0.06),transparent_55%),radial-gradient(circle_at_80%_18%,rgba(249,115,22,0.06),transparent_45%)]" />
      )}
      {/* Desktop sidebar */}
      <Sidebar className="hidden md:flex" />

      {/* Mobile: top bar + drawer sidebar */}
      <header className={`md:hidden fixed top-0 left-0 right-0 z-40 backdrop-blur border-b ${isCouncilRole || (!isAdmin && !isCouncilRole) ? 'bg-[#150a26]/90 border-white/10' : 'bg-white/80 border-slate-200'}`}>
        <div className="h-14 px-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className={`inline-flex items-center justify-center rounded-lg p-2 ${isCouncilRole || (!isAdmin && !isCouncilRole) ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <Logo theme={isAdmin ? 'light' : 'dark'} size="sm" />
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close menu overlay"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-[85vw] max-w-[22rem] rounded-r-2xl overflow-hidden shadow-2xl bg-white">
            <Sidebar mobile onClose={() => setMobileMenuOpen(false)} onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      <main
        id="main-content"
        className="relative flex-1 min-w-0 pt-14 md:pt-0 bg-slate-50 text-slate-900"
        tabIndex={-1}
      >
        <OfflineBanner />
        {children}
      </main>
      </div>
    </div>
  );
}

