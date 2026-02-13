import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  userId: string;
  username: string;
  role: 'admin' | 'server' | 'servent';
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setAuth: (user) =>
        set({
          user,
          isAuthenticated: true,
        }),
      clearAuth: () =>
        set({
          user: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'auth-storage',
      version: 2,
      migrate: (persistedState) => {
        const state = persistedState as { user?: User | null; isAuthenticated?: boolean } | undefined;
        return {
          user: state?.user ?? null,
          isAuthenticated: state?.isAuthenticated ?? false,
        };
      },
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
