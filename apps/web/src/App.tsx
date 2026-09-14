import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, useEffect, useState } from 'react';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { Toaster } from './components/ui/Toast';
import { lazyWithReload } from './lib/lazyWithReload';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyCertificatePage from './pages/VerifyCertificate';
import ReportIssue from './pages/ReportIssue';
import { useAuthStore } from './store/auth.store';

// Lazy-load all portals. lazyWithReload (not React.lazy directly) auto-
// recovers from stale-chunk errors after a deploy — see lib/lazyWithReload.ts.
const LearnerDashboard = lazyWithReload(() => import('./pages/learner/Dashboard'));
const LearnerCourses = lazyWithReload(() => import('./pages/learner/Courses'));
const LearnerCoursePlayer = lazyWithReload(() => import('./pages/learner/CoursePlayer'));
const LearnerMyLearning = lazyWithReload(() => import('./pages/learner/MyLearning'));
const LearnerPoints = lazyWithReload(() => import('./pages/learner/Points'));
const LearnerCertificates = lazyWithReload(() => import('./pages/learner/Certificates'));
const LearnerProfile = lazyWithReload(() => import('./pages/learner/Profile'));
const LearnerSubscription = lazyWithReload(() => import('./pages/learner/Subscription'));
const AdminDashboard = lazyWithReload(() => import('./pages/admin/AdminDashboard'));
const CreatorDashboard = lazyWithReload(() => import('./pages/creator/CreatorDashboard'));
const CreatorCourses = lazyWithReload(() => import('./pages/creator/CreatorCourses'));
const CourseBuilder = lazyWithReload(() => import('./pages/creator/CourseBuilder'));
const QuizBuilder = lazyWithReload(() => import('./pages/creator/QuizBuilder'));
const CreatorAnalytics = lazyWithReload(() => import('./pages/creator/Analytics'));
const MediaLibrary = lazyWithReload(() => import('./pages/creator/MediaLibrary'));
const CouncilDashboard = lazyWithReload(() => import('./pages/council/CouncilDashboard'));
const Helpdesk = lazyWithReload(() => import('./pages/admin/Helpdesk'));
const InstitutionDashboard = lazyWithReload(() => import('./pages/institution/InstitutionDashboard'));

const Loader = () => (
  <main className="flex min-h-[50vh] flex-col items-center justify-center px-4" aria-busy="true">
    <h1 className="sr-only">Loading page</h1>
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" aria-hidden />
      <span className="sr-only">Loading content, please wait.</span>
    </div>
  </main>
);

export default function App() {
  const user = useAuthStore((state) => state.user);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/admin/config/public`)
      .then((res) => res.json())
      .then((data: { maintenanceMode?: boolean }) => setMaintenanceMode(Boolean(data.maintenanceMode)))
      .catch(() => setMaintenanceMode(false));
  }, []);

  if (maintenanceMode && user?.role !== 'ADMIN') {
    return (
      <>
        <Toaster />
        <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
            <h1 className="text-2xl font-bold text-slate-900">Scheduled Maintenance</h1>
            <p className="text-sm text-slate-500 mt-3">
              The CPD Hub is temporarily unavailable while system maintenance is in progress. Please check back shortly.
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
    <Toaster />
    <Suspense fallback={<Loader />}>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify/:uuid" element={<VerifyCertificatePage />} />
        <Route path="/" element={<Landing />} />

        <Route
          path="/report-issue"
          element={
            <ProtectedRoute allowedRoles={['LEARNER', 'CONTENT_MANAGER', 'NCZ_OFFICER', 'COUNCIL_OFFICER', 'ADMIN', 'HELPDESK']}>
              <AppShell>
                <ReportIssue />
              </AppShell>
            </ProtectedRoute>
          }
        />

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
            <ProtectedRoute allowedRoles={['LEARNER', 'CONTENT_MANAGER', 'ADMIN']}>
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
          path="/creator"
          element={
            <ProtectedRoute allowedRoles={['CONTENT_MANAGER', 'ADMIN']}>
              <AppShell>
                <CreatorDashboard />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/creator/courses"
          element={
            <ProtectedRoute allowedRoles={['CONTENT_MANAGER', 'ADMIN']}>
              <AppShell>
                <CreatorCourses />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/creator/courses/new"
          element={
            <ProtectedRoute allowedRoles={['CONTENT_MANAGER', 'ADMIN']}>
              <AppShell>
                <CourseBuilder />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/creator/courses/:id/edit"
          element={
            <ProtectedRoute allowedRoles={['CONTENT_MANAGER', 'ADMIN']}>
              <AppShell>
                <CourseBuilder />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/creator/analytics"
          element={
            <ProtectedRoute allowedRoles={['CONTENT_MANAGER', 'ADMIN']}>
              <AppShell>
                <CreatorAnalytics />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/creator/media"
          element={
            <ProtectedRoute allowedRoles={['CONTENT_MANAGER', 'ADMIN']}>
              <AppShell>
                <MediaLibrary />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/creator/quizzes/:id"
          element={
            <ProtectedRoute allowedRoles={['CONTENT_MANAGER', 'ADMIN']}>
              <AppShell>
                <QuizBuilder />
              </AppShell>
            </ProtectedRoute>
          }
        />

        {/* Council Portal (generic, council-scoped; UI reuses legacy portal) */}
        <Route
          path="/ncz/*"
          element={
            <ProtectedRoute allowedRoles={['NCZ_OFFICER', 'COUNCIL_OFFICER', 'ADMIN']}>
              <AppShell>
                <CouncilDashboard />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/council/*"
          element={
            <ProtectedRoute allowedRoles={['NCZ_OFFICER', 'COUNCIL_OFFICER', 'ADMIN']}>
              <AppShell>
                <CouncilDashboard />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/institution"
          element={
            <ProtectedRoute allowedRoles={['LEARNER', 'CONTENT_MANAGER', 'NCZ_OFFICER', 'COUNCIL_OFFICER', 'ADMIN']}>
              <AppShell>
                <InstitutionDashboard />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/helpdesk"
          element={
            <ProtectedRoute allowedRoles={['HELPDESK', 'ADMIN']}>
              <AppShell>
                <Helpdesk />
              </AppShell>
            </ProtectedRoute>
          }
        />

        {/* Backward-compatible redirect for old NCZ sync path */}
        <Route path="/admin/ncz-sync" element={<Navigate to="/admin/council-sync" replace />} />

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
    </>
  );
}
