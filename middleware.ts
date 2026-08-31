import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "ldr_session_age";
const SESSION_MAX_MS = 24 * 60 * 60 * 1000; // 24 jam

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const isDev = process.env.NODE_ENV !== "production";

  // ── 1. Setup CSP nonce ──────────────────────────────────────────────────
  const array = new Uint8Array(16);
  globalThis.crypto.getRandomValues(array);
  const nonce = Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  requestHeaders.set("x-nonce", nonce);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // ── 2. Supabase client + session refresh ────────────────────────────────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ── 3. Session inactivity timeout: 24 jam sliding window ────────────────
  if (user) {
    const sessionAgeCookie = request.cookies.get(SESSION_COOKIE_NAME);
    const sessionTimestamp = sessionAgeCookie ? parseInt(sessionAgeCookie.value, 10) : null;
    const isExpired = !sessionTimestamp || Date.now() - sessionTimestamp > SESSION_MAX_MS;

    if (isExpired) {
      await supabase.auth.signOut();
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/auth/login";
      loginUrl.search = "";

      const forceLogoutResponse = NextResponse.redirect(loginUrl);
      forceLogoutResponse.cookies.delete(SESSION_COOKIE_NAME);
      return forceLogoutResponse;
    }

    supabaseResponse.cookies.set(SESSION_COOKIE_NAME, Date.now().toString(), {
      httpOnly: true,
      secure: !isDev,
      sameSite: "lax",
      maxAge: 86400,
      path: "/",
    });
  }

  // ── 4. Protected routes: redirect ke /auth/login jika belum auth ────────
  const protectedPaths = ["/dashboard", "/game", "/admin"];
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  // ── 5. Auth pages: redirect ke /dashboard jika sudah login ──────────────
  const authPaths = ["/auth/login", "/auth/register"];
  const isAuthPage = authPaths.some((path) => pathname.startsWith(path));

  if (isAuthPage && user) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  // ── 6. Security Headers (CSP disesuaikan agar tidak memblok Turbopack dev) ─
  if (!isDev) {
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

    supabaseResponse.headers.set("Content-Security-Policy", csp);
    supabaseResponse.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  supabaseResponse.headers.set("x-nonce", nonce);
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
