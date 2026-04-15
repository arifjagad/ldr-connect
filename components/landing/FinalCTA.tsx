import Link from "next/link";

export function FinalCTA() {
  return (
    <section className="mx-auto w-full max-w-7xl px-6 pb-20 lg:px-8">
      {/* Gradient border wrapper */}
      <div
        className="rounded-3xl p-px"
        style={{
          background:
            "linear-gradient(135deg, #FF3D7F60 0%, #FF3D7F10 40%, transparent 60%, #FF3D7F25 100%)",
        }}
      >
        <div className="relative overflow-hidden rounded-3xl bg-[#0D0A10] px-8 py-20 text-center lg:px-16 lg:py-28">
          {/* Glow from top-center */}
          <div
            className="pointer-events-none absolute left-1/2 top-0 h-56 w-[600px] -translate-x-1/2 rounded-full blur-3xl"
            style={{ background: "#FF3D7F", opacity: 0.18 }}
          />
          {/* Glow bottom-right */}
          <div
            className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full blur-3xl"
            style={{ background: "#FF3D7F", opacity: 0.1 }}
          />
          {/* Dot texture */}
          <div
            className="pointer-events-none absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                "radial-gradient(circle, #FF3D7F18 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          {/* Watermark */}
          <div className="pointer-events-none absolute bottom-0 right-6 select-none text-[9rem] font-black leading-none text-[#FF3D7F] opacity-[0.06]">
            ♥
          </div>

          <div className="relative">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#FF3D7F30] bg-[#FF3D7F10] px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#FF6B9D]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF3D7F]" />
              Tunggu apa lagi?
            </div>

            <h2 className="text-5xl font-black leading-[1.05] tracking-tight text-[#FFF5F8] lg:text-7xl">
              Siap main
              <br />
              <span className="text-[#FF3D7F]">bareng?</span>
            </h2>

            <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-[#9B93B0]">
              Daftar gratis, link pasanganmu, dan mulai sesi pertama kalian hari ini. Jarak bukan
              lagi alasan untuk gak quality time.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-2 rounded-full bg-[#FF3D7F] px-8 py-4 text-sm font-black text-white transition-all duration-300 hover:scale-[1.02] hover:bg-[#FF6B9D] hover:shadow-[0_0_32px_#FF3D7F50]"
              >
                Mulai Gratis Sekarang →
              </Link>
              <Link
                href="/games"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-8 py-4 text-sm font-bold text-[#FFF5F8] transition-all duration-300 hover:border-[#FF3D7F40] hover:bg-[#FF3D7F08]"
              >
                Lihat Games Dulu
              </Link>
            </div>

            <p className="mt-8 text-xs text-[#5C5470]">
              Tidak perlu kartu kredit · Gratis daftar · Bayar cukup coin
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
