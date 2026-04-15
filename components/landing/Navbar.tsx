"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";

const navLinks = [{ href: "/games", label: "Games" }];

export function Navbar() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0A0A0B]/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-base font-black text-[#FFF5F8]">LDR-Connect</span>
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#FF3D7F]" />
        </Link>

        {/* Nav Links */}
        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-bold transition-colors ${
                pathname === link.href || pathname.startsWith(link.href + "/")
                  ? "text-[#FF6B9D]"
                  : "text-[#9B93B0] hover:text-[#FFF5F8]"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Auth Buttons */}
        <div className="flex items-center gap-3">
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-[#FF3D7F] px-5 py-2 text-sm font-black text-white transition-all duration-200 hover:scale-[1.02] hover:bg-[#FF6B9D] hover:shadow-[0_0_20px_#FF3D7F50]"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="rounded-full border border-white/15 px-5 py-2 text-sm font-bold text-[#FFF5F8] transition-all duration-200 hover:border-[#FF3D7F40] hover:bg-[#FF3D7F08]"
              >
                Masuk
              </Link>
              <Link
                href="/auth/register"
                className="rounded-full bg-[#FF3D7F] px-5 py-2 text-sm font-black text-white transition-all duration-200 hover:scale-[1.02] hover:bg-[#FF6B9D] hover:shadow-[0_0_20px_#FF3D7F50]"
              >
                Daftar
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
