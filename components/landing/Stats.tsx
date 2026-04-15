const stats = [
  { value: "500+", label: "Pasangan aktif", sub: "dan terus bertambah" },
  { value: "3", label: "Game tersedia", sub: "lebih banyak segera" },
  { value: "10K+", label: "Sesi dimainkan", sub: "setiap bulannya" },
  { value: "100%", label: "Gratis daftar", sub: "bayar cukup coin" },
];

export function Stats() {
  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-20 lg:px-8">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={i}
            className="group rounded-2xl border border-[#FF3D7F15] bg-[#111113] p-6 transition-all duration-300 hover:border-[#FF3D7F40] hover:bg-[#FF3D7F08]"
          >
            <p className="text-4xl font-black text-[#FF3D7F] lg:text-5xl">{s.value}</p>
            <p className="mt-2 text-sm font-bold text-[#FFF5F8]">{s.label}</p>
            <p className="mt-0.5 text-xs text-[#5C5470]">{s.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
