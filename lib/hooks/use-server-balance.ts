"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";

export function useServerBalance() {
  const { user } = useAuthStore();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/coin/balance");
      if (!res.ok) {
        throw new Error("Gagal mengambil saldo dari server");
      }
      const json = await res.json();
      if (json && json.success) {
        setBalance(json.data.wallet.balance);
        setError(null);
      } else {
        throw new Error(json?.message || "Format respons tidak valid");
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setBalance(null);
      setLoading(false);
      return;
    }

    fetchBalance();

    // Refetch on window focus
    const handleFocus = () => fetchBalance();
    window.addEventListener("focus", handleFocus);

    // Polling tiap 30 detik selama user aktif di halaman
    const intervalId = setInterval(fetchBalance, 30_000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(intervalId);
    };
  }, [fetchBalance, user]);

  return { balance, loading, error, refresh: fetchBalance };
}
