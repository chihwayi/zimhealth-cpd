import { Sidebar } from './Sidebar';
import { OfflineBanner } from '../ui/OfflineBanner';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { Logo } from '../brand/Logo';

interface Props {
  children: ReactNode;
}

export function AppShell({ children }: Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const isCouncilRole = user?.role === 'NCZ_OFFICER' || user?.role === 'COUNCIL_OFFICER';
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className={isCouncilRole ? 'relative flex min-h-dvh bg-[#030c1a]' : 'relative flex min-h-dvh bg-slate-100'}>
      {isCouncilRole ? (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_85%,rgba(59,130,246,0.16),transparent_55%),radial-gradient(circle_at_80%_18%,rgba(251,191,36,0.10),transparent_40%)]" />
      ) : isAdmin ? (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_85%,rgba(244,63,94,0.10),transparent_55%),radial-gradient(circle_at_80%_18%,rgba(14,165,233,0.10),transparent_45%)]" />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_85%,rgba(59,130,246,0.08),transparent_55%),radial-gradient(circle_at_80%_18%,rgba(251,191,36,0.06),transparent_45%)]" />
      )}
      {/* Desktop sidebar */}
      <Sidebar className="hidden md:flex" />

      {/* Mobile: top bar + drawer sidebar */}
      <header className={`md:hidden fixed top-0 left-0 right-0 z-40 backdrop-blur border-b ${isCouncilRole || (!isAdmin && !isCouncilRole) ? 'bg-[#030c1a]/90 border-white/10' : 'bg-white/80 border-slate-200'}`}>
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
  );
}

