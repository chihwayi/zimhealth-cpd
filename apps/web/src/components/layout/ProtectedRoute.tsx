import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
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

