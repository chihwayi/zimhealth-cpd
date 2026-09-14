import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Role = 'PLATFORM_OWNER' | 'COUNTRY_ADMIN' | 'COUNCIL_OFFICER' | 'CONTENT_MANAGER' | 'LEARNER' | 'HELPDESK';

interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  subscriptionTier?: string;
  subscriptionExpiresAt?: string;
  avatarUrl?: string;
  councilId?: string | null;
  council?: {
    id: string;
    name: string;
    acronym: string;
    requiredPoints: number;
    renewalMonth?: number;
    renewalDay?: number;
    allowedTitles?: string[];
  } | null;
  countryCode?: string | null;
  professionalTitle?: string | null;
  registrationNumber?: string | null;
  nczRegistrationNumber?: string | null;
  cadre?: string | null;
  phone?: string | null;
  institution?: string | null;
  province?: string | null;
  district?: string | null;
  specialtyArea?: string | null;
}

interface StoredSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  // Set while impersonating a user — holds the Platform Owner's own session
  // so "stop impersonating" can restore it without a fresh login.
  ownerSession: StoredSession | null;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
  startImpersonation: (user: AuthUser, accessToken: string) => void;
  stopImpersonation: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      ownerSession: null,
      setAuth: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),
      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null, ownerSession: null }),
      updateUser: (updates) => set((s) => ({ user: s.user ? { ...s.user, ...updates } : null })),
      startImpersonation: (user, accessToken) => {
        const current = get();
        if (!current.user || !current.accessToken || !current.refreshToken) return;
        set({
          ownerSession: { user: current.user, accessToken: current.accessToken, refreshToken: current.refreshToken },
          user,
          accessToken,
          // No refresh token for an impersonation session — it expires in
          // 30 minutes and cannot be silently renewed.
          refreshToken: '',
        });
      },
      stopImpersonation: () => {
        const owner = get().ownerSession;
        if (!owner) return;
        set({ user: owner.user, accessToken: owner.accessToken, refreshToken: owner.refreshToken, ownerSession: null });
      },
    }),
    { name: 'zimhealth-auth' },
  ),
);
