import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Award,
  FileCheck,
  User,
  BarChart2,
  Settings,
  Building2,
  BadgeCheck,
  Users,
  RefreshCw,
  ClipboardList,
  CreditCard,
  ShieldAlert,
  Wand2,
  X,
  LogOut,
  AlertTriangle,
  MessageSquareWarning,
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
  { to: '/admin/creator-approvals', icon: BadgeCheck, label: 'Creator Approvals' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/courses', icon: BookOpen, label: 'Course Approvals' },
  { to: '/admin/guidelines', icon: Wand2, label: 'Guideline Lab' },
  { to: '/admin/analytics', icon: BarChart2, label: 'Analytics' },
  { to: '/admin/payments', icon: CreditCard, label: 'Payments' },
  { to: '/admin/council-sync', icon: RefreshCw, label: 'Council Sync' },
  { to: '/admin/audit', icon: ShieldAlert, label: 'Audit Log' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

const HELPDESK_NAV = [
  { to: '/helpdesk', icon: MessageSquareWarning, label: 'Issue Reports' },
];

const NAV_BY_ROLE: Record<string, typeof LEARNER_NAV> = {
  LEARNER: LEARNER_NAV,
  CONTENT_MANAGER: CREATOR_NAV,
  NCZ_OFFICER: COUNCIL_NAV,
  COUNCIL_OFFICER: COUNCIL_NAV,
  ADMIN: ADMIN_NAV,
  HELPDESK: HELPDESK_NAV,
};

const ROLE_ACCENT: Record<string, string> = {
  LEARNER: 'border-primary-500',
  CONTENT_MANAGER: 'border-violet-500',
  NCZ_OFFICER: 'border-blue-500',
  COUNCIL_OFFICER: 'border-blue-500',
  ADMIN: 'border-rose-600',
  HELPDESK: 'border-amber-500',
};

const ROLE_ACTIVE: Record<string, string> = {
  LEARNER: 'bg-white/10 text-white border-l-2 border-primary-400',
  CONTENT_MANAGER: 'bg-violet-50 text-violet-700 border-l-2 border-violet-500',
  NCZ_OFFICER: 'bg-white/10 text-white border-l-2 border-blue-400',
  COUNCIL_OFFICER: 'bg-white/10 text-white border-l-2 border-blue-400',
  ADMIN: 'bg-rose-50 text-rose-700 border-l-2 border-rose-600',
  HELPDESK: 'bg-amber-50 text-amber-700 border-l-2 border-amber-500',
};

const ROLE_AVATAR: Record<string, string> = {
  LEARNER: 'bg-primary-500/20 text-primary-300',
  CONTENT_MANAGER: 'bg-violet-100 text-violet-700',
  NCZ_OFFICER: 'bg-blue-500/20 text-blue-300',
  COUNCIL_OFFICER: 'bg-blue-500/20 text-blue-300',
  ADMIN: 'bg-rose-100 text-rose-700',
  HELPDESK: 'bg-amber-100 text-amber-700',
};

const ROLE_LABEL: Record<string, string> = {
  LEARNER: 'Learner',
  CONTENT_MANAGER: 'Course Creator',
  NCZ_OFFICER: 'Council Officer',
  COUNCIL_OFFICER: 'Council Officer',
  ADMIN: 'System Admin',
  HELPDESK: 'Helpdesk',
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
  const navigate = useNavigate();
  if (!user) return null;

  const baseNavItems = NAV_BY_ROLE[user.role] ?? LEARNER_NAV;
  const navItems =
    user.role === 'HELPDESK'
      ? baseNavItems
      : [
          ...baseNavItems,
          { to: '/institution', icon: Building2, label: 'My Institution' },
          { to: '/report-issue', icon: AlertTriangle, label: 'Report an issue' },
        ];
  const isCouncilRole = user.role === 'NCZ_OFFICER' || user.role === 'COUNCIL_OFFICER';
  const isAdmin = user.role === 'ADMIN';

  const isDarkSidebar = isCouncilRole || user.role === 'LEARNER';

  const isActiveLink = (to: string) => {
    const isRoleRoot =
      to === '/dashboard' || to === '/creator' || to === '/ncz' || to === '/council' || to === '/admin';
    if (isRoleRoot) return pathname === to;
    return pathname === to || pathname.startsWith(`${to}/`);
  };

  return (
    <aside
      className={clsx(
        'relative w-72 sm:w-80 md:w-60 flex-shrink-0 min-h-dvh flex flex-col',
        isDarkSidebar
          ? 'bg-[#030c1a] text-white'
          : isAdmin
            ? 'bg-gradient-to-b from-rose-50 via-white to-white text-slate-900'
            : 'bg-white text-slate-900',
        mobile ? (isDarkSidebar ? 'ring-1 ring-white/10' : 'ring-1 ring-slate-200') : isDarkSidebar ? '' : 'border-r border-slate-200',
        className,
      )}
    >
      {/* Subtle gradient overlay for dark sidebars */}
      {isDarkSidebar && (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(59,130,246,0.12),transparent_60%),radial-gradient(circle_at_80%_10%,rgba(251,191,36,0.06),transparent_40%)]" />
      )}

      {/* Logo + role accent */}
      <div className={clsx('relative px-5 py-5 border-b-4', ROLE_ACCENT[user.role])}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="min-w-0">
              <img
                src="/brand-zimhealthcpd.png"
                alt="ZimHealth CPD"
                className={clsx(
                  'h-9 w-auto max-w-[160px] object-contain',
                  isDarkSidebar ? 'brightness-110' : '',
                )}
              />
              <div className={clsx('text-xs mt-0.5 truncate', isDarkSidebar ? 'text-white/60' : 'text-slate-500')}>
                {ROLE_LABEL[user.role]}
              </div>
            </div>
          </div>
          {mobile && (
            <button
              type="button"
              onClick={onClose}
              className={clsx(
                'md:hidden inline-flex items-center justify-center rounded-lg p-2',
                isDarkSidebar ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
              )}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Nav items */}
      <nav className="relative flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
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
                  ? clsx(ROLE_ACTIVE[user.role], 'font-semibold')
                  : isDarkSidebar
                    ? 'text-white/65 hover:bg-white/10 hover:text-white'
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
      <div className={clsx('relative px-4 py-4', isDarkSidebar ? 'border-t border-white/10' : 'border-t border-slate-200')}>
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              'w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm',
              ROLE_AVATAR[user.role] ?? ROLE_AVATAR.LEARNER,
            )}
          >
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className={clsx('text-sm font-semibold truncate', isDarkSidebar ? 'text-white' : 'text-slate-900')}>
              {user.fullName}
            </div>
            <div className={clsx('text-xs truncate', isDarkSidebar ? 'text-white/55' : 'text-slate-500')}>{user.email}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            clearAuth();
            navigate('/login', { replace: true });
          }}
          className={clsx(
            'mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
            isDarkSidebar
              ? 'border border-white/15 bg-white/8 text-white/80 hover:bg-white/15 hover:text-white'
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
