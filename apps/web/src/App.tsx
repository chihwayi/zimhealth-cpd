import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import Login from './pages/Login';

// Lazy-load all portals
const LearnerDashboard = lazy(() => import('./pages/learner/Dashboard'));
const LearnerCourses = lazy(() => import('./pages/learner/Courses'));
const LearnerCoursePlayer = lazy(() => import('./pages/learner/CoursePlayer'));
const LearnerMyLearning = lazy(() => import('./pages/learner/MyLearning'));
const LearnerPoints = lazy(() => import('./pages/learner/Points'));
const LearnerCertificates = lazy(() => import('./pages/learner/Certificates'));
const LearnerProfile = lazy(() => import('./pages/learner/Profile'));
const LearnerSubscription = lazy(() => import('./pages/learner/Subscription'));
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
        <Route
          path="/courses"
          element={
            <ProtectedRoute allowedRoles={['LEARNER']}>
              <AppShell>
                <LearnerCourses />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/courses/:id"
          element={
            <ProtectedRoute allowedRoles={['LEARNER']}>
              <AppShell>
                <LearnerCoursePlayer />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-learning"
          element={
            <ProtectedRoute allowedRoles={['LEARNER']}>
              <AppShell>
                <LearnerMyLearning />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/points"
          element={
            <ProtectedRoute allowedRoles={['LEARNER']}>
              <AppShell>
                <LearnerPoints />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/certificates"
          element={
            <ProtectedRoute allowedRoles={['LEARNER']}>
              <AppShell>
                <LearnerCertificates />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute allowedRoles={['LEARNER']}>
              <AppShell>
                <LearnerProfile />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/subscription"
          element={
            <ProtectedRoute allowedRoles={['LEARNER']}>
              <AppShell>
                <LearnerSubscription />
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

