import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative mx-auto grid min-h-[90vh] w-full max-w-7xl items-center gap-16 px-6 py-24 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_#FF3D7F15_0%,_transparent_60%)]" />

      {/* Left: Copy */}
      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#FF3D7F20] bg-[#FF3D7F10] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[#FF6B9D]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF3D7F]" />
          Platform #1 untuk pasangan LDR
        </div>

        <h1 className="mt-8 text-6xl font-bold leading-[1.1] tracking-tight text-[#F5F0FF] lg:text-8xl">
          Main bareng,
          <br />
          walau <span className="text-[#FF3D7F]">beda</span>
          <br />
          kota.
        </h1>

        <p className="mt-6 max-w-md text-base leading-relaxed text-[#9B93B0]">
          Mini-games romantis, sistem coin fleksibel, dan sesi permainan real-time — dirancang
          khusus untuk pasangan jarak jauh.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/auth/register"
            className="rounded-full bg-[#FF3D7F] px-6 py-3 font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-[#FF6B9D]"
          >
            Mulai Sekarang →
          </Link>
          <Link
            href="/games"
            className="rounded-full border border-white/20 px-6 py-3 font-semibold text-[#F5F0FF] transition-all duration-200 hover:border-white/40"
          >
            Lihat Games
          </Link>
        </div>

        <p className="mt-8 text-sm text-[#5C5470]">500+ pasangan aktif bermain setiap hari</p>
      </div>

      {/* Right: Game card mockup */}
      <div className="relative z-10 flex justify-center lg:justify-end">
        <div className="w-full max-w-sm rounded-2xl border border-[#FF3D7F15] bg-[#141417] p-6">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FF3D7F10] px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-[#FF6B9D]">
              Truth or Dare
            </div>
            <span className="text-xs text-[#5C5470]">Giliran kamu</span>
          </div>

          <div className="mt-5 rounded-xl border border-white/5 bg-[#1C1C21] p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#FF3D7F]">
              Truth
            </p>
            <p className="text-base font-medium leading-relaxed text-[#F5F0FF]">
              Apa hal pertama yang kamu perhatikan dari aku?
            </p>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#FF3D7F]/40 bg-[#FF3D7F]/20 text-xs font-bold text-[#FF6B9D]">
                A
              </div>
              <div>
                <p className="text-xs font-medium text-[#F5F0FF]">Andi</p>
                <p className="text-xs text-[#5C5470]">Menjawab</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
              <span className="text-xs text-[#9B93B0]">Live</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs font-medium text-[#F5F0FF]">Sari</p>
                <p className="text-xs text-[#5C5470]">Menunggu</p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-fuchsia-500/40 bg-fuchsia-500/20 text-xs font-bold text-fuchsia-300">
                S
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button className="rounded-xl bg-[#FF3D7F] py-2.5 text-sm font-semibold text-white transition hover:bg-[#FF6B9D]">
              Truth
            </button>
            <button className="rounded-xl border border-white/10 bg-[#1C1C21] py-2.5 text-sm font-semibold text-[#9B93B0] transition hover:border-white/20 hover:text-[#F5F0FF]">
              Dare
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
