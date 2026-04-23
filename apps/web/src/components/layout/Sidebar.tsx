import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Award,
  FileCheck,
  User,
  BarChart2,
  Settings,
  Building2,
  Users,
  RefreshCw,
  ClipboardList,
  CreditCard,
  ShieldAlert,
  Wand2,
  X,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import clsx from 'clsx';

const LEARNER_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/courses', icon: BookOpen, label: 'Browse Courses' },
  { to: '/my-learning', icon: ClipboardList, label: 'My Learning' },
  { to: '/points', icon: Award, label: 'My Points' },
  { to: '/certificates', icon: FileCheck, label: 'Certificates' },
  { to: '/subscription', icon: CreditCard, label: 'Subscription' },
  { to: '/profile', icon: User, label: 'Profile' },
];

const CREATOR_NAV = [
  { to: '/creator', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/creator/courses', icon: BookOpen, label: 'My Courses' },
  { to: '/creator/analytics', icon: BarChart2, label: 'Analytics' },
  { to: '/creator/media', icon: FileCheck, label: 'Media Library' },
];

const COUNCIL_NAV = [
  { to: '/council', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/council/search', icon: Users, label: 'Learner Search' },
  { to: '/council/reports', icon: BarChart2, label: 'Reports' },
  { to: '/council/sync', icon: RefreshCw, label: 'Sync Status' },
  { to: '/council/settings', icon: Settings, label: 'Council Settings' },
];

const ADMIN_NAV = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/councils', icon: Building2, label: 'Councils' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/courses', icon: BookOpen, label: 'Course Approvals' },
  { to: '/admin/guidelines', icon: Wand2, label: 'Guideline Lab' },
  { to: '/admin/analytics', icon: BarChart2, label: 'Analytics' },
  { to: '/admin/payments', icon: CreditCard, label: 'Payments' },
  { to: '/admin/ncz-sync', icon: RefreshCw, label: 'Council Sync' },
  { to: '/admin/audit', icon: ShieldAlert, label: 'Audit Log' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

const NAV_BY_ROLE: Record<string, typeof LEARNER_NAV> = {
  LEARNER: LEARNER_NAV,
  CONTENT_MANAGER: CREATOR_NAV,
  NCZ_OFFICER: COUNCIL_NAV,
  COUNCIL_OFFICER: COUNCIL_NAV,
  ADMIN: ADMIN_NAV,
};

const ROLE_ACCENT: Record<string, string> = {
  LEARNER: 'border-primary-500',
  CONTENT_MANAGER: 'border-violet-500',
  NCZ_OFFICER: 'border-blue-600',
  COUNCIL_OFFICER: 'border-blue-600',
  ADMIN: 'border-rose-600',
};

const ROLE_ACTIVE: Record<string, string> = {
  LEARNER: 'bg-primary-50 text-primary-700 border-l-2 border-primary-500',
  CONTENT_MANAGER: 'bg-violet-50 text-violet-700 border-l-2 border-violet-500',
  NCZ_OFFICER: 'bg-blue-50 text-blue-700 border-l-2 border-blue-600',
  COUNCIL_OFFICER: 'bg-blue-50 text-blue-700 border-l-2 border-blue-600',
  ADMIN: 'bg-rose-50 text-rose-700 border-l-2 border-rose-600',
};

const ROLE_AVATAR: Record<string, string> = {
  LEARNER: 'bg-primary-100 text-primary-700',
  CONTENT_MANAGER: 'bg-violet-100 text-violet-700',
  NCZ_OFFICER: 'bg-blue-100 text-blue-700',
  COUNCIL_OFFICER: 'bg-blue-100 text-blue-700',
  ADMIN: 'bg-rose-100 text-rose-700',
};

const ROLE_LABEL: Record<string, string> = {
  LEARNER: 'Learner',
  CONTENT_MANAGER: 'Course Creator',
  NCZ_OFFICER: 'Council Officer',
  COUNCIL_OFFICER: 'Council Officer',
  ADMIN: 'System Admin',
};

interface SidebarProps {
  className?: string;
  mobile?: boolean;
  onNavigate?: () => void;
  onClose?: () => void;
}

export function Sidebar({ className, mobile = false, onNavigate, onClose }: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { pathname } = useLocation();
  if (!user) return null;

  const navItems = NAV_BY_ROLE[user.role] ?? LEARNER_NAV;
  const isCouncilRole = user.role === 'NCZ_OFFICER' || user.role === 'COUNCIL_OFFICER';
  const isAdmin = user.role === 'ADMIN';

  const isActiveLink = (to: string) => {
    const isRoleRoot =
      to === '/dashboard' || to === '/creator' || to === '/ncz' || to === '/council' || to === '/admin';
    if (isRoleRoot) return pathname === to;
    return pathname === to || pathname.startsWith(`${to}/`);
  };

  return (
    <aside
      className={clsx(
        // Let the sidebar stretch with page height (no sticky).
        'w-72 sm:w-80 md:w-60 flex-shrink-0 min-h-dvh flex flex-col',
        isCouncilRole
          ? 'bg-[#071510] text-white'
          : isAdmin
            ? 'bg-gradient-to-b from-rose-50 via-white to-white text-slate-900'
            : 'bg-white text-slate-900',
        mobile ? (isCouncilRole ? 'ring-1 ring-white/10' : 'ring-1 ring-slate-200') : isCouncilRole ? '' : 'border-r border-slate-200',
        className,
      )}
    >
      {/* Logo + role accent */}
      <div className={clsx('px-5 py-5 border-b-4', ROLE_ACCENT[user.role])}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <img
              src="/logo.png"
              alt="ZimHealth CPD"
              className={clsx(
                'h-10 w-10 rounded-2xl object-cover bg-white flex-shrink-0',
                isCouncilRole ? 'ring-1 ring-white/15' : 'ring-1 ring-slate-200',
              )}
            />
            <div className="min-w-0">
              <div className={clsx('font-bold text-lg tracking-tight truncate', isCouncilRole ? 'text-white' : 'text-slate-900')}>
                ZimHealth CPD
              </div>
              <div className={clsx('text-xs mt-0.5 truncate', isCouncilRole ? 'text-white/70' : 'text-slate-500')}>
                {ROLE_LABEL[user.role]}
              </div>
            </div>
          </div>
          {mobile && (
            <button
              type="button"
              onClick={onClose}
              className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-white/60 hover:text-slate-900"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Nav items */}
      <nav className={clsx('flex-1 px-3 py-4 space-y-0.5', isCouncilRole ? 'overflow-y-auto' : 'overflow-visible')}>
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = isActiveLink(to);
          return (
            <Link
              key={to}
              to={to}
              onClick={onNavigate}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150',
                active
                  ? clsx(ROLE_ACTIVE[user.role], 'font-medium')
                  : isCouncilRole
                    ? 'text-white/75 hover:bg-white/10 hover:text-white'
                    : isAdmin
                      ? 'text-slate-700 hover:bg-rose-100/70 hover:text-rose-900'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User card at bottom */}
      <div className={clsx('px-4 py-4', isCouncilRole ? 'border-t border-white/10' : 'border-t border-slate-200')}>
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              'w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm',
              ROLE_AVATAR[user.role] ?? ROLE_AVATAR.LEARNER,
            )}
          >
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className={clsx('text-sm font-medium truncate', isCouncilRole ? 'text-white' : 'text-slate-900')}>
              {user.fullName}
            </div>
            <div className={clsx('text-xs truncate', isCouncilRole ? 'text-white/70' : 'text-slate-500')}>{user.email}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            clearAuth();
            window.location.href = '/login';
          }}
          className={clsx(
            'mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold',
            isCouncilRole
              ? 'border border-white/15 bg-white/10 text-white hover:bg-white/15'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
          )}
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
}
