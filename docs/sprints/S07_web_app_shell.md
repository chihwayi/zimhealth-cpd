# Sprint 07 — Web App Shell & Routing

**Phase:** 1 — Core Platform
**Duration:** 1 week
**Goal:** The authenticated app shell — sidebar, topbar, role-based routing, auth store, protected routes. After this sprint the full navigation skeleton works for all 4 roles.

---

## Tasks

### T07.1 — Auth store (Zustand)

CREATE FILE: `apps/web/src/store/auth.store.ts`
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'CONTENT_MANAGER' | 'NCZ_OFFICER' | 'LEARNER';
  subscriptionTier?: string;
  avatarUrl?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),
      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null }),
      updateUser: (updates) => set((s) => ({ user: s.user ? { ...s.user, ...updates } : null })),
    }),
    { name: 'nursepro-auth' },
  ),
);
```

---

### T07.2 — API client

CREATE FILE: `apps/web/src/lib/api.ts`
```typescript
import { useAuthStore } from '../store/auth.store';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    // Attempt token refresh
    const refreshToken = useAuthStore.getState().refreshToken;
    if (refreshToken) {
      const refreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (refreshRes.ok) {
        const { accessToken: newAccess, refreshToken: newRefresh } = await refreshRes.json();
        useAuthStore.getState().setAuth(
          useAuthStore.getState().user!,
          newAccess,
          newRefresh,
        );
        // Retry with new token
        headers['Authorization'] = `Bearer ${newAccess}`;
        const retryRes = await fetch(`${BASE_URL}${path}`, { ...options, headers });
        if (!retryRes.ok) throw new Error(`API error ${retryRes.status}`);
        return retryRes.json();
      }
    }
    useAuthStore.getState().clearAuth();
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `API error ${res.status}`);
  }

  if (res.status === 204) return {} as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
```

---

### T07.3 — Route guard component

CREATE FILE: `apps/web/src/components/layout/ProtectedRoute.tsx`
```tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';

interface Props {
  children: React.ReactNode;
  allowedRoles: string[];
}

export function ProtectedRoute({ children, allowedRoles }: Props) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    // Redirect to the user's home portal
    const homeMap: Record<string, string> = {
      ADMIN: '/admin',
      CONTENT_MANAGER: '/creator',
      NCZ_OFFICER: '/ncz',
      LEARNER: '/dashboard',
    };
    return <Navigate to={homeMap[user.role] ?? '/'} replace />;
  }

  return <>{children}</>;
}
```

---

### T07.4 — Sidebar navigation component

CREATE FILE: `apps/web/src/components/layout/Sidebar.tsx`
```tsx
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, Award, FileCheck, User,
  BarChart2, Settings, Users, RefreshCw, ClipboardList,
  CreditCard, ShieldAlert,
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
```

---

### T07.5 — App shell

CREATE FILE: `apps/web/src/components/layout/AppShell.tsx`
```tsx
import { Sidebar } from './Sidebar';

interface Props { children: React.ReactNode }

export function AppShell({ children }: Props) {
  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
```

---

### T07.6 — Login page

CREATE FILE: `apps/web/src/pages/Login.tsx`
```tsx
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { api } from '../lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname ?? '/';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ user: any; accessToken: string; refreshToken: string }>('/api/auth/login', { email, password });
      setAuth(res.user, res.accessToken, res.refreshToken);
      const roleRedirect: Record<string, string> = {
        ADMIN: '/admin', CONTENT_MANAGER: '/creator', NCZ_OFFICER: '/ncz', LEARNER: '/dashboard',
      };
      navigate(from === '/' ? (roleRedirect[res.user.role] ?? '/dashboard') : from, { replace: true });
    } catch (err: any) {
      setError(err.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">NursePro CPD</h1>
          <p className="text-slate-500 mt-2">Sign in to continue learning</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="w-full bg-primary-500 text-white font-semibold py-2.5 rounded-lg hover:bg-primary-600 disabled:opacity-40 transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="text-center text-sm text-slate-500 mt-6">
            Don't have an account? <a href="/register" className="text-primary-600 hover:underline">Register</a>
          </p>
        </div>
      </div>
    </div>
  );
}
```

---

### T07.7 — Update App.tsx with full routing

EDIT FILE: `apps/web/src/App.tsx`
Replace with:
```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import Login from './pages/Login';

