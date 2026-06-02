"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { useServerBalance } from "@/lib/hooks/use-server-balance";
import { Navbar } from "@/components/landing/Navbar";
import { GameInviteNotification } from "@/components/GameInviteNotification";
import { ToastContainer } from "@/components/ui/Toast";
import { PushPromptBanner } from "@/components/ui/PushPromptBanner";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

const dashboardNavItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/games", label: "Games" },
  { href: "/dashboard/couple", label: "Couple" },
  { href: "/dashboard/coin", label: "Coin" },
  { href: "/dashboard/anniversaries", label: "Anniversary" },
  { href: "/dashboard/wishlist", label: "Wishlist" },
  { href: "/dashboard/capsule", label: "Kapsul 💌" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const { balance: serverBalance } = useServerBalance();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const isAuthPage = pathname.startsWith("/auth");
  const isDashboardPage = pathname.startsWith("/dashboard");
  const isPublicPage = !isAuthPage && !isDashboardPage;

  // Register service worker & resync subscription jika user sudah pernah subscribe
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !VAPID_PUBLIC_KEY) return;

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      if (!existing) return; // belum subscribe — tidak perlu sync

      // Sudah ada subscription — pastikan tersimpan di server (misal setelah clear cookies)
      const sub = existing.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      if (!sub.keys) return;
      fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }),
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  // Validasi sesi Supabase setiap kali user membuka halaman dashboard
  // Menghindari stale cache di localStorage yang seolah "masuk sendiri" tanpa check
  useEffect(() => {
    if (!isDashboardPage) { setSessionReady(true); return; }

    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (cancelled) return;
      if (error) {
        // Jika ada error (misal CSP/network), jangan redirect — biarkan middleware yg handle
        console.warn("[AppShell] getSession error:", error.message);
        setSessionReady(true);
        return;
      }
      if (!session) {
        clearAuth();
        router.replace("/auth/login");
      } else {
        setSessionReady(true);
      }
    }).catch((err) => {
      if (cancelled) return;
      // Network error / script blocked — jangan loop redirect
      console.warn("[AppShell] getSession threw:", err);
      setSessionReady(true);
    });
    return () => { cancelled = true; };
  }, [isDashboardPage, clearAuth, router]);

  async function handleLogout() {
    // Panggil API logout agar cookie ldr_session_age ikut dihapus (SESS-01)
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    clearAuth();
    router.push("/auth/login");
    router.refresh();
  }

  if (isDashboardPage && !sessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0E0E12]">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin text-[#FF3D7F]" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
          </svg>
          <p className="text-xs text-[#5C5470]">Memverifikasi sesi...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {isDashboardPage ? (
        <>
          <header className="sticky top-0 z-40 border-b border-white/5 bg-[#141417]/90 backdrop-blur">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
              <Link href="/dashboard" className="group">
                <p className="text-[10px] text-[#5C5470]">LDR-Connect</p>
                <p className="text-sm font-semibold text-[#F5F0FF] group-hover:text-[#FF6B9D] transition">
                  {user ? `Hi, ${user.name} 👋` : "Dashboard"}
                </p>
              </Link>

              {/* Desktop nav */}
              <nav className="hidden sm:flex items-center gap-1.5">
                {dashboardNavItems.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`rounded-full px-3 py-1.5 text-sm transition ${
                        active
                          ? "bg-[#FF3D7F] text-white"
                          : "bg-white/5 text-[#9B93B0] hover:bg-white/10 hover:text-[#F5F0FF]"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}

                {/* Coin balance badge */}
                {user && (
                  <Link
                    href="/dashboard/coin"
                    title="Saldo Coin — klik untuk top up"
                    className="flex items-center gap-1.5 rounded-full border border-[#F97316]/25 bg-[#F97316]/10 px-3 py-1.5 text-sm font-semibold text-[#FB923C] transition hover:border-[#F97316]/50 hover:bg-[#F97316]/20"
                  >
                    <span className="text-sm">🪙</span>
                    {serverBalance !== null ? serverBalance : user.wallet_balance}
                  </Link>
                )}
                {/* Profile avatar button */}
                <Link
                  href="/dashboard/profile"
                  title="Profil & Pengaturan"
                  className={`relative flex h-8 w-8 overflow-hidden items-center justify-center rounded-full text-sm font-bold transition ring-2 ${
                    pathname.startsWith("/dashboard/profile")
                      ? "ring-[#FF3D7F] text-white"
                      : "ring-white/10 bg-white/10 text-[#9B93B0] hover:ring-white/30"
                  }`}
                >
                  {user?.avatar_url ? (
                    <Image
                      src={user.avatar_url}
                      alt={user.name}
                      width={32}
                      height={32}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <span>{user?.name?.[0]?.toUpperCase() ?? "?"}</span>
                  )}
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-[#9B93B0] transition hover:border-white/20 hover:text-[#F5F0FF]"
                >
                  Keluar
                </button>
              </nav>

              {/* Mobile: coin balance + profile avatar + hamburger */}
              <div className="flex sm:hidden items-center gap-2">
                {user && (
                  <Link
                    href="/dashboard/coin"
                    className="flex items-center gap-1 rounded-full border border-[#F97316]/25 bg-[#F97316]/10 px-2.5 py-1 text-xs font-semibold text-[#FB923C]"
                  >
                    <span>🪙</span>
                    {serverBalance !== null ? serverBalance : user.wallet_balance}
                  </Link>
                )}
                <Link
                  href="/dashboard/profile"
                  className={`relative flex h-7 w-7 overflow-hidden items-center justify-center rounded-full text-xs font-bold ring-2 transition ${
                    pathname.startsWith("/dashboard/profile")
                      ? "ring-[#FF3D7F]"
                      : "ring-white/10 bg-white/10 text-[#9B93B0]"
                  }`}
                >
                  {user?.avatar_url ? (
                    <Image
                      src={user.avatar_url}
                      alt={user?.name ?? ""}
                      width={28}
                      height={28}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <span>{user?.name?.[0]?.toUpperCase() ?? "?"}</span>
                  )}
                </Link>
                <button
                  type="button"
                  onClick={() => setMobileOpen((v) => !v)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#9B93B0]"
                  aria-label="Toggle menu"
                >
                  {mobileOpen ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Mobile dropdown menu */}
            {mobileOpen && (
              <div className="sm:hidden border-t border-white/5 bg-[#141417]/95 px-4 py-3">
                <div className="flex flex-col gap-1">
                  {dashboardNavItems.map((item) => {
                    const active =
                      pathname === item.href ||
                      (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`rounded-xl px-4 py-2.5 text-sm transition ${
                          active
                            ? "bg-[#FF3D7F]/15 font-medium text-[#FF6B9D]"
                            : "text-[#9B93B0] hover:bg-white/5 hover:text-[#F5F0FF]"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                  <div className="mt-2 border-t border-white/5 pt-2">
                    <button
                      type="button"
                      onClick={() => { setMobileOpen(false); handleLogout(); }}
                      className="w-full rounded-xl px-4 py-2.5 text-left text-sm text-[#9B93B0] transition hover:bg-white/5 hover:text-[#F5F0FF]"
                    >
                      Keluar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </header>
          <GameInviteNotification />
          <PushPromptBanner />
        </>
      ) : null}

      {isPublicPage ? <Navbar /> : null}

      {children}
      <ToastContainer />
    </>
  );
}
