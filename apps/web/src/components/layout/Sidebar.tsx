import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Award,
  FileCheck,
  User,
  BarChart2,
  Settings,
  Users,
  RefreshCw,
  ClipboardList,
  CreditCard,
  ShieldAlert,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import clsx from 'clsx';

const LEARNER_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/courses', icon: BookOpen, label: 'Browse Courses' },
  { to: '/my-learning', icon: ClipboardList, label: 'My Learning' },
  { to: '/points', icon: Award, label: 'My Points' },
  { to: '/certificates', icon: FileCheck, label: 'Certificates' },
  { to: '/profile', icon: User, label: 'Profile' },
];

const CREATOR_NAV = [
  { to: '/creator', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/creator/courses', icon: BookOpen, label: 'My Courses' },
  { to: '/creator/analytics', icon: BarChart2, label: 'Analytics' },
  { to: '/creator/media', icon: FileCheck, label: 'Media Library' },
];

const NCZ_NAV = [
  { to: '/ncz', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/ncz/search', icon: Users, label: 'Learner Search' },
  { to: '/ncz/reports', icon: BarChart2, label: 'Reports' },
  { to: '/ncz/sync', icon: RefreshCw, label: 'Sync Status' },
];

const ADMIN_NAV = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/courses', icon: BookOpen, label: 'Course Approvals' },
  { to: '/admin/analytics', icon: BarChart2, label: 'Analytics' },
  { to: '/admin/payments', icon: CreditCard, label: 'Payments' },
  { to: '/admin/ncz-sync', icon: RefreshCw, label: 'NCZ Sync' },
  { to: '/admin/audit', icon: ShieldAlert, label: 'Audit Log' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

const NAV_BY_ROLE: Record<string, typeof LEARNER_NAV> = {
  LEARNER: LEARNER_NAV,
  CONTENT_MANAGER: CREATOR_NAV,
  NCZ_OFFICER: NCZ_NAV,
  ADMIN: ADMIN_NAV,
};

const ROLE_ACCENT: Record<string, string> = {
  LEARNER: 'border-primary-500',
  CONTENT_MANAGER: 'border-violet-500',
  NCZ_OFFICER: 'border-blue-600',
  ADMIN: 'border-rose-600',
};

const ROLE_LABEL: Record<string, string> = {
  LEARNER: 'Learner',
  CONTENT_MANAGER: 'Course Creator',
  NCZ_OFFICER: 'NCZ Officer',
  ADMIN: 'System Admin',
};

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const { pathname } = useLocation();
  if (!user) return null;

  const navItems = NAV_BY_ROLE[user.role] ?? LEARNER_NAV;

  return (
    <aside className="w-60 flex-shrink-0 bg-white border-r border-slate-200 h-screen sticky top-0 flex flex-col">
      {/* Logo + role accent */}
      <div className={clsx('px-5 py-5 border-b-4', ROLE_ACCENT[user.role])}>
        <div className="font-bold text-lg text-slate-900 tracking-tight">NursePro CPD</div>
        <div className="text-xs text-slate-500 mt-0.5">{ROLE_LABEL[user.role]}</div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = pathname === to || pathname.startsWith(to + '/');
          return (
            <Link
              key={to}
              to={to}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150',
                active
                  ? 'bg-primary-50 text-primary-700 font-medium border-l-2 border-primary-500'
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
      <div className="px-4 py-4 border-t border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm">
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-900 truncate">{user.fullName}</div>
            <div className="text-xs text-slate-500 truncate">{user.email}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

