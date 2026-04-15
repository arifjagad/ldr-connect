const packages = [
  { coin: 20, price: "Rp20.000", featured: false },
  { coin: 50, price: "Rp45.000", featured: true },
  { coin: 100, price: "Rp85.000", featured: false },
  { coin: 200, price: "Rp160.000", featured: false },
];

export function CoinSection() {
  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
      <div className="rounded-2xl border border-[#FF3D7F15] bg-[#141417] p-10 lg:p-16">
        <div className="max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#FF3D7F20] bg-[#FF3D7F10] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[#FF6B9D]">
            Sistem Coin
          </div>
          <h2 className="mb-4 text-4xl font-bold leading-[1.1] tracking-tight text-[#F5F0FF] lg:text-5xl">
            Bayar hanya
            <br />
            saat mau main.
          </h2>
          <p className="text-base leading-relaxed text-[#9B93B0]">
            Tidak ada biaya berlangganan. Beli coin sesuai kebutuhan dan gunakan kapanpun kamu siap
            bermain bersama pasangan.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          {packages.map((pkg) => (
            <div
              key={pkg.coin}
              className={`rounded-full px-6 py-3 text-sm font-semibold transition-all ${
                pkg.featured
                  ? "border border-[#FF3D7F] bg-[#FF3D7F] text-white"
                  : "border border-[#1C1C21] bg-[#1C1C21] text-[#9B93B0] hover:border-[#FF3D7F30] hover:text-[#F5F0FF]"
              }`}
            >
              {pkg.coin} Coin — {pkg.price}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
