"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Navbar } from "@/components/landing/Navbar";
import { GameInviteNotification } from "@/components/GameInviteNotification";

const dashboardNavItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/games", label: "Games" },
  { href: "/dashboard/couple", label: "Couple" },
  { href: "/dashboard/coin", label: "Coin" },
  { href: "/dashboard/anniversaries", label: "Anniversary" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const isAuthPage = pathname.startsWith("/auth");
  const isDashboardPage = pathname.startsWith("/dashboard");
  const isPublicPage = !isAuthPage && !isDashboardPage;

  // Validasi sesi Supabase setiap kali user membuka halaman dashboard
  // Menghindari stale cache di localStorage yang seolah "masuk sendiri" tanpa check
  useEffect(() => {
    if (!isDashboardPage) { setSessionReady(true); return; }

    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        clearAuth();
        router.replace("/auth/login");
      } else {
        setSessionReady(true);
      }
    });
  }, [isDashboardPage, clearAuth, router]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
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
                {/* Profile avatar button */}
                <Link
                  href="/dashboard/profile"
                  title="Profil & Pengaturan"
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition ${
                    pathname.startsWith("/dashboard/profile")
                      ? "bg-[#FF3D7F] text-white"
                      : "bg-white/10 text-[#9B93B0] hover:bg-white/20 hover:text-[#F5F0FF]"
                  }`}
                >
                  {user?.name?.[0]?.toUpperCase() ?? "?"}
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-[#9B93B0] transition hover:border-white/20 hover:text-[#F5F0FF]"
                >
                  Keluar
                </button>
              </nav>

              {/* Mobile: profile avatar + hamburger */}
              <div className="flex sm:hidden items-center gap-2">
                <Link
                  href="/dashboard/profile"
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                    pathname.startsWith("/dashboard/profile")
                      ? "bg-[#FF3D7F] text-white"
                      : "bg-white/10 text-[#9B93B0]"
                  }`}
                >
                  {user?.name?.[0]?.toUpperCase() ?? "?"}
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
        </>
      ) : null}

      {isPublicPage ? <Navbar /> : null}

      {children}
    </>
  );
}
