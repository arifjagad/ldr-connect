import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-[#E7E5E4] bg-[#FCFBF7] py-14 text-xs text-[#78716C]">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          {/* Brand Col */}
          <div className="max-w-xs">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#C84B31] text-[10px] text-white">
                ♥
              </div>
              <span className="text-sm font-semibold tracking-tight text-[#1F1D1B]">
                LDR-Connect
              </span>
            </Link>
            <p className="mt-3 text-xs leading-relaxed text-[#78716C]">
              Mendekatkan hati yang terpisah jarak lewat kencan mini-game interaktif yang seru dan romantis.
            </p>
          </div>

          {/* Nav Cols */}
          <div className="grid grid-cols-3 gap-8 sm:gap-14">
            <div>
              <span className="text-[11px] font-bold tracking-wider text-[#1F1D1B] uppercase">
                Fitur
              </span>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link href="/dashboard/games/tod" className="hover:text-[#1F1D1B]">
                    Truth or Dare
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/games/snake-ladder" className="hover:text-[#1F1D1B]">
                    Snake & Ladder
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/games/dare-derby" className="hover:text-[#1F1D1B]">
                    Dare Derby
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <span className="text-[11px] font-bold tracking-wider text-[#1F1D1B] uppercase">
                Komunitas
              </span>
              <ul className="mt-3 space-y-2">
                <li>
                  <span className="cursor-pointer hover:text-[#1F1D1B]">Instagram</span>
                </li>
                <li>
                  <span className="cursor-pointer hover:text-[#1F1D1B]">TikTok</span>
                </li>
                <li>
                  <span className="cursor-pointer hover:text-[#1F1D1B]">Grup WhatsApp</span>
                </li>
              </ul>
            </div>

            <div>
              <span className="text-[11px] font-bold tracking-wider text-[#1F1D1B] uppercase">
                Dukungan
              </span>
              <ul className="mt-3 space-y-2">
                <li>
                  <span className="cursor-pointer hover:text-[#1F1D1B]">Hubungi Kami</span>
                </li>
                <li>
                  <span className="cursor-pointer hover:text-[#1F1D1B]">Kebijakan Privasi</span>
                </li>
                <li>
                  <span className="cursor-pointer hover:text-[#1F1D1B]">Syarat Ketentuan</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[#E7E5E4] pt-6 sm:flex-row text-[11px] text-[#A8A29E]">
          <p>© 2026 LDR-Connect. Dibuat dengan cinta untuk semua pejuang jarak.</p>
          <div className="flex items-center gap-4 text-[#78716C]">
            <span className="cursor-pointer hover:text-[#1F1D1B]">Instagram</span>
            <span>•</span>
            <span className="cursor-pointer hover:text-[#1F1D1B]">Twitter</span>
            <span>•</span>
            <span className="cursor-pointer hover:text-[#1F1D1B]">YouTube</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
