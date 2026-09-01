"use client";

import Link from "next/link";
import { useAuthStore } from "@/stores/auth-store";

export function Navbar() {
  const { user } = useAuthStore();

  return (
    <header className="sticky top-0 z-50 border-b border-[#E7E5E4] bg-[#FCFBF7]/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#C84B31] text-xs text-white">
            ♥
          </div>
          <span className="font-semibold tracking-tight text-[#1F1D1B]">
            LDR-Connect
          </span>
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden items-center gap-8 md:flex">
          <Link
            href="/#features"
            className="text-xs font-medium text-[#78716C] transition-colors hover:text-[#1F1D1B]"
          >
            Fitur
          </Link>
          <Link
            href="/#games"
            className="text-xs font-medium text-[#78716C] transition-colors hover:text-[#1F1D1B]"
          >
            Games
          </Link>
          <Link
            href="/#testimonials"
            className="text-xs font-medium text-[#78716C] transition-colors hover:text-[#1F1D1B]"
          >
            Testimoni
          </Link>
          <Link
            href="/#faq"
            className="text-xs font-medium text-[#78716C] transition-colors hover:text-[#1F1D1B]"
          >
            FAQ
          </Link>
        </nav>

        {/* Auth CTA */}
        <div className="flex items-center gap-3">
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-[#C84B31] px-5 py-2 text-xs font-semibold text-white transition-all hover:bg-[#B33E26]"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="px-3 py-1.5 text-xs font-medium text-[#1F1D1B] transition-colors hover:text-[#C84B31]"
              >
                Masuk
              </Link>
              <Link
                href="/auth/register"
                className="rounded-full bg-[#C84B31] px-4.5 py-1.5 text-xs font-medium text-white transition-all hover:bg-[#B33E26]"
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
