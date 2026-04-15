const features = [
  {
    icon: "⚡",
    title: "Real-time",
    desc: "Sesi game berjalan secara live — setiap gerakan pasangan langsung kamu lihat.",
    pink: true,
  },
  {
    icon: "🤖",
    title: "Pertanyaan AI",
    desc: "Gemini AI generate pertanyaan unik setiap saat, gak bakal bosen.",
    pink: false,
  },
  {
    icon: "🪙",
    title: "Sistem Coin",
    desc: "Bayar cuma pas mau main. Gak ada biaya langganan bulanan tersembunyi.",
    pink: false,
  },
  {
    icon: "💑",
    title: "Couple Linking",
    desc: "Terhubung dengan pasangan lewat satu kode unik. Simpel, cepat, aman.",
    pink: false,
  },
  {
    icon: "📅",
    title: "Anniversary",
    desc: "Ingat semua momen penting kalian — ulang tahun, hari jadian, dan lainnya.",
    pink: false,
  },
  {
    icon: "✍️",
    title: "Custom Questions",
    desc: "Submit pertanyaan sendiri untuk sesi yang lebih personal dan bermakna.",
    pink: true,
  },
];

export function Features() {
  return (
    <section className="relative overflow-hidden py-20">
      {/* Pink section tint */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#FF3D7F06_0%,_transparent_70%)]" />

      <div className="relative mx-auto w-full max-w-7xl px-6 lg:px-8">
        <div className="mb-10">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#FF6B9D]">
            ✦ Fitur Unggulan
          </p>
          <h2 className="text-4xl font-black leading-[1.05] tracking-tight text-[#FFF5F8] lg:text-5xl">
            Dibuat serius,
            <br />
            buat pasangan <span className="text-[#FF3D7F]">serius.</span>
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <div
              key={i}
              className={`group rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-0.5 ${
                f.pink
                  ? "border-[#FF3D7F30] bg-gradient-to-br from-[#FF3D7F15] to-[#111113] hover:border-[#FF3D7F60]"
                  : "border-[#FF3D7F10] bg-[#111113] hover:border-[#FF3D7F30]"
              }`}
            >
              <div
                className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-xl ${
                  f.pink ? "bg-[#FF3D7F20]" : "bg-[#18181C]"
                }`}
              >
                {f.icon}
              </div>
              <h3 className="mb-2 text-base font-black text-[#FFF5F8]">{f.title}</h3>
              <p className="text-sm leading-relaxed text-[#9B93B0]">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
