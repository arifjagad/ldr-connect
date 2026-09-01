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
import { DialogContainer } from "@/components/ui/Dialog";
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
  const [partnerInfo, setPartnerInfo] = useState<{ name: string; avatar_url: string | null } | null>(null);

  const hamburgerRef = useRef<HTMLDivElement>(null);
  const moreRef      = useRef<HTMLDivElement>(null);
  const moreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAuthPage      = pathname.startsWith("/auth");
  const isDashboardPage = pathname.startsWith("/dashboard");
  const isAdminPage     = pathname.startsWith("/admin");
  const isPublicPage    = !isAuthPage && !isDashboardPage && !isAdminPage;

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

  // Fetch partner info (nama + avatar) sekali saat user linked
  useEffect(() => {
    if (!user?.partner_id) { setPartnerInfo(null); return; }
    let cancelled = false;
    createClient()
      .from("users")
      .select("name, avatar_url")
      .eq("id", user.partner_id)
      .single()
      .then(({ data }) => {
        if (!cancelled && data) setPartnerInfo({ name: data.name, avatar_url: data.avatar_url ?? null });
      });
    return () => { cancelled = true; };
  }, [user?.partner_id]);

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

  // Validasi sesi Supabase & auto-sync auth state secara global
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    // 1. Cek sesi saat mount
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (cancelled) return;
      if (error) {
        console.warn("[AppShell] getSession error:", error.message);
        setSessionReady(true);
        return;
      }
      if (!session) {
        if (useAuthStore.getState().user) clearAuth();
        if (isDashboardPage) router.replace("/auth/login");
      } else {
        // Jika session ada tapi store kosong (misal hard refresh / new tab)
        if (!useAuthStore.getState().user) {
          fetch("/api/auth/me")
            .then((res) => (res.ok ? res.json() : null))
            .then((json) => {
              if (json?.data && !cancelled) {
                useAuthStore.getState().setUser(json.data);
              }
            })
            .catch(() => {});
        }
      }
      setSessionReady(true);
    }).catch((err) => {
      if (cancelled) return;
      console.warn("[AppShell] getSession threw:", err);
      setSessionReady(true);
    });

    // 2. Listen auth changes (SIGNED_OUT, TOKEN_REFRESHED, SIGNED_IN)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "SIGNED_OUT" || !session) {
        clearAuth();
        if (isDashboardPage) router.replace("/auth/login");
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [isDashboardPage, clearAuth, router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    clearAuth();
    router.push("/auth/login");
    router.refresh();
  }

  if (isDashboardPage && !sessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FCFBF7]">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin text-[#C84B31]" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
          </svg>
          <p className="text-xs font-medium text-[#78716C]">Memverifikasi sesi...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {isDashboardPage ? (
        <>
          <header className="sticky top-0 z-40 border-b border-[#E7E5E4] bg-[#FCFBF7]/90 backdrop-blur-md">
            <div className="mx-auto grid w-full max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">

              {/* Brand — col 1, left */}
              <Link href="/dashboard" className="flex items-center gap-2 group shrink-0">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#C84B31] text-xs font-bold text-white shadow-xs">
                  ♥
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#78716C]">LDR-Connect</p>
                  <p className="text-sm font-bold text-[#1F1D1B] group-hover:text-[#C84B31] transition">
                    {user ? `Hi, ${user.name} 👋` : "Dashboard"}
                  </p>
                </div>
              </Link>

              {/* ── Desktop nav (≥ 1024px) — col 2, truly centered ─────── */}
              <nav className="hidden lg:flex items-center gap-1.5">
                {/* Main nav items */}
                {mainNavItems.map((item) => {
                  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                        active
                          ? "bg-[#C84B31] text-white shadow-xs"
                          : "bg-white border border-[#E7E5E4] text-[#78716C] hover:text-[#1F1D1B] hover:border-[#D6D3D1] hover:bg-[#FCFBF7]"
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
                    className={`flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                      moreActive
                        ? "bg-[#C84B31] text-white shadow-xs"
                        : "bg-white border border-[#E7E5E4] text-[#78716C] hover:text-[#1F1D1B] hover:border-[#D6D3D1] hover:bg-[#FCFBF7]"
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
                      <div className="w-44 rounded-2xl border border-[#E7E5E4] bg-white shadow-xl shadow-black/[0.04] overflow-hidden p-1.5">
                        {moreNavItems.map((item) => {
                          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition ${
                                active
                                  ? "bg-[#FDF4F2] font-semibold text-[#C84B31]"
                                  : "text-[#78716C] hover:bg-[#FCFBF7] hover:text-[#1F1D1B]"
                              }`}
                            >
                              {active && <span className="h-1.5 w-1.5 rounded-full bg-[#C84B31] shrink-0" />}
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </nav>

              {/* On mobile: empty center placeholder so grid stays balanced */}
              <div className="lg:hidden" />

              {/* ── Right side — col 3, right ─────────────────────────── */}
              <div className="flex items-center justify-end gap-2">

                {/* Coin badge — selalu tampil */}
                {user && (
                  <Link
                    href="/dashboard/coin"
                    title="Saldo Coin"
                    className="flex items-center gap-1.5 rounded-full border border-[#FDE68A] bg-[#FEF3C7] px-3 py-1 text-xs font-bold text-[#D97706] transition hover:border-[#F59E0B] hover:bg-[#FDE68A]/60"
                  >
                    <span>🪙</span>
                    {serverBalance !== null ? serverBalance : user.wallet_balance}
                  </Link>
                )}

                {/* Avatar pair: [partner] ❤ [me] */}
                {partnerInfo ? (
                  <div className="flex items-center gap-1">
                    {/* Partner avatar */}
                    <div
                      className="relative flex h-7 w-7 shrink-0 overflow-hidden items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-[#E7E5E4] bg-[#FDF4F2] text-[#C84B31]"
                      title={`Partner: ${partnerInfo.name}`}
                    >
                      {partnerInfo.avatar_url ? (
                        <Image src={partnerInfo.avatar_url} alt={partnerInfo.name} width={28} height={28} className="h-full w-full object-cover" unoptimized />
                      ) : (
                        <span>{partnerInfo.name?.[0]?.toUpperCase() ?? "?"}</span>
                      )}
                    </div>

                    {/* Heart — di tengah antara partner & user */}
                    <span className="text-[10px] text-[#C84B31] leading-none">❤</span>

                    {/* User avatar */}
                    <Link
                      href="/dashboard/profile"
                      title="Profil & Pengaturan"
                      className={`relative flex h-8 w-8 shrink-0 overflow-hidden items-center justify-center rounded-full text-xs font-bold transition ring-2 ${
                        pathname.startsWith("/dashboard/profile") ? "ring-[#C84B31]" : "ring-[#E7E5E4] bg-white text-[#1F1D1B] hover:ring-[#C84B31]/50"
                      }`}
                    >
                      {user?.avatar_url ? (
                        <Image src={user.avatar_url} alt={user.name} width={32} height={32} className="h-full w-full object-cover" unoptimized />
                      ) : (
                        <span>{user?.name?.[0]?.toUpperCase() ?? "?"}</span>
                      )}
                    </Link>
                  </div>
                ) : (
                  /* User avatar saja (belum linked) */
                  <Link
                    href="/dashboard/profile"
                    title="Profil & Pengaturan"
                    className={`relative flex h-8 w-8 shrink-0 overflow-hidden items-center justify-center rounded-full text-xs font-bold transition ring-2 ${
                      pathname.startsWith("/dashboard/profile") ? "ring-[#C84B31]" : "ring-[#E7E5E4] bg-white text-[#1F1D1B] hover:ring-[#C84B31]/50"
                    }`}
                  >
                    {user?.avatar_url ? (
                      <Image src={user.avatar_url} alt={user.name} width={32} height={32} className="h-full w-full object-cover" unoptimized />
                    ) : (
                      <span>{user?.name?.[0]?.toUpperCase() ?? "?"}</span>
                    )}
                  </Link>
                )}

                {/* Logout — hanya desktop */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="hidden lg:block rounded-full border border-[#E7E5E4] bg-white px-3.5 py-1.5 text-xs font-medium text-[#78716C] transition hover:border-[#D6D3D1] hover:bg-[#FCFBF7] hover:text-[#1F1D1B]"
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
                      menuOpen ? "border-[#C84B31] bg-[#FDF4F2] text-[#C84B31]" : "border-[#E7E5E4] bg-white text-[#78716C]"
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
                    <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-[#E7E5E4] bg-white shadow-xl shadow-black/[0.05] overflow-hidden">
                      <div className="p-1.5">
                        {allNavItems.map((item, idx) => {
                          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
                          // Divider sebelum item pertama dari moreNavItems
                          const isFirstMore = idx === mainNavItems.length;
                          return (
                            <div key={item.href}>
                              {isFirstMore && (
                                <div className="mx-2 my-1.5 border-t border-[#F5F5F4]" />
                              )}
                              <Link
                                href={item.href}
                                className={`flex items-center rounded-xl px-3 py-2 text-xs font-medium transition ${
                                  active ? "bg-[#FDF4F2] font-semibold text-[#C84B31]" : "text-[#78716C] hover:bg-[#FCFBF7] hover:text-[#1F1D1B]"
                                }`}
                              >
                                {active && <span className="mr-2 h-1.5 w-1.5 rounded-full bg-[#C84B31] shrink-0" />}
                                {item.label}
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                      <div className="border-t border-[#F5F5F4] p-1.5">
                        <button
                          type="button"
                          onClick={() => { setMenuOpen(false); handleLogout(); }}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
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
      <DialogContainer />
    </>
  );
}
