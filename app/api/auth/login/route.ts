import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase/server";

const SESSION_COOKIE_NAME = "ldr_session_age";
const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60; // 24 jam

const bodySchema = z.object({
  email:    z.string().email("Format email tidak valid").max(255),
  password: z.string().min(1, "Password tidak boleh kosong").max(200),
});

/**
 * POST /api/auth/login
 * Server-side login dengan dua-tier rate limiting:
 * - Tier 1: 5 gagal dalam 1 menit  → 429 "coba lagi 1 menit"
 * - Tier 2: 10 gagal dalam 1 jam   → 429 "diblokir 1 jam"
 * Setelah berhasil: set cookie ldr_session_age untuk session timeout di middleware.
 */
export async function POST(request: NextRequest) {
  // 1. Validasi body
  let body: z.infer<typeof bodySchema>;
  try {
    const raw = await request.json().catch(() => ({}));
    body = bodySchema.parse(raw);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: e.issues[0].message, data: null },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Request tidak valid", data: null },
      { status: 400 }
    );
  }

  const { email, password } = body;

  // 2. Cek rate limit (sebelum mencoba login ke Supabase)
  const serviceClient = createServiceClient();
  const { data: rateLimitResult, error: rateLimitError } = await serviceClient.rpc(
    "check_login_rate_limit",
    { p_email: email }
  );

  if (rateLimitError) {
    // Fail-open: jika RPC gagal, biarkan request lanjut agar UX tidak terganggu
    console.error("[login] rate limit RPC error:", rateLimitError.message);
  } else if (rateLimitResult === "tier1") {
    return NextResponse.json(
      {
        success: false,
        message: "Terlalu banyak percobaan login. Tunggu 1 menit sebelum mencoba lagi.",
        data: null,
      },
      { status: 429 }
    );
  } else if (rateLimitResult === "tier2") {
    return NextResponse.json(
      {
        success: false,
        message: "Terlalu banyak percobaan gagal. Akun diblokir sementara selama 1 jam.",
        data: null,
      },
      { status: 429 }
    );
  }

  // 3. Attempt login ke Supabase Auth & tangkap session cookies secara eksplisit
  const cookiesToSet: Array<{ name: string; value: string; options: any }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet) {
          toSet.forEach((c) => cookiesToSet.push(c));
        },
      },
    }
  );

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !signInData.session) {
    // Login gagal — rate limit sudah dicatat di langkah 2 (check + insert)
    const message =
      signInError?.message === "Invalid login credentials"
        ? "Email atau password salah"
        : (signInError?.message || "Login gagal");

    return NextResponse.json(
      { success: false, message, data: null },
      { status: 401 }
    );
  }

  // 4. Login berhasil — reset rate limit counter untuk email ini
  try {
    const { error: clearError } = await serviceClient.rpc("clear_login_rate_limit", { p_email: email });
    if (clearError) {
      console.error("[login] clear rate limit failed:", clearError.message);
    }
  } catch (e) {
    console.error("[login] clear rate limit network error:", e);
  }

  // 5. Concurrent session block: sign out semua sesi LAIN yang aktif
  try {
    const currentUserId = signInData.user.id;
    if (currentUserId) {
      await serviceClient.auth.admin.signOut(currentUserId, "others" as never);
    }
  } catch (e) {
    console.error("[login] concurrent session sign-out failed:", e);
  }

  // 6. Buat response dan attach SEMUA auth cookie + ldr_session_age
  const sessionTimestamp = Date.now().toString();

  const response = NextResponse.json({
    success: true,
    message: "Login berhasil",
    data: {
      user: {
        id: signInData.user.id,
        email: signInData.user.email,
      },
    },
  });

  // Tulis semua cookie auth Supabase ke headers response Netlify
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, {
      ...options,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
  });

  response.cookies.set(SESSION_COOKIE_NAME, sessionTimestamp, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   SESSION_MAX_AGE_SECONDS,
    path:     "/",
  });

  return response;
}
