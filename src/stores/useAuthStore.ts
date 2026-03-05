// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Auth Store
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { UserProfile } from '@/types/user';

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  login: (user: UserProfile) => void;
  logout: () => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
}

export const useAuthStore = create<AuthState>()(
  immer((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,

    setUser: (user) =>
      set((state) => {
        state.user = user;
        state.isAuthenticated = user !== null;
        state.isLoading = false;
      }),

    setLoading: (loading) =>
      set((state) => {
        state.isLoading = loading;
      }),

    login: (user) =>
      set((state) => {
        state.user = user;
        state.isAuthenticated = true;
        state.isLoading = false;
      }),

    logout: () =>
      set((state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.isLoading = false;
      }),

    updateProfile: (updates) =>
      set((state) => {
        if (state.user) {
          Object.assign(state.user, updates);
        }
      }),
  }))
);
