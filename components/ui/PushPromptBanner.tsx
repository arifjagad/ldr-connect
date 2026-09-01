"use client";

import { useEffect, useRef, useState } from "react";
import { usePushSubscription } from "@/hooks/usePushSubscription";

const DISMISSED_KEY = "ldr-push-prompt-dismissed";

export function PushPromptBanner() {
  const { status, loading, subscribe } = usePushSubscription();
  const [visible, setVisible] = useState(false);
  const initialized = useRef(false);

  // Jalankan SEKALI saja setelah mount (bukan reaktif ke status)
  // Cek permission langsung dari browser agar tidak terpengaruh async SW init
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (!("Notification" in window)) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    // Delay agar tidak interrupt loading awal, dan cek permission saat itu
    const t = setTimeout(() => {
      // Jika sudah granted atau denied, tidak perlu prompt
      if (Notification.permission !== "default") return;
      setVisible(true);
    }, 2500); // Lebih lama dari skeleton loading (~1-2 detik)

    return () => clearTimeout(t);
  }, []); // <- empty deps: jalan sekali, tidak terpengaruh perubahan status

  // Sembunyikan jika berhasil subscribe
  useEffect(() => {
    if (status === "subscribed") setVisible(false);
  }, [status]);

  function handleDismiss() {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  }

  async function handleActivate() {
    const ok = await subscribe();
    if (ok) {
      localStorage.removeItem(DISMISSED_KEY); // bersihkan flag agar tidak blocking di sesi berikutnya
      setVisible(false);
    }
  }

  if (!visible) return null;

  return (
    <div
      role="alertdialog"
      aria-label="Aktifkan notifikasi push"
      className="fixed top-20 left-4 right-4 z-50 animate-slide-in-right sm:left-auto sm:right-4 sm:w-80"
    >
      <div className="overflow-hidden rounded-2xl border border-[#E7E5E4] bg-white shadow-2xl shadow-black/10 backdrop-blur-md">
        {/* Top accent */}
        <div className="h-1 bg-[#C84B31]" />

        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FDF4F2] border border-[#FBDCD5] text-[#C84B31]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-serif font-bold text-[#1F1D1B]">
                Aktifkan Notifikasi 🔔
              </p>
              <p className="mt-0.5 text-[11px] text-[#78716C] leading-relaxed">
                Dapat notif langsung saat partner mengajak main game — bahkan saat tab ditutup.
              </p>
            </div>

            {/* Close */}
            <button
              type="button"
              onClick={handleDismiss}
              className="shrink-0 rounded-lg p-1 text-[#78716C] transition hover:bg-[#FCFBF7] hover:text-[#1F1D1B] cursor-pointer"
              aria-label="Tutup"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Actions */}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleActivate}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#C84B31] py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#B33E26] disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {loading ? "Mengaktifkan..." : "Aktifkan"}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-xl border border-[#E7E5E4] bg-white px-3 text-xs font-semibold text-[#78716C] transition hover:bg-[#FCFBF7] hover:text-[#1F1D1B] cursor-pointer shadow-2xs"
            >
              Nanti
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
