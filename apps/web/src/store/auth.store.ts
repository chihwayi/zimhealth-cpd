import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'CONTENT_MANAGER' | 'NCZ_OFFICER' | 'COUNCIL_OFFICER' | 'LEARNER';
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
    { name: 'zimhealth-auth' },
  ),
);
