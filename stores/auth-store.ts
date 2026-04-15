"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AuthUser } from "@/lib/types";

/**
 * Auth store — hanya menyimpan data user profile (bukan token)
 * Session/token dikelola sepenuhnya oleh Supabase (@supabase/ssr via cookies)
 * Store ini dipakai untuk akses cepat ke data profile di UI
 */
type AuthState = {
  user: AuthUser | null;
  setUser: (user: AuthUser) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      clearAuth: () => set({ user: null }),
    }),
    {
      name: "ldr-connect-user",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
