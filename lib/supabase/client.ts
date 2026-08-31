"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase browser client — dipakai di Client Components ("use client")
 * Menggunakan ANON KEY (publishable), aman di browser
 * Semua read operation dilindungi oleh RLS policies
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
