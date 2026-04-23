import { create } from 'zustand';
import { storage } from '../lib/storage';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'CONTENT_MANAGER' | 'NCZ_OFFICER' | 'LEARNER';
  cadre: string | null;
  nczRegistrationNumber: string | null;
  subscriptionTier: string;
  subscriptionExpiresAt: string | null;
  avatarUrl: string | null;
  specialtyArea: string | null;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isBootstrapped: boolean;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => Promise<void>;
  clearAuth: () => Promise<void>;
  updateUser: (updates: Partial<AuthUser>) => void;
  bootstrap: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isBootstrapped: false,

  setAuth: async (user, accessToken, refreshToken) => {
    await Promise.all([
      storage.setItem('access_token', accessToken),
      storage.setItem('refresh_token', refreshToken),
      storage.setItem('auth_user', JSON.stringify(user)),
    ]);
    set({ user, accessToken });
  },

  clearAuth: async () => {
    await Promise.all([
      storage.removeItem('access_token'),
      storage.removeItem('refresh_token'),
      storage.removeItem('auth_user'),
    ]);
    set({ user: null, accessToken: null });
  },

  updateUser: (updates) => {
    const user = get().user;
    if (!user) return;
    const updated = { ...user, ...updates };
    set({ user: updated });
    void storage.setItem('auth_user', JSON.stringify(updated));
  },

  bootstrap: async () => {
    try {
      const [token, userStr] = await Promise.all([
        storage.getItem('access_token'),
        storage.getItem('auth_user'),
      ]);
      if (token && userStr) {
        set({ accessToken: token, user: JSON.parse(userStr) as AuthUser });
      }
    } finally {
      set({ isBootstrapped: true });
    }
  },
}));
