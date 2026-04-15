import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Supabase server client — dipakai di:
 * - Server Components
 * - API Routes (route.ts)
 * - Server Actions
 *
 * Secara otomatis membaca session dari cookies
 * Gunakan ANON KEY untuk operasi biasa (RLS aktif)
 * Gunakan serviceClient() untuk operasi yang butuh bypass RLS
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll dipanggil dari Server Component — aman diabaikan
            // Middleware yang bertanggung jawab refresh session
          }
        },
      },
    }
  );
}

/**
 * Supabase service role client — bypass RLS sepenuhnya
 * HANYA dipakai di API Routes server-side untuk operasi bisnis:
 * - Deduct coin + buat game session (atomic)
 * - Update wallet setelah payment webhook
 * - Link/unlink couple
 * JANGAN pernah expose ke client
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
