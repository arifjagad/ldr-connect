import Link from "next/link";

export function Games() {
  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-20 lg:px-8">
      {/* Section header */}
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#FF6B9D]">
            ✦ Game Tersedia
          </p>
          <h2 className="text-4xl font-black leading-[1.05] tracking-tight text-[#FFF5F8] lg:text-5xl">
            Satu platform,
            <br />
            banyak cara{" "}
            <span className="text-[#FF3D7F]">dekat.</span>
          </h2>
        </div>
        <Link
          href="/games"
          className="self-start rounded-full border border-[#FF3D7F40] bg-[#FF3D7F10] px-5 py-2.5 text-sm font-bold text-[#FF6B9D] transition-all hover:bg-[#FF3D7F20] sm:self-auto"
        >
          Lihat semua →
        </Link>
      </div>

      {/* Bento grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Truth or Dare — big card spanning 2 rows */}
        <div className="group relative overflow-hidden rounded-2xl border border-[#FF3D7F30] bg-[#111113] p-6 transition-all duration-300 hover:border-[#FF3D7F60] md:row-span-2">
          {/* Pink glow inside */}
          <div
            className="pointer-events-none absolute -bottom-20 -right-20 h-60 w-60 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
            style={{ background: "#FF3D7F" }}
          />

          <div className="relative flex h-full flex-col">
            <div className="mb-5 inline-flex items-center gap-2 self-start rounded-full bg-[#FF3D7F] px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              Tersedia
            </div>

            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#FF3D7F30] bg-[#FF3D7F15] text-3xl">
              🎲
            </div>

            <h3 className="mb-2 text-2xl font-black text-[#FFF5F8]">Truth or Dare</h3>
            <p className="text-sm font-medium text-[#FF6B9D]">Jujur atau terima tantangan</p>

            <p className="mt-4 flex-1 text-sm leading-relaxed text-[#9B93B0]">
              Pertanyaan romantis dan tantangan seru yang dibuat khusus untuk pasangan. Ada
              pertanyaan dari admin, komunitas, dan bahkan AI — setiap sesi selalu berbeda.
            </p>

            <div className="mt-6 space-y-2">
              {["Pertanyaan dari AI & admin", "Tambah pertanyaan sendiri", "Sesi real-time berdua", "Banyak kategori unik"].map(
                (f) => (
                  <div key={f} className="flex items-center gap-2 text-xs text-[#9B93B0]">
                    <span className="h-1 w-4 rounded-full bg-[#FF3D7F]" />
                    {f}
                  </div>
                )
              )}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#5C5470]">Mulai dari</p>
                <p className="text-lg font-black text-[#FF3D7F]">1 Coin / Sesi</p>
              </div>
              <Link
                href="/dashboard/games/tod"
                className="rounded-full bg-[#FF3D7F] px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#FF6B9D] hover:shadow-[0_0_20px_#FF3D7F50]"
              >
                Main sekarang
              </Link>
            </div>
          </div>
        </div>

        {/* Snake & Ladder */}
        <div className="relative overflow-hidden rounded-2xl border border-white/6 bg-[#111113] p-6 opacity-70 md:col-span-2">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-white/8 bg-white/4 text-2xl grayscale">
              🐍
            </div>
            <div className="flex-1">
              <div className="mb-2 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#5C5470]">
                Segera Hadir
              </div>
              <h3 className="text-lg font-black text-[#FFF5F8]">Snake & Ladder Date Night</h3>
              <p className="mt-1 text-sm text-[#9B93B0]">
                Ular tangga edisi romantis — date ideas dan tantangan di setiap kotak.
              </p>
            </div>
          </div>
          {/* Lock overlay hint */}
          <div className="absolute right-4 top-4 rounded-full border border-white/8 bg-white/5 p-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5C5470" strokeWidth="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        </div>

        {/* Couple Quiz */}
        <div className="relative overflow-hidden rounded-2xl border border-white/6 bg-[#111113] p-6 opacity-70 md:col-span-2">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-white/8 bg-white/4 text-2xl grayscale">
              🧠
            </div>
            <div className="flex-1">
              <div className="mb-2 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#5C5470]">
                Segera Hadir
              </div>
              <h3 className="text-lg font-black text-[#FFF5F8]">Couple Quiz Battle</h3>
              <p className="mt-1 text-sm text-[#9B93B0]">
                Buktikan seberapa baik kamu mengenal pasanganmu lewat pertanyaan seru.
              </p>
            </div>
          </div>
          <div className="absolute right-4 top-4 rounded-full border border-white/8 bg-white/5 p-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5C5470" strokeWidth="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
