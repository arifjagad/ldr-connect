"use client";

import { usePushSubscription } from "@/hooks/usePushSubscription";

/**
 * Tombol toggle notifikasi push.
 * Bisa dipasang di settings page atau di header.
 */
export function PushNotificationToggle({ compact = false }: { compact?: boolean }) {
  const { status, loading, subscribe, unsubscribe } = usePushSubscription();

  if (status === "unsupported") return null;

  const isOn = status === "subscribed";
  const isDenied = status === "denied";

  if (isDenied) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-300">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
        Notifikasi diblokir di browser
      </div>
    );
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={isOn ? unsubscribe : subscribe}
        disabled={loading}
        title={isOn ? "Matikan notifikasi" : "Aktifkan notifikasi"}
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
          isOn
            ? "bg-[#FF3D7F]/15 text-[#FF6B9D] hover:bg-[#FF3D7F]/25"
            : "bg-white/5 text-[#5C5470] hover:bg-white/10 hover:text-[#9B93B0]"
        }`}
      >
        {loading ? (
          <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
          </svg>
        ) : isOn ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-[#111113] px-5 py-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${isOn ? "bg-[#FF3D7F]/15" : "bg-white/5"}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isOn ? "#FF6B9D" : "#5C5470"} strokeWidth="1.8">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-[#FFF5F8]">Notifikasi Push</p>
          <p className="text-xs text-[#5C5470]">
            {isOn ? "Aktif — kamu akan dapat notif saat partner join game" : "Aktifkan untuk notif saat partner join game"}
          </p>
        </div>
      </div>

      {/* Toggle switch */}
      <button
        type="button"
        onClick={isOn ? unsubscribe : subscribe}
        disabled={loading}
        role="switch"
        aria-checked={isOn}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
          isOn ? "bg-[#FF3D7F]" : "bg-white/10"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ${
            isOn ? "translate-x-5" : "translate-x-0"
          }`}
        />
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <svg className="animate-spin text-white" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
            </svg>
          </span>
        )}
      </button>
    </div>
  );
}
