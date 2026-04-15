"use client";

import { useState } from "react";

const faqs = [
  {
    q: "Apa itu LDR-Connect?",
    a: "LDR-Connect adalah platform game online khusus untuk pasangan yang menjalani hubungan jarak jauh. Kami menyediakan mini-games romantis seperti Truth or Dare yang bisa dimainkan bersama secara real-time, kapanpun dan dimanapun.",
  },
  {
    q: "Bagaimana sistem coin bekerja?",
    a: "Kamu beli coin sekali, lalu gunakan untuk memulai sesi game. Tidak ada biaya langganan bulanan. 1 sesi Truth or Dare cukup 1 coin. Tersedia paket 20, 50, 100, hingga 200 coin sesuai kebutuhan.",
  },
  {
    q: "Apakah pasangan saya juga harus punya akun?",
    a: "Ya, pasanganmu perlu daftar akun juga. Setelah itu, kalian bisa saling link menggunakan couple code — kode unik 10 karakter yang digenerate otomatis untuk akunmu. Proses linking cukup satu kali.",
  },
  {
    q: "Apakah pertanyaan di Truth or Dare selalu sama?",
    a: "Tidak! Pertanyaan diambil dari pool yang terus bertambah — ada dari admin, dari komunitas user (setelah disetujui), dan yang di-generate oleh AI secara unik. Kamu juga bisa submit pertanyaan sendiri.",
  },
  {
    q: "Bagaimana cara memulai sesi game?",
    a: "Setelah akun kalian ter-link, masuk ke Dashboard → Games → pilih Truth or Dare → buat sesi baru. Kamu akan dapat kode sesi yang bisa dibagikan ke pasangan untuk join. Sesi langsung dimulai saat pasangan bergabung.",
  },
  {
    q: "Apa yang terjadi jika pasangan tidak join dalam 10 menit?",
    a: "Tenang, coinmu aman! Jika pasangan tidak join dalam 10 menit setelah sesi dibuat, coin yang dipotong di awal akan dikembalikan otomatis ke dompetmu.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-20 lg:px-8">
      <div className="mb-10">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#FF6B9D]">
          ✦ FAQ
        </p>
        <h2 className="text-4xl font-black leading-[1.05] tracking-tight text-[#FFF5F8] lg:text-5xl">
          Masih ada
          <br />
          pertanyaan? <span className="text-[#FF3D7F]">Ini</span>
          <br />
          <span className="text-[#FF3D7F]">jawabannya.</span>
        </h2>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <div
            key={i}
            className={`overflow-hidden rounded-2xl border transition-all duration-300 ${
              open === i
                ? "border-[#FF3D7F40] bg-[#FF3D7F08]"
                : "border-[#FF3D7F12] bg-[#111113] hover:border-[#FF3D7F25]"
            }`}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between px-6 py-5 text-left"
              onClick={() => setOpen(open === i ? null : i)}
            >
              <span className="pr-8 text-sm font-bold text-[#FFF5F8]">{faq.q}</span>
              <span
                className={`flex-shrink-0 text-[#FF3D7F] transition-transform duration-300 ${
                  open === i ? "rotate-45" : "rotate-0"
                }`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </span>
            </button>

            {open === i && (
              <div className="px-6 pb-5">
                <p className="text-sm leading-relaxed text-[#9B93B0]">{faq.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
