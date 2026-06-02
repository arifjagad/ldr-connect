"use client";

import { useState } from "react";

interface GameSurrenderModalProps {
  /** Accent color for game theme */
  accentColor?: string;
  /** Whether the game has a winner/loser concept */
  hasWinner?: boolean;
  /** Custom warning text */
  warningText?: string;
  /** Loading state */
  loading?: boolean;
  /** Callback when confirmed */
  onConfirm: () => void;
  /** Callback when cancelled */
  onCancel: () => void;
}

export function GameSurrenderModal({
  hasWinner = true,
  warningText,
  loading = false,
  onConfirm,
  onCancel,
}: GameSurrenderModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => !loading && onCancel()}
      />
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-red-500/25 bg-[#111113] shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        <div className="h-0.5 w-full bg-linear-to-r from-red-500 to-red-400" />
        <div className="p-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/15">
            <span className="text-2xl">🏳️</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-red-400">Konfirmasi</p>
          <h2 className="mt-1 text-xl font-bold text-[#FFF5F8]">Yakin ingin menyerah?</h2>
          <div className="my-5 space-y-2.5 text-sm text-[#9B93B0]">
            <p className="flex items-start gap-2">
              <span className="mt-0.5 text-[#5C5470]">•</span>
              Sesi game akan berakhir
            </p>
            {hasWinner && (
              <p className="flex items-start gap-2">
                <span className="mt-0.5 text-[#5C5470]">•</span>
                <span><span className="font-semibold text-[#FF6B9D]">Partner dinyatakan menang</span></span>
              </p>
            )}
            {warningText && (
              <p className="flex items-start gap-2">
                <span className="mt-0.5 text-[#5C5470]">•</span>
                {warningText}
              </p>
            )}
            <p className="flex items-start gap-2">
              <span className="mt-0.5 text-[#5C5470]">•</span>
              Koin tidak dikembalikan
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-[#9B93B0] transition hover:bg-white/10 disabled:opacity-50"
            >
              Lanjut Bermain
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white shadow-[0_4px_16px_rgba(239,68,68,0.35)] transition hover:bg-red-400 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                  </svg>
                  Menyerah...
                </span>
              ) : "Ya, Menyerah"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Simple surrender button — use inside playing phase */
export function GameSurrenderButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={className ?? "w-full rounded-xl border border-red-500/20 bg-red-500/5 py-2.5 text-sm text-red-400 transition hover:bg-red-500/10"}
    >
      🏳️ Menyerah
    </button>
  );
}
