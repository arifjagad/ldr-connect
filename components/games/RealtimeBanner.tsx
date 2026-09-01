"use client";

import { useState } from "react";

interface RealtimeBannerProps {
  /** false = koneksi terputus, tampilkan banner */
  realtimeOk: boolean;
  /** Callback untuk reconnect manual */
  onReconnect?: () => void;
}

/**
 * Banner yang muncul di bagian atas game saat koneksi realtime terputus.
 * Memberikan feedback jelas ke user + tombol reconnect.
 */
export function RealtimeBanner({ realtimeOk, onReconnect }: RealtimeBannerProps) {
  const [reconnecting, setReconnecting] = useState(false);

  if (realtimeOk) return null;

  async function handleReconnect() {
    if (!onReconnect) {
      window.location.reload();
      return;
    }
    setReconnecting(true);
    try {
      await onReconnect();
    } finally {
      setTimeout(() => setReconnecting(false), 2000);
    }
  }

  return (
    <div className="mx-auto mb-4 w-full max-w-5xl px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#FDE68A] bg-[#FEF3C7] px-4 py-3 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white border border-[#FDE68A] text-[#D97706]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 6s4-2 11-2 11 2 11 2" strokeLinecap="round" />
              <path d="M1 10s4-2 11-2 11 2 11 2" strokeLinecap="round" />
              <line x1="1" y1="14" x2="5" y2="14" strokeLinecap="round" />
              <line x1="19" y1="14" x2="23" y2="14" strokeLinecap="round" />
              <line x1="1" y1="18" x2="5" y2="18" strokeLinecap="round" />
              <line x1="19" y1="18" x2="23" y2="18" strokeLinecap="round" />
              <line x1="12" y1="14" x2="12" y2="22" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <p className="text-xs font-bold text-[#92400E]">Koneksi realtime terputus</p>
            <p className="text-[11px] text-[#B45309]">
              Sinkronisasi realtime terhambat. Klik reconnect untuk mencoba kembali.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleReconnect}
          disabled={reconnecting}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[#FDE68A] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#92400E] shadow-2xs transition hover:bg-[#FEF3C7] disabled:opacity-60 cursor-pointer"
        >
          {reconnecting ? (
            <>
              <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
              </svg>
              Menyambung...
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="23 4 23 10 17 10" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sambung Ulang
            </>
          )}
        </button>
      </div>
    </div>
  );
}
