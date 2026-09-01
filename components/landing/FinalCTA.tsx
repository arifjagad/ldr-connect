import Link from "next/link";

export function FinalCTA() {
  return (
    <section className="bg-[#FCFBF7] pb-24">
      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="rounded-3xl border border-[#E7E5E4] bg-[#FBF0ED]/40 px-8 py-16 text-center sm:px-16 sm:py-20">
          <h2 className="font-editorial text-3xl font-normal leading-tight tracking-tight text-[#1F1D1B] sm:text-5xl">
            Siap bermain bersama, walau beda <br />
            kota?
          </h2>

          <p className="mx-auto mt-4 max-w-md text-xs leading-relaxed text-[#78716C] sm:text-sm">
            Daftar gratis sekarang juga dan langsung hubungkan akun kalian dalam 2 menit.
            Mulai kencan romantis digital kalian malam ini.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth/register"
              className="rounded-full bg-[#C84B31] px-6 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#B33E26]"
            >
              Buat Akun Sekarang
            </Link>

            <Link
              href="/#features"
              className="rounded-full border border-[#E7E5E4] bg-white px-5 py-2.5 text-xs font-semibold text-[#1F1D1B] shadow-xs transition-all hover:bg-[#F5F5F4]"
            >
              Konsultasi Fitur
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
