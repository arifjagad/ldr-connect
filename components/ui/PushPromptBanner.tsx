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
    if (ok) setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="alertdialog"
      aria-label="Aktifkan notifikasi push"
      className="fixed top-20 left-4 right-4 z-50 mx-auto max-w-sm animate-slide-in-right sm:left-auto sm:right-4 sm:max-w-xs"
    >
      <div className="overflow-hidden rounded-2xl border border-[#818CF8]/25 bg-[#0E0E12]/95 shadow-2xl shadow-[#818CF8]/10 backdrop-blur-md">
        {/* Top accent */}
        <div className="h-0.5 bg-linear-to-r from-[#FF3D7F] to-[#818CF8]" />

        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#818CF8]/15">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="1.8">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#FFF5F8]">
                Aktifkan Notifikasi 🔔
              </p>
              <p className="mt-0.5 text-xs text-[#5C5470] leading-relaxed">
                Dapat notif langsung saat partner mengajakmu main — bahkan saat tab ditutup.
              </p>
            </div>

            {/* Close */}
            <button
              type="button"
              onClick={handleDismiss}
              className="shrink-0 rounded-lg p-1 text-[#5C5470] transition hover:bg-white/5 hover:text-[#9B93B0]"
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
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#818CF8] py-2 text-xs font-bold text-white shadow-[0_4px_12px_rgba(129,140,248,0.3)] transition hover:bg-[#A78BFA] disabled:opacity-60"
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
              className="rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-medium text-[#9B93B0] transition hover:bg-white/10"
            >
              Nanti
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
