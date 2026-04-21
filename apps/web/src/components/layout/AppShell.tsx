import { Sidebar } from './Sidebar';
import { OfflineBanner } from '../ui/OfflineBanner';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface Props {
  children: ReactNode;
}

export function AppShell({ children }: Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh bg-slate-50">
      {/* Desktop sidebar */}
      <Sidebar className="hidden md:flex" />

      {/* Mobile: top bar + drawer sidebar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="h-14 px-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <div className="font-semibold text-slate-900 truncate">NursePro CPD</div>
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

      <main id="main-content" className="flex-1 overflow-y-auto pt-14 md:pt-0" tabIndex={-1}>
        <OfflineBanner />
        {children}
      </main>
    </div>
  );
}

