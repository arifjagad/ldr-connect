export function Features() {
  const featureList = [
    {
      title: "Sesi Real-time",
      desc: "Setiap gerakan dadu dan pilihan kartu disinkronkan dalam waktu milidetik secara instan.",
      icon: (
        <svg className="h-5 w-5 text-[#C84B31]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      ),
    },
    {
      title: "Pertanyaan AI",
      desc: "Butuh topik baru? AI generator kami menciptakan pertanyaan khusus berdasarkan dinamika LDR kalian.",
      icon: (
        <svg className="h-5 w-5 text-[#C84B31]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      ),
    },
    {
      title: "Sistem Koin Adil",
      desc: "Main tanpa biaya langganan bulanan. Cukup klaim koin harian gratis atau top-up seperlunya.",
      icon: (
        <svg className="h-5 w-5 text-[#C84B31]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
      ),
    },
    {
      title: "Couple Linking",
      desc: "Hubungkan akun kamu secara privat dan aman dengan pasangan hanya menggunakan satu kode unik.",
      icon: (
        <svg className="h-5 w-5 text-[#C84B31]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      ),
    },
    {
      title: "Anniversary Tracker",
      desc: "Pengingat otomatis hari-hari penting dan milestone hubungan kalian agar momen spesial tak pernah terlewat.",
      icon: (
        <svg className="h-5 w-5 text-[#C84B31]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      ),
    },
    {
      title: "Custom Questions",
      desc: "Buat deck pertanyaan pribadi dan simpan rahasia manis yang ingin kamu tanyakan malam ini.",
      icon: (
        <svg className="h-5 w-5 text-[#C84B31]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
      ),
    },
  ];

  return (
    <section className="bg-[#FCFBF7] py-20 lg:py-24">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="text-left">
          <span className="text-[10px] font-semibold tracking-wider text-[#C84B31] uppercase">
            Fitur Unggulan
          </span>
          <h2 className="font-editorial mt-3 text-3xl font-normal tracking-tight text-[#1F1D1B] sm:text-4xl">
            Dibuat serius, buat pasangan serius.
          </h2>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featureList.map((item, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-xs transition-all duration-200 hover:border-[#D6D3D1] hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FBF0ED]">
                {item.icon}
              </div>
              <h3 className="mt-5 text-sm font-bold text-[#1F1D1B]">
                {item.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[#78716C]">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
