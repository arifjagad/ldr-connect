"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase browser client — dipakai di Client Components ("use client")
 * Menggunakan ANON KEY (publishable), aman di browser
 * Semua read operation dilindungi oleh RLS policies
 *
 * ⚠️ SINGLETON: instance disimpan di module scope dan di-reuse di setiap
 * pemanggilan createClient(). Ini penting karena:
 * - Setiap instance baru = koneksi WebSocket Realtime baru. Jika banyak
 *   komponen memanggil createClient() sendiri-sendiri, tiap komponen akan
 *   punya socket realtime terpisah untuk user yang sama — boros koneksi
 *   dan bisa membuat channel di komponen lain "gagal diam-diam" menerima
 *   event postgres_changes (auth/token belum tentu ter-attach konsisten
 *   di semua socket).
 * - Mencegah warning "Multiple GoTrueClient instances detected" dari
 *   Supabase Auth saat banyak client dibuat di tab yang sama.
 *
 * Semua channel Realtime (misal tabel `wallets`) HARUS dibuat di atas
 * instance yang sama ini supaya konsisten satu sumber kebenaran.
 */
let browserClient: SupabaseClient | undefined;

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return browserClient;
}
