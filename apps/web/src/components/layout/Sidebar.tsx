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
  Languages,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/auth.store';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { Logo } from '../brand/Logo';
import clsx from 'clsx';

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  i18nKey?: string;
}

const LEARNER_NAV: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', i18nKey: 'nav.dashboard' },
  { to: '/courses', icon: BookOpen, label: 'Browse Courses', i18nKey: 'nav.browseCourses' },
  { to: '/my-learning', icon: ClipboardList, label: 'My Learning', i18nKey: 'nav.myLearning' },
  { to: '/points', icon: Award, label: 'My Points', i18nKey: 'nav.myPoints' },
  { to: '/certificates', icon: FileCheck, label: 'Certificates', i18nKey: 'nav.certificates' },
  { to: '/subscription', icon: CreditCard, label: 'Subscription', i18nKey: 'nav.subscription' },
  { to: '/profile', icon: User, label: 'Profile', i18nKey: 'nav.profile' },
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
  { to: '/admin/languages', icon: Languages, label: 'Languages' },
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
  COUNCIL_OFFICER: COUNCIL_NAV,
  PLATFORM_OWNER: ADMIN_NAV,
  COUNTRY_ADMIN: ADMIN_NAV,
  HELPDESK: HELPDESK_NAV,
};

const ROLE_ACCENT: Record<string, string> = {
  LEARNER: 'border-primary-500',
  CONTENT_MANAGER: 'border-violet-500',
  COUNCIL_OFFICER: 'border-cyan-500',
  PLATFORM_OWNER: 'border-rose-600',
  COUNTRY_ADMIN: 'border-orange-500',
  HELPDESK: 'border-amber-500',
};

const ROLE_ACTIVE: Record<string, string> = {
  LEARNER: 'bg-white/10 text-white border-l-2 border-primary-400',
  CONTENT_MANAGER: 'bg-violet-50 text-violet-700 border-l-2 border-violet-500',
  COUNCIL_OFFICER: 'bg-white/10 text-white border-l-2 border-cyan-400',
  PLATFORM_OWNER: 'bg-rose-50 text-rose-700 border-l-2 border-rose-600',
  COUNTRY_ADMIN: 'bg-orange-50 text-orange-700 border-l-2 border-orange-500',
  HELPDESK: 'bg-amber-50 text-amber-700 border-l-2 border-amber-500',
};

const ROLE_AVATAR: Record<string, string> = {
  LEARNER: 'bg-primary-500/20 text-primary-300',
  CONTENT_MANAGER: 'bg-violet-100 text-violet-700',
  COUNCIL_OFFICER: 'bg-cyan-500/20 text-cyan-300',
  PLATFORM_OWNER: 'bg-rose-100 text-rose-700',
  COUNTRY_ADMIN: 'bg-orange-100 text-orange-700',
  HELPDESK: 'bg-amber-100 text-amber-700',
};

const ROLE_LABEL: Record<string, string> = {
  LEARNER: 'Learner',
  CONTENT_MANAGER: 'Course Creator',
  COUNCIL_OFFICER: 'Council Officer',
  PLATFORM_OWNER: 'Platform Owner',
  COUNTRY_ADMIN: 'Country Admin',
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
  const { t } = useTranslation();
  if (!user) return null;

  const baseNavItems = NAV_BY_ROLE[user.role] ?? LEARNER_NAV;
  const navItems: NavItem[] =
    user.role === 'HELPDESK'
      ? baseNavItems
      : [
          ...baseNavItems,
          { to: '/institution', icon: Building2, label: 'My Institution', i18nKey: 'nav.myInstitution' },
          { to: '/report-issue', icon: AlertTriangle, label: 'Report an issue', i18nKey: 'nav.reportIssue' },
        ];
  const isCouncilRole = user.role === 'COUNCIL_OFFICER';
  const isAdmin = user.role === 'PLATFORM_OWNER' || user.role === 'COUNTRY_ADMIN';

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
          ? 'bg-[#150a26] text-white'
          : isAdmin
            ? 'bg-gradient-to-b from-rose-50 via-white to-white text-slate-900'
            : 'bg-white text-slate-900',
        mobile ? (isDarkSidebar ? 'ring-1 ring-white/10' : 'ring-1 ring-slate-200') : isDarkSidebar ? '' : 'border-r border-slate-200',
        className,
      )}
    >
      {/* Subtle gradient overlay for dark sidebars */}
      {isDarkSidebar && (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(124,58,237,0.16),transparent_60%),radial-gradient(circle_at_80%_10%,rgba(249,115,22,0.08),transparent_40%)]" />
      )}

      {/* Logo + role accent */}
      <div className={clsx('relative px-5 py-5 border-b-4', ROLE_ACCENT[user.role])}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="min-w-0">
              <Logo theme={isDarkSidebar ? 'dark' : 'light'} size="sm" />
              <div className={clsx('text-xs mt-1.5 truncate', isDarkSidebar ? 'text-white/60' : 'text-slate-500')}>
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
        {navItems.map(({ to, icon: Icon, label, i18nKey }) => {
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
              {i18nKey ? t(i18nKey) : label}
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

        <div className="mt-3">
          <LanguageSwitcher dark={isDarkSidebar} />
        </div>

        <button
          type="button"
          onClick={() => {
            clearAuth();
            navigate('/login', { replace: true });
          }}
          className={clsx(
            'mt-2 w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
            isDarkSidebar
              ? 'border border-white/15 bg-white/8 text-white/80 hover:bg-white/15 hover:text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
          )}
        >
          <LogOut size={16} />
          {t('common.logout')}
        </button>
      </div>
    </aside>
  );
}
