import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "ldr_session_age";
const SESSION_MAX_MS = 24 * 60 * 60 * 1000; // 24 jam

/**
 * Proxy (Next.js 16) — berjalan di setiap request (menggantikan middleware.ts)
 * Tugasnya:
 * 1. Refresh Supabase session agar cookie tidak expired
 * 2. Protect /dashboard/* /game/* /admin/* — harus login
 * 3. Redirect auth pages jika sudah login
 * 4. Session inactivity timeout: force logout setelah 24 jam tanpa aktivitas (sliding window)
 * 5. CSP nonce-based: generate nonce per-request, set di header x-nonce + CSP
 *    (SEC-01: menghapus 'unsafe-inline' dari script-src)
 */
export async function proxy(request: NextRequest) {
  // ── 1. Generate CSP nonce (16 bytes, hex format for Edge compatibility) ──
  const array = new Uint8Array(16);
  globalThis.crypto.getRandomValues(array);
  const nonce = Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // CSP: gunakan nonce + strict-dynamic → tidak perlu 'unsafe-inline' untuk scripts
  // 'unsafe-eval' masih diperlukan untuk Daily.co Web SDK (tidak bisa dihapus)
  const csp = [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' https://*.daily.co`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co wss://*.supabase.in https://*.daily.co wss://*.daily.co",
    "frame-src 'self' https://*.daily.co",
    "media-src 'self' https://*.daily.co blob:",
  ].join("; ");

  // ── 2. Setup request headers (termasuk nonce untuk layout) ───────────────
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // ── 3. Supabase client + session refresh ────────────────────────────────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — PENTING: jangan hapus baris ini
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ── 4. Session timeout: enforce 24-jam INACTIVITY timeout (sliding window) ─
  if (user) {
    const sessionAgeCookie = request.cookies.get(SESSION_COOKIE_NAME);
    const sessionTimestamp = sessionAgeCookie ? parseInt(sessionAgeCookie.value, 10) : null;
    const isExpired = !sessionTimestamp || Date.now() - sessionTimestamp > SESSION_MAX_MS;

    if (isExpired) {
      // Tidak ada aktivitas selama 24 jam → force logout dan redirect ke login
      await supabase.auth.signOut();

      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/auth/login";
      loginUrl.search = "";

      const forceLogoutResponse = NextResponse.redirect(loginUrl);
      forceLogoutResponse.cookies.delete(SESSION_COOKIE_NAME);
      return forceLogoutResponse;
    }

    // Sliding window: perbarui timestamp setiap request aktif
    // Artinya: logout hanya terjadi jika user TIDAK aktif selama 24 jam berturut-turut
    supabaseResponse.cookies.set(SESSION_COOKIE_NAME, Date.now().toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 86400, // 24 jam
      path: "/",
    });
  }

  // ── 5. Protected routes: redirect ke login jika belum auth ──────────────
  const protectedPaths = ["/dashboard", "/game", "/admin"];
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  // ── 6. Auth pages: redirect ke dashboard jika sudah login ───────────────
  const authPaths = ["/auth/login", "/auth/register"];
  const isAuthPage = authPaths.some((path) => pathname.startsWith(path));

  if (isAuthPage && user) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  // ── 7. Set security headers (CSP + HSTS + lainnya) pada response ────────
  supabaseResponse.headers.set("Content-Security-Policy", csp);
  supabaseResponse.headers.set("x-nonce", nonce);
  supabaseResponse.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  supabaseResponse.headers.set("X-Content-Type-Options", "nosniff");
  supabaseResponse.headers.set("X-Frame-Options", "SAMEORIGIN");
  supabaseResponse.headers.set("X-XSS-Protection", "1; mode=block");
  supabaseResponse.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  supabaseResponse.headers.set("Permissions-Policy", "camera=*, microphone=*, geolocation=()");

  return supabaseResponse;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|txt)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

