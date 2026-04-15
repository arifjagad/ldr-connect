"use client";

import Link from "next/link";
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

  const isAuthPage = pathname.startsWith("/auth");
  const isDashboardPage = pathname.startsWith("/dashboard");
  const isPublicPage = !isAuthPage && !isDashboardPage;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAuth();
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <>
      {isDashboardPage ? (
        <>
          <header className="sticky top-0 z-40 border-b border-white/5 bg-[#141417]/90 backdrop-blur">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-3 lg:px-8">
              <Link href="/dashboard" className="group">
                <p className="text-[10px] text-[#5C5470]">LDR-Connect</p>
                <p className="text-sm font-semibold text-[#F5F0FF] group-hover:text-[#FF6B9D] transition">
                  {user ? `Hi, ${user.name} 👋` : "Dashboard"}
                </p>
              </Link>
              <nav className="flex items-center gap-1.5">
                {dashboardNavItems.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
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
            </div>
          </header>
          <GameInviteNotification />
        </>
      ) : null}

      {isPublicPage ? <Navbar /> : null}

      {children}
    </>
  );
}
