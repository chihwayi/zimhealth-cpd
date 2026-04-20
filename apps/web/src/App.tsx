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
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['LEARNER']}>
              <AppShell>
                <LearnerDashboard />
              </AppShell>
            </ProtectedRoute>
          }
        />

        {/* Creator */}
        <Route
          path="/creator/*"
          element={
            <ProtectedRoute allowedRoles={['CONTENT_MANAGER']}>
              <AppShell>
                <CreatorDashboard />
              </AppShell>
            </ProtectedRoute>
          }
        />

        {/* NCZ */}
        <Route
          path="/ncz/*"
          element={
            <ProtectedRoute allowedRoles={['NCZ_OFFICER']}>
              <AppShell>
                <NczDashboard />
              </AppShell>
            </ProtectedRoute>
          }
        />

        {/* Admin */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AppShell>
                <AdminDashboard />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}

