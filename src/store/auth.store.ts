import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  plan: "free" | "pro" | "family";
}

interface AuthState {
  accessToken: string | null;
  refreshTokenValue: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;

  setSession: (params: { accessToken: string; refreshToken: string | null; user: AuthUser }) => void;
  setAccessToken: (accessToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshTokenValue: null,
      user: null,
      isAuthenticated: false,

      setSession: ({ accessToken, refreshToken, user }) =>
        set({
          accessToken,
          refreshTokenValue: refreshToken ?? null,
          user,
          isAuthenticated: true,
        }),

      setAccessToken: (accessToken) => set({ accessToken }),

      logout: () =>
        set({
          accessToken: null,
          refreshTokenValue: null,
          user: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: "vault-auth",
      partialize: (state) => ({
        refreshTokenValue: state.refreshTokenValue,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
