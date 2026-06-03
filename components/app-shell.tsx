"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { useServerBalance } from "@/lib/hooks/use-server-balance";
import { Navbar } from "@/components/landing/Navbar";
import { GameInviteNotification } from "@/components/GameInviteNotification";
import { ToastContainer } from "@/components/ui/Toast";
import { PushPromptBanner } from "@/components/ui/PushPromptBanner";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

// Item yang tampil langsung di desktop nav
const mainNavItems = [
  { href: "/dashboard",        label: "Overview" },
  { href: "/dashboard/games",  label: "Games" },
  { href: "/dashboard/couple", label: "Couple" },
  { href: "/dashboard/coin",   label: "Coin" },
];

// Item yang disembunyikan di dalam sub-menu "Lainnya ▾" (desktop)
const moreNavItems = [
  { href: "/dashboard/anniversaries", label: "Anniversary" },
  { href: "/dashboard/wishlist",      label: "Wishlist" },
  { href: "/dashboard/capsule",       label: "Kapsul" },
];

// Semua item — untuk hamburger mobile
const allNavItems = [...mainNavItems, ...moreNavItems];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, clearAuth } = useAuthStore();
  const { balance: serverBalance } = useServerBalance();
  const [menuOpen, setMenuOpen]     = useState(false);   // hamburger mobile
  const [moreOpen, setMoreOpen]     = useState(false);   // "Lainnya" desktop submenu
  const [sessionReady, setSessionReady] = useState(false);

  const hamburgerRef = useRef<HTMLDivElement>(null);
  const moreRef      = useRef<HTMLDivElement>(null);
  const moreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAuthPage      = pathname.startsWith("/auth");
  const isDashboardPage = pathname.startsWith("/dashboard");
  const isPublicPage    = !isAuthPage && !isDashboardPage;

  // Apakah halaman saat ini masuk sub-menu "Lainnya"
  const moreActive = moreNavItems.some(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`)
  );

  // Tutup hamburger saat klik di luar
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (hamburgerRef.current && !hamburgerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Tutup semua dropdown saat route berubah
  useEffect(() => { setMenuOpen(false); setMoreOpen(false); }, [pathname]);

  // Hover handlers untuk desktop "Lainnya" — dengan delay agar tidak langsung tutup
  const handleMoreEnter = () => {
    if (moreTimeoutRef.current) clearTimeout(moreTimeoutRef.current);
    setMoreOpen(true);
  };
  const handleMoreLeave = () => {
    moreTimeoutRef.current = setTimeout(() => setMoreOpen(false), 120);
  };

  // Register service worker & resync subscription
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !VAPID_PUBLIC_KEY) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      if (!existing) return;
      const sub = existing.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      if (!sub.keys) return;
      fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }),
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  // Validasi sesi Supabase
  useEffect(() => {
    if (!isDashboardPage) { setSessionReady(true); return; }
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (cancelled) return;
      if (error) { console.warn("[AppShell] getSession error:", error.message); setSessionReady(true); return; }
      if (!session) { clearAuth(); router.replace("/auth/login"); }
      else { setSessionReady(true); }
    }).catch((err) => {
      if (cancelled) return;
      console.warn("[AppShell] getSession threw:", err);
      setSessionReady(true);
    });
    return () => { cancelled = true; };
  }, [isDashboardPage, clearAuth, router]);

  async function handleLogout() {
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

              {/* Brand */}
              <Link href="/dashboard" className="group shrink-0">
                <p className="text-[10px] text-[#5C5470]">LDR-Connect</p>
                <p className="text-sm font-semibold text-[#F5F0FF] group-hover:text-[#FF6B9D] transition">
                  {user ? `Hi, ${user.name} 👋` : "Dashboard"}
                </p>
              </Link>

              {/* ── Desktop nav (≥ 1024px) ─────────────────────────────── */}
              <nav className="hidden lg:flex items-center gap-1.5">
                {/* Main nav items */}
                {mainNavItems.map((item) => {
                  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`rounded-full px-3 py-1.5 text-sm transition ${
                        active ? "bg-[#FF3D7F] text-white" : "bg-white/5 text-[#9B93B0] hover:bg-white/10 hover:text-[#F5F0FF]"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}

                {/* "Lainnya" dropdown — hover submenu */}
                <div
                  ref={moreRef}
                  className="relative"
                  onMouseEnter={handleMoreEnter}
                  onMouseLeave={handleMoreLeave}
                >
                  <button
                    type="button"
                    className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition ${
                      moreActive ? "bg-[#FF3D7F] text-white" : "bg-white/5 text-[#9B93B0] hover:bg-white/10 hover:text-[#F5F0FF]"
                    }`}
                  >
                    Lainnya
                    <svg
                      width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5"
                      className={`transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`}
                    >
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {/* Floating submenu */}
                  {moreOpen && (
                    <div className="absolute left-0 top-full pt-2">
                      <div className="w-44 rounded-xl border border-white/10 bg-[#1A1A22] shadow-2xl shadow-black/50 overflow-hidden p-1">
                        {moreNavItems.map((item) => {
                          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition ${
                                active
                                  ? "bg-[#FF3D7F]/15 font-medium text-[#FF6B9D]"
                                  : "text-[#9B93B0] hover:bg-white/5 hover:text-[#F5F0FF]"
                              }`}
                            >
                              {active && <span className="h-1.5 w-1.5 rounded-full bg-[#FF3D7F] shrink-0" />}
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </nav>

              {/* ── Right side ─────────────────────────────────────────── */}
              <div className="flex items-center gap-2">

                {/* Coin badge — selalu tampil */}
                {user && (
                  <Link
                    href="/dashboard/coin"
                    title="Saldo Coin"
                    className="flex items-center gap-1.5 rounded-full border border-[#F97316]/25 bg-[#F97316]/10 px-2.5 py-1.5 text-xs font-semibold text-[#FB923C] transition hover:border-[#F97316]/50 hover:bg-[#F97316]/20"
                  >
                    <span>🪙</span>
                    {serverBalance !== null ? serverBalance : user.wallet_balance}
                  </Link>
                )}

                {/* Profile avatar — selalu tampil */}
                <Link
                  href="/dashboard/profile"
                  title="Profil & Pengaturan"
                  className={`relative flex h-8 w-8 shrink-0 overflow-hidden items-center justify-center rounded-full text-sm font-bold transition ring-2 ${
                    pathname.startsWith("/dashboard/profile") ? "ring-[#FF3D7F]" : "ring-white/10 bg-white/10 text-[#9B93B0] hover:ring-white/30"
                  }`}
                >
                  {user?.avatar_url ? (
                    <Image src={user.avatar_url} alt={user.name} width={32} height={32} className="h-full w-full object-cover" unoptimized />
                  ) : (
                    <span>{user?.name?.[0]?.toUpperCase() ?? "?"}</span>
                  )}
                </Link>

                {/* Logout — hanya desktop */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="hidden lg:block rounded-full border border-white/10 px-3 py-1.5 text-sm text-[#9B93B0] transition hover:border-white/20 hover:text-[#F5F0FF]"
                >
                  Keluar
                </button>

                {/* ── Hamburger — hanya mobile/tablet (< lg) ─────────── */}
                <div className="relative lg:hidden" ref={hamburgerRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-label="Menu navigasi"
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                      menuOpen ? "border-[#FF3D7F]/40 bg-[#FF3D7F]/10 text-[#FF6B9D]" : "border-white/10 bg-white/5 text-[#9B93B0]"
                    }`}
                  >
                    {menuOpen ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" />
                      </svg>
                    )}
                  </button>

                  {/* Floating submenu mobile */}
                  {menuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-white/10 bg-[#1A1A22] shadow-2xl shadow-black/40 overflow-hidden">
                      <div className="p-1.5">
                        {allNavItems.map((item, idx) => {
                          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
                          // Divider sebelum item pertama dari moreNavItems
                          const isFirstMore = idx === mainNavItems.length;
                          return (
                            <div key={item.href}>
                              {isFirstMore && (
                                <div className="mx-2 my-1.5 border-t border-white/5" />
                              )}
                              <Link
                                href={item.href}
                                className={`flex items-center rounded-xl px-3 py-2.5 text-sm transition ${
                                  active ? "bg-[#FF3D7F]/15 font-medium text-[#FF6B9D]" : "text-[#9B93B0] hover:bg-white/5 hover:text-[#F5F0FF]"
                                }`}
                              >
                                {active && <span className="mr-2 h-1.5 w-1.5 rounded-full bg-[#FF3D7F] shrink-0" />}
                                {item.label}
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                      <div className="border-t border-white/5 p-1.5">
                        <button
                          type="button"
                          onClick={() => { setMenuOpen(false); handleLogout(); }}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-red-400/80 transition hover:bg-red-500/10 hover:text-red-400"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Keluar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
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
