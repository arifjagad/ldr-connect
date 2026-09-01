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
      <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-600">
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
        className={`flex h-8 w-8 items-center justify-center rounded-lg border transition cursor-pointer ${
          isOn
            ? "border-[#C84B31] bg-[#FDF4F2] text-[#C84B31]"
            : "border-[#E7E5E4] bg-white text-[#78716C] hover:text-[#1F1D1B]"
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
    <div className="flex items-center justify-between rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${isOn ? "border-[#E7E5E4] bg-[#FDF4F2] text-[#C84B31]" : "border-[#E7E5E4] bg-white text-[#78716C]"}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-bold text-[#1F1D1B]">Notifikasi Push</p>
          <p className="text-[11px] text-[#78716C]">
            {isOn ? "Aktif — kamu akan dapat notifikasi saat partner join game" : "Aktifkan agar dapat info saat partner bergabung"}
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
          isOn ? "bg-[#C84B31]" : "bg-[#E7E5E4]"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ${
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