// Lazy-load all portals
const LearnerDashboard = lazy(() => import('./pages/learner/Dashboard'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const CreatorDashboard = lazy(() => import('./pages/creator/CreatorDashboard'));
const NczDashboard = lazy(() => import('./pages/ncz/NczDashboard'));

const Loader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

export default function App() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Learner */}
        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={['LEARNER']}>
            <AppShell><LearnerDashboard /></AppShell>
          </ProtectedRoute>
        } />

        {/* Creator */}
        <Route path="/creator/*" element={
          <ProtectedRoute allowedRoles={['CONTENT_MANAGER']}>
            <AppShell><CreatorDashboard /></AppShell>
          </ProtectedRoute>
        } />

        {/* NCZ */}
        <Route path="/ncz/*" element={
          <ProtectedRoute allowedRoles={['NCZ_OFFICER']}>
            <AppShell><NczDashboard /></AppShell>
          </ProtectedRoute>
        } />

        {/* Admin */}
        <Route path="/admin/*" element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AppShell><AdminDashboard /></AppShell>
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
```

---

### T07.8 — Create placeholder page stubs

Each of these files should be a minimal placeholder that renders role+page name. The AI assistant building this must create all 4 files:

CREATE FILE: `apps/web/src/pages/learner/Dashboard.tsx`
```tsx
export default function LearnerDashboard() {
  return <div className="p-8"><h1 className="text-2xl font-bold text-slate-900">Learner Dashboard</h1><p className="text-slate-500 mt-2">Sprint 08 will build this page.</p></div>;
}
```

CREATE FILE: `apps/web/src/pages/creator/CreatorDashboard.tsx`
```tsx
export default function CreatorDashboard() {
  return <div className="p-8"><h1 className="text-2xl font-bold text-slate-900">Creator Portal</h1><p className="text-slate-500 mt-2">Sprint 16 will build this page.</p></div>;
}
```

CREATE FILE: `apps/web/src/pages/ncz/NczDashboard.tsx`
```tsx
export default function NczDashboard() {
  return <div className="p-8"><h1 className="text-2xl font-bold text-slate-900">NCZ Portal</h1><p className="text-slate-500 mt-2">Sprint 19 will build this page.</p></div>;
}
```

CREATE FILE: `apps/web/src/pages/admin/AdminDashboard.tsx`
```tsx
export default function AdminDashboard() {
  return <div className="p-8"><h1 className="text-2xl font-bold text-slate-900">Admin Portal</h1><p className="text-slate-500 mt-2">Sprint 21 will build this page.</p></div>;
}
```

---

## Validation Checklist

- [ ] Login page renders at `/login`
- [ ] Logging in as `grace@nursepro.co.zw` redirects to `/dashboard` with Learner sidebar
- [ ] Logging in as `admin@nursepro.co.zw` redirects to `/admin` with Admin sidebar (rose accent)
- [ ] Logging in as `creator@nursepro.co.zw` redirects to `/creator` with violet accent sidebar
- [ ] Logging in as NCZ officer redirects to `/ncz` with blue accent sidebar
- [ ] Accessing `/admin` without auth redirects to `/login`
- [ ] Learner accessing `/admin` is redirected to `/dashboard`
- [ ] Auth token persists across page refresh (Zustand persist)
- [ ] No TypeScript errors: `pnpm type-check`

**Sign-off:** Claude Code tests all 4 role logins and redirect behaviour before S08 begins.
