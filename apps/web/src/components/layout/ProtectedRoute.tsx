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
      PLATFORM_OWNER: '/admin',
      COUNTRY_ADMIN: '/admin',
      CONTENT_MANAGER: '/creator',
      COUNCIL_OFFICER: '/council',
      LEARNER: '/dashboard',
      HELPDESK: '/helpdesk',
    };
    return <Navigate to={homeMap[user.role] ?? '/'} replace />;
  }

  return <>{children}</>;
}

