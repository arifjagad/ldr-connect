"use client";

import { createClient } from "@/lib/supabase/client";

type BalanceListener = (balance: number) => void;

type ChannelEntry = {
  channel: ReturnType<ReturnType<typeof createClient>["channel"]>;
  listeners: Set<BalanceListener>;
};

/**
 * Registry channel realtime `wallets`, dikunci per userId.
 *
 * PENTING: Supabase Realtime melempar error jika `.on(...)` dipanggil pada
 * channel yang sudah `.subscribe()` — dan karena `createClient()` di
 * `lib/supabase/client.ts` adalah singleton, dua komponen React yang
 * masing-masing memanggil `supabase.channel("wallet-balance-x")` dengan
 * NAMA YANG SAMA akan mendapat *objek channel yang sama* dari Supabase.
 * Komponen kedua yang mencoba `.on()` di atasnya akan crash:
 *   "cannot add `postgres_changes` callbacks ... after `subscribe()`"
 *
 * Modul ini mencegah itu dengan membuat channel HANYA SEKALI per userId
 * (saat listener pertama subscribe), dan membagikan event ke semua listener
 * lain lewat `Set` biasa — tanpa channel/`subscribe()` tambahan.
 */
const channels = new Map<string, ChannelEntry>();

async function fetchBalanceFallback(): Promise<number | null> {
  try {
    const res = await fetch("/api/coin/balance");
    if (!res.ok) return null;
    const json = await res.json();
    const bal = json?.data?.wallet?.balance;
    return typeof bal === "number" ? bal : null;
  } catch {
    return null;
  }
}

/**
 * Subscribe ke perubahan saldo wallet user via Supabase Realtime.
 * Aman dipanggil dari banyak komponen/hook sekaligus untuk userId yang sama
 * (misal navbar & halaman Coin) — channel Supabase hanya dibuat sekali.
 *
 * @returns fungsi unsubscribe. Channel Supabase otomatis di-`removeChannel()`
 * saat listener TERAKHIR untuk userId tersebut unsubscribe.
 */
export function subscribeWalletBalance(userId: string, onUpdate: BalanceListener): () => void {
  let entry = channels.get(userId);

  if (!entry) {
    const supabase = createClient();
    const listeners = new Set<BalanceListener>();

    const channel = supabase
      .channel(`wallet-balance-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wallets",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newWallet = payload.new as { balance?: number } | null;
          if (typeof newWallet?.balance === "number") {
            listeners.forEach((listener) => listener(newWallet.balance!));
          } else {
            // Fallback jarang terjadi: payload tidak memuat balance
            // (misal REPLICA IDENTITY terbatas) — ambil nilai terbaru via REST.
            fetchBalanceFallback().then((bal) => {
              if (typeof bal === "number") {
                listeners.forEach((listener) => listener(bal));
              }
            });
          }
        }
      )
      .subscribe();

    entry = { channel, listeners };
    channels.set(userId, entry);
  }

  entry.listeners.add(onUpdate);

  return () => {
    const current = channels.get(userId);
    if (!current) return;
    current.listeners.delete(onUpdate);
    if (current.listeners.size === 0) {
      const supabase = createClient();
      supabase.removeChannel(current.channel);
      channels.delete(userId);
    }
  };
}

/** Hanya untuk keperluan unit test — reset seluruh state registry channel. */
export function __resetWalletBalanceChannelsForTest() {
  channels.clear();
}
