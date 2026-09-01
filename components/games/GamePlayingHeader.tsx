"use client";

import type { ReactNode } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GamePlayingHeaderProps {
  /** Session code — hidden on mobile */
  sessionCode?: string;
  /** Status text: "Giliranmu", "Giliran partner", "Ronde 3/5" */
  statusText: string;
  /** Color for the status text */
  statusColor?: string;
  /** Timer in seconds (null = not started) */
  timerSeconds: number | null;
  /** Total timer duration in seconds — for the progress bar width */
  timerTotalSeconds?: number;
  /** Partner online/offline */
  partnerOnline: boolean;
  /** Whether video call panel is open */
  showVideo: boolean;
  /** Toggle video call */
  onToggleVideo: () => void;
  /** Leave / exit game */
  onLeave: () => void;
  /** Realtime connection status */
  realtimeOk?: boolean;
  /** Additional elements on the left side (after status) */
  extraLeft?: ReactNode;
  /** Additional elements on the right side (before timer) */
  extraRight?: ReactNode;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimer(s: number | null): { mm: string; ss: string } {
  if (s === null) return { mm: "--", ss: "--" };
  return {
    mm: String(Math.floor(s / 60)).padStart(2, "0"),
    ss: String(s % 60).padStart(2, "0"),
  };
}

function timerColor(pct: number): string {
  if (pct > 50) return "#10B981";
  if (pct > 20) return "#D97706";
  return "#DC2626";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GamePlayingHeader({
  sessionCode,
  statusText,
  statusColor = "#C84B31",
  timerSeconds,
  timerTotalSeconds = 600,
  partnerOnline,
  showVideo,
  onToggleVideo,
  onLeave,
  realtimeOk = true,
  extraLeft,
  extraRight,
}: GamePlayingHeaderProps) {
  const { mm, ss } = formatTimer(timerSeconds);
  const pct = timerSeconds !== null ? (timerSeconds / timerTotalSeconds) * 100 : 100;
  const color = timerColor(pct);

  return (
    <div className="mb-4 rounded-2xl border border-[#E7E5E4] bg-white p-4 shadow-xl shadow-black/2">
      <div className="flex items-center justify-between gap-3">
        {/* Left side */}
        <div className="flex min-w-0 items-center gap-2.5">
          {sessionCode && (
            <>
              <span className="hidden shrink-0 font-mono text-xs font-bold tracking-widest text-[#78716C] sm:inline">
                {sessionCode}
              </span>
              <span className="hidden h-1 w-1 shrink-0 rounded-full bg-[#E7E5E4] sm:inline-block" />
            </>
          )}

          <span
            className="truncate text-xs font-bold"
            style={{ color: statusColor }}
          >
            {statusText}
          </span>

          {/* Partner online indicator */}
          <span
            className="hidden items-center gap-1.5 rounded-full border border-[#E7E5E4] bg-[#FCFBF7] px-2.5 py-0.5 text-[10px] font-semibold sm:flex"
            title={partnerOnline ? "Partner online" : "Partner offline"}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                partnerOnline ? "bg-[#10B981]" : "bg-[#A8A29E]"
              }`}
            />
            <span className={partnerOnline ? "text-[#10B981]" : "text-[#78716C]"}>
              {partnerOnline ? "Online" : "Offline"}
            </span>
          </span>

          {/* Realtime warning */}
          {!realtimeOk && (
            <span
              className="hidden items-center gap-1.5 rounded-full border border-[#FDE68A] bg-[#FEF3C7] px-2.5 py-0.5 text-[10px] font-semibold text-[#D97706] sm:flex"
              title="Koneksi realtime terputus"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#D97706]" />
              Koneksi lambat
            </span>
          )}

          {extraLeft}
        </div>

        {/* Right side */}
        <div className="flex shrink-0 items-center gap-3">
          {extraRight}

          {/* Timer */}
          <span className="font-mono text-sm font-bold tabular-nums" style={{ color }}>
            {mm}:{ss}
          </span>

          {/* Video toggle */}
          <button
            type="button"
            onClick={onToggleVideo}
            title={showVideo ? "Tutup video call" : "Buka video call"}
            className={`flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer ${
              showVideo
                ? "border-[#C84B31] bg-[#FDF4F2] text-[#C84B31]"
                : "border-[#E7E5E4] bg-white text-[#78716C] hover:text-[#1F1D1B]"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </button>

          {/* Leave */}
          <button
            type="button"
            onClick={onLeave}
            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-[#78716C] transition hover:bg-[#F5F5F4] hover:text-[#1F1D1B] cursor-pointer"
          >
            Keluar
          </button>
        </div>
      </div>

      {/* Timer progress bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#F5F5F4]">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
