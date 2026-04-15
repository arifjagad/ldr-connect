import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#0A0A0B]">
      <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          {/* Brand */}
          <div className="max-w-xs">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-base font-black text-[#FFF5F8]">LDR-Connect</span>
              <span className="h-2 w-2 rounded-full bg-[#FF3D7F]" />
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-[#5C5470]">
              Platform game couple #1 untuk pasangan jarak jauh. Main bareng, walau beda kota.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-16">
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[#FF6B9D]">
                Platform
              </p>
              <div className="space-y-3">
                <Link
                  href="/games"
                  className="block text-sm text-[#5C5470] transition-colors hover:text-[#9B93B0]"
                >
                  Games
                </Link>
                <Link
                  href="/auth/register"
                  className="block text-sm text-[#5C5470] transition-colors hover:text-[#9B93B0]"
                >
                  Daftar
                </Link>
                <Link
                  href="/auth/login"
                  className="block text-sm text-[#5C5470] transition-colors hover:text-[#9B93B0]"
                >
                  Masuk
                </Link>
              </div>
            </div>
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[#FF6B9D]">
                Game
              </p>
              <div className="space-y-3">
                <span className="block text-sm text-[#5C5470]">Truth or Dare</span>
                <span className="block text-sm text-[#5C5470]">Snake & Ladder</span>
                <span className="block text-sm text-[#5C5470]">Couple Quiz</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 sm:flex-row">
          <p className="text-xs text-[#5C5470]">© 2025 LDR-Connect. Made with ♥ for couples.</p>
          <div className="flex items-center gap-2 rounded-full border border-[#FF3D7F20] bg-[#FF3D7F08] px-3 py-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF3D7F]" />
            <span className="text-xs font-semibold text-[#FF6B9D]">500+ pasangan aktif</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
