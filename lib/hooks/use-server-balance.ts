"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { subscribeWalletBalance } from "@/lib/realtime/wallet-balance-channel";

/**
 * Hook untuk mendapatkan saldo coin dari server.
 *
 * ⭐ SINGLE SOURCE OF TRUTH untuk saldo realtime — dipakai bersama oleh
 * navbar (`AppShell`) dan halaman manapun yang butuh saldo coin (misal
 * halaman Coin). Setiap komponen yang memanggil hook ini boleh dipanggil
 * berkali-kali secara bersamaan dengan aman: channel Realtime ke tabel
 * `wallets` dikelola lewat `lib/realtime/wallet-balance-channel.ts` yang
 * memastikan hanya SATU channel Supabase dibuat per userId, dibagikan ke
 * semua pemanggil — mencegah error "cannot add postgres_changes callbacks
 * ... after subscribe()" yang terjadi jika dua komponen membuat channel
 * dengan nama sama di atas Supabase client singleton yang sama.
 *
 * JANGAN buat channel Realtime manual ke tabel `wallets` di komponen lain.
 * Gunakan hook ini supaya nilai yang ditampilkan di navbar dan di halaman
 * manapun selalu identik dan update bersamaan dari event yang sama.
 *
 * Strategi fetch (hemat request):
 * - Fetch 1x saat mount (jika user sudah login)
 * - Refetch saat window focus, TAPI hanya jika sejak fetch terakhir
 *   sudah > MIN_REFETCH_MS (60 detik). Mencegah spam saat user
 *   alt-tab cepat atau banyak tab login sekaligus.
 * - TIDAK ada polling interval — balance hanya berubah saat user
 *   melakukan transaksi; realtime channel `wallets` di bawah menangani
 *   update instan, fetch di atas hanya jaring pengaman.
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
  const user = useAuthStore((s) => s.user);
  const setWalletBalance = useAuthStore((s) => s.setWalletBalance);
  // Reactive balance yang sinkron dengan Zustand store
  const storeBalance = user?.wallet_balance ?? null;
  const [balance, setBalance] = useState<number | null>(storeBalance);
  const [loading, setLoading]  = useState(storeBalance === null);
  const [error, setError]      = useState<string | null>(null);

  // Sync state lokal ketika store berubah
  useEffect(() => {
    if (typeof user?.wallet_balance === "number") {
      setBalance(user.wallet_balance);
      setLoading(false);
    }
  }, [user?.wallet_balance]);

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

    // Supabase Realtime: subscribe to wallet balance changes for this user.
    // Channel dibagi dengan pemanggil lain via wallet-balance-channel.ts —
    // aman dipanggil dari navbar & halaman Coin secara bersamaan.
    const unsubscribeWallet = subscribeWalletBalance(user.id, (newBalance) => {
      setBalance(newBalance);
      setWalletBalance(newBalance);
    });

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(COIN_BALANCE_UPDATED_EVENT, handleBalanceEvent);
      unsubscribeWallet();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // hanya re-run jika user ganti (login/logout), bukan setiap render

  const currentDisplayBalance = typeof balance === "number" ? balance : (typeof user?.wallet_balance === "number" ? user.wallet_balance : null);

  return { balance: currentDisplayBalance, loading, error, refresh: () => fetchBalance(true) };
}
