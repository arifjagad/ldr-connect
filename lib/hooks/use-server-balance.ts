"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";

/**
 * Hook untuk mendapatkan saldo coin dari server.
 *
 * Strategi fetch (hemat request):
 * - Fetch 1x saat mount (jika user sudah login)
 * - Refetch saat window focus, TAPI hanya jika sejak fetch terakhir
 *   sudah > MIN_REFETCH_MS (60 detik). Mencegah spam saat user
 *   alt-tab cepat atau banyak tab login sekaligus.
 * - TIDAK ada polling interval — balance hanya berubah saat user
 *   melakukan transaksi; halaman Coin menangani refresh sendiri.
 *
 * Sebelumnya: setInterval(30s) × n-tab = n × 2 request/menit — boros.
 */

const MIN_REFETCH_MS = 60_000; // minimum jeda antar refetch via focus

/**
 * Custom event name untuk dispatch update saldo coin ke seluruh komponen
 */
export const COIN_BALANCE_UPDATED_EVENT = "coin:balance_updated";

export function emitCoinBalanceUpdated(newBalance?: number) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(COIN_BALANCE_UPDATED_EVENT, { detail: { balance: newBalance } })
    );
  }
}

export function useServerBalance() {
  const { user, setWalletBalance } = useAuthStore();
  // Gunakan wallet_balance dari store sebagai nilai awal agar tidak ada flash loading
  const [balance, setBalance] = useState<number | null>(user?.wallet_balance ?? null);
  const [loading, setLoading]  = useState(balance === null);
  const [error, setError]      = useState<string | null>(null);

  const lastFetchRef = useRef<number>(0);

  const fetchBalance = useCallback(async (force = false) => {
    const now = Date.now();
    // Debounce: skip jika baru saja fetch (kecuali dipaksa)
    if (!force && now - lastFetchRef.current < MIN_REFETCH_MS) return;
    lastFetchRef.current = now;

    try {
      const res = await fetch("/api/coin/balance");
      if (!res.ok) throw new Error("Gagal mengambil saldo dari server");
      const json = await res.json();
      if (json?.success) {
        const bal = json.data.wallet.balance;
        setBalance(bal);
        setWalletBalance(bal);
        setError(null);
      } else {
        throw new Error(json?.message || "Format respons tidak valid");
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, [setWalletBalance]);

  useEffect(() => {
    if (!user) {
      setBalance(null);
      setLoading(false);
      return;
    }

    // Fetch pertama kali (force = true, abaikan debounce)
    fetchBalance(true);

    // Refetch saat tab kembali aktif — tapi hanya jika jeda sudah cukup
    const handleFocus = () => fetchBalance(false);
    window.addEventListener("focus", handleFocus);

    // Listen balance updated custom event
    const handleBalanceEvent = (e: Event) => {
      const customEvt = e as CustomEvent<{ balance?: number }>;
      if (typeof customEvt.detail?.balance === "number") {
        setBalance(customEvt.detail.balance);
        setWalletBalance(customEvt.detail.balance);
      } else {
        fetchBalance(true);
      }
    };
    window.addEventListener(COIN_BALANCE_UPDATED_EVENT, handleBalanceEvent);

    // Supabase Realtime: subscribe to wallet balance changes for this user
    const supabase = createClient();
    const walletChannel = supabase
      .channel(`wallet-balance-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wallets",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newWallet = payload.new as { balance?: number } | null;
          if (typeof newWallet?.balance === "number") {
            setBalance(newWallet.balance);
            setWalletBalance(newWallet.balance);
          } else {
            fetchBalance(true);
          }
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(COIN_BALANCE_UPDATED_EVENT, handleBalanceEvent);
      supabase.removeChannel(walletChannel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // hanya re-run jika user ganti (login/logout), bukan setiap render

  return { balance, loading, error, refresh: () => fetchBalance(true) };
}
