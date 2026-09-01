"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AuthUser } from "@/lib/types";

/**
 * Auth store — hanya menyimpan data user profile (bukan token)
 * Session/token dikelola sepenuhnya oleh Supabase (@supabase/ssr via cookies)
 * Store ini dipakai untuk akses cepat ke data profile di UI
 * 
 * ⚠️ SECURITY WARNING:
 * Properti 'user.wallet_balance' di store ini hanya berfungsi untuk tampilan (display-only).
 * Nilai ini disimpan di localStorage dan rentan dimanipulasi di sisi client.
 * JANGAN PERNAH menggunakan saldo di store ini untuk validasi transaksi/game di client.
 * Selalu fetch dari '/api/coin/balance' atau gunakan hook 'useServerBalance' untuk data yang valid.
 */
type AuthState = {
  user: AuthUser | null;
  setUser: (user: AuthUser) => void;
  setWalletBalance: (balance: number) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      setWalletBalance: (balance) =>
        set((state) => (state.user ? { user: { ...state.user, wallet_balance: balance } } : state)),
      clearAuth: () => set({ user: null }),
    }),
    {
      name: "ldr-connect-user",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
