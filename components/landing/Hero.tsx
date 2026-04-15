import Link from "next/link";

export function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[#0A0A0B]">
      {/* Background layers */}
      <div
        className="pointer-events-none absolute -left-60 -top-60 h-[700px] w-[700px] rounded-full animate-glow-pulse"
        style={{ background: "radial-gradient(circle, #FF3D7F 0%, transparent 70%)", opacity: 0.14 }}
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full"
        style={{ background: "radial-gradient(circle, #FF3D7F 0%, transparent 70%)", opacity: 0.06 }}
      />
      {/* Dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: "radial-gradient(circle, #FF3D7F18 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />
      {/* Watermark */}
      <div className="pointer-events-none absolute bottom-0 right-0 select-none text-[18rem] font-black leading-none text-[#FF3D7F] opacity-[0.03]">
        LDR
      </div>

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl items-center gap-16 px-6 pb-24 pt-20 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
        {/* ── Left copy ── */}
        <div>
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-[#FF3D7F40] bg-[#FF3D7F15] px-5 py-2.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#FF3D7F]" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF6B9D]">
              Platform #1 untuk pasangan LDR
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-black leading-[1.0] tracking-tight text-[#FFF5F8]">
            <span className="block text-6xl lg:text-[6rem]">Main <span className="text-[#FF3D7F]">bareng,</span></span>
            <span className="block text-6xl lg:text-[6rem]">walau beda</span>
            <span
              className="block text-6xl lg:text-[6rem]"
              style={{
                WebkitTextStroke: "2px #FF3D7F",
                color: "transparent",
              }}
            >
              kota.
            </span>
          </h1>

          <p className="mt-8 max-w-md text-lg leading-relaxed text-[#9B93B0]">
            Mini-games romantis, sistem coin fleksibel, sesi real-time — semuanya untuk kalian
            yang terpisah jarak, tapi dekat di hati.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/auth/register"
              className="group inline-flex items-center gap-2 rounded-full bg-[#FF3D7F] px-8 py-4 text-sm font-bold text-white shadow-[0_0_0_0_#FF3D7F] transition-all duration-300 hover:bg-[#FF6B9D] hover:shadow-[0_0_32px_#FF3D7F60]"
            >
              Mulai Gratis
              <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </Link>
            <Link
              href="/games"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-8 py-4 text-sm font-bold text-[#FFF5F8] transition-all duration-300 hover:border-[#FF3D7F50] hover:bg-[#FF3D7F08]"
            >
              Lihat Games
            </Link>
          </div>

          {/* Social proof */}
          <div className="mt-12 flex items-center gap-4">
            <div className="flex -space-x-2.5">
              {["A", "S", "R", "M", "D"].map((l, i) => (
                <div
                  key={i}
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#0A0A0B] text-xs font-bold text-white"
                  style={{ background: `linear-gradient(135deg, #FF3D7F, #c026a0)`, zIndex: 5 - i }}
                >
                  {l}
                </div>
              ))}
            </div>
            <div>
              <p className="text-sm font-semibold text-[#FFF5F8]">500+ pasangan aktif</p>
              <p className="text-xs text-[#5C5470]">bergabung bulan ini</p>
            </div>
          </div>
        </div>

        {/* ── Right: floating game mockup ── */}
        <div className="relative flex justify-center lg:justify-end">
          {/* Glow halo */}
          <div className="absolute inset-4 rounded-3xl bg-[#FF3D7F] opacity-20 blur-3xl" />

          <div className="animate-float relative w-full max-w-[340px] rounded-2xl border border-[#FF3D7F25] bg-[#111113] p-5 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF3D7F20] text-lg">
                  🎲
                </div>
                <div>
                  <p className="text-xs font-bold text-[#FFF5F8]">Truth or Dare</p>
                  <p className="text-[10px] text-[#5C5470]">Sesi #4892</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                <span className="text-[10px] font-bold text-green-400">LIVE</span>
              </div>
            </div>

            {/* Question */}
            <div className="mt-4 rounded-xl border border-[#FF3D7F20] bg-gradient-to-br from-[#FF3D7F12] to-[#18181C] p-4">
              <div className="mb-2.5 flex items-center gap-2">
                <span className="rounded-full bg-[#FF3D7F] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                  Truth
                </span>
                <span className="text-[10px] text-[#5C5470]">Kategori: Romantis</span>
              </div>
              <p className="text-sm font-semibold leading-relaxed text-[#FFF5F8]">
                Apa hal pertama yang kamu perhatikan dari aku?
              </p>
            </div>

            {/* Players */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded-xl bg-[#FF3D7F12] border border-[#FF3D7F20] p-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FF3D7F] text-xs font-bold text-white">
                  A
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#FFF5F8]">Andi</p>
                  <p className="text-[10px] font-medium text-[#FF6B9D]">● Giliran</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-[#18181C] p-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-fuchsia-600/30 text-xs font-bold text-fuchsia-300">
                  S
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#FFF5F8]">Sari</p>
                  <p className="text-[10px] text-[#5C5470]">Menunggu</p>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="rounded-xl bg-[#FF3D7F] py-3 text-xs font-black text-white transition hover:bg-[#FF6B9D]">
                Truth ✓
              </button>
              <button className="rounded-xl border border-white/8 bg-[#18181C] py-3 text-xs font-bold text-[#9B93B0] transition hover:border-[#FF3D7F30] hover:text-[#FFF5F8]">
                Dare ⚡
              </button>
            </div>

            {/* Progress bar */}
            <div className="mt-3 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#18181C]">
                <div
                  className="h-full rounded-full"
                  style={{ width: "60%", background: "linear-gradient(90deg, #FF3D7F, #FF6B9D)" }}
                />
              </div>
              <span className="text-[10px] font-semibold text-[#5C5470]">6/10</span>
            </div>
          </div>

          {/* Floating badge 1 */}
          <div
            className="absolute -left-4 top-8 rounded-xl border border-[#FF3D7F20] bg-[#111113] px-3 py-2 shadow-xl"
            style={{ animationDelay: "1s" }}
          >
            <p className="text-[10px] font-semibold text-[#5C5470]">Pertanyaan AI</p>
            <p className="text-xs font-bold text-[#FF6B9D]">✨ Generated</p>
          </div>

          {/* Floating badge 2 */}
          <div className="absolute -right-4 bottom-16 rounded-xl border border-[#FF3D7F20] bg-[#111113] px-3 py-2 shadow-xl">
            <p className="text-[10px] font-semibold text-[#5C5470]">Coin terpakai</p>
            <p className="text-xs font-bold text-[#FFF5F8]">🪙 1 Coin</p>
          </div>
        </div>
      </div>
    </section>
  );
}
