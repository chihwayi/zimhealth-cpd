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

  // If the backend no longer recognises the user (common after DB reset/seed),
  // force a clean re-login instead of leaving the app in a broken state.
  if (res.status === 404 && path === '/api/auth/me') {
    useAuthStore.getState().clearAuth();
    if (window.location.pathname !== '/login') window.location.replace('/login');
    throw new Error('Session invalid');
  }

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
        useAuthStore.getState().setAuth(useAuthStore.getState().user!, newAccess, newRefresh);

        // Retry with new token
        headers['Authorization'] = `Bearer ${newAccess}`;
        const retryRes = await fetch(`${BASE_URL}${path}`, { ...options, headers });
        if (!retryRes.ok) throw new Error(`API error ${retryRes.status}`);
        return retryRes.json();
      }
    }

    useAuthStore.getState().clearAuth();
    if (window.location.pathname !== '/login') window.location.replace('/login');
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
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

