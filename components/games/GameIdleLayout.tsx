"use client";

import type { ReactNode } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GameIdleLayoutProps {
  /** Accent color for the "Join" button/input focus ring */
  accentColor: string;
  /** Lighter accent for hover states */
  accentColorLight: string;

  /** Content inside the "Buat Game" card — game-specific create form.
   *  This renders ABOVE the confirm/create button. */
  createContent: ReactNode;

  /** Content inside the "Gabung Game" card — below join input.
   *  Typically "Cara Main" rules list. */
  joinContent?: ReactNode;

  /** Join code input */
  joinCodeInput: string;
  onJoinCodeChange: (v: string) => void;
  onJoin: () => void;
  joinLoading: boolean;
  joinDisabled?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GameIdleLayout({
  createContent,
  joinContent,
  joinCodeInput,
  onJoinCodeChange,
  onJoin,
  joinLoading,
  joinDisabled,
}: GameIdleLayoutProps) {
  const isJoinDisabled = joinDisabled ?? (joinLoading || !joinCodeInput.trim());

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* ── Buat Game ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[#E7E5E4] bg-white p-6 sm:p-8 shadow-xl shadow-black/2">
        {createContent}
      </div>

      {/* ── Gabung Game ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[#E7E5E4] bg-white p-6 sm:p-8 shadow-xl shadow-black/2 flex flex-col justify-between">
        <div>
          <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-[#78716C]">
            Gabung Game
          </p>

          <div className="mb-6 flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5] border border-[#E0E7FF]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" strokeLinecap="round" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </div>
            <div>
              <p className="font-serif text-lg font-bold text-[#1F1D1B]">Join Sesi Pasangan</p>
              <p className="text-xs text-[#78716C]">Masukkan session code yang dibagikan partner</p>
            </div>
          </div>

          <div className="space-y-3">
            <input
              value={joinCodeInput}
              onChange={(e) => onJoinCodeChange(e.target.value.toUpperCase())}
              placeholder="KODE SESI"
              maxLength={12}
              className="w-full rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-4 py-3 font-mono text-sm font-bold tracking-widest text-[#1F1D1B] outline-none placeholder:font-sans placeholder:text-xs placeholder:font-normal placeholder:tracking-normal placeholder:text-[#A8A29E] focus:border-[#C84B31] focus:bg-white transition"
            />

            <button
              onClick={onJoin}
              disabled={isJoinDisabled}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C84B31] px-5 py-3 text-xs font-semibold text-white shadow-xs transition hover:bg-[#B33E26] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {joinLoading ? (
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                </svg>
              ) : null}
              {joinLoading ? "Memeriksa Kode..." : "Gabung ke Room"}
            </button>
          </div>
        </div>

        {joinContent}
      </div>
    </div>
  );
}

// ── Helper: Rules List ────────────────────────────────────────────────────────
/** Reusable rules list — pass as joinContent */
export function GameRulesList({ rules }: { rules: string[] }) {
  return (
    <div className="mt-6 space-y-2 border-t border-[#F5F5F4] pt-5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#78716C]">
        Aturan Permainan
      </p>
      {rules.map((rule, i) => (
        <p key={i} className="flex items-start gap-2 text-xs text-[#78716C] leading-relaxed">
          <span className="mt-0.5 text-[#C84B31] font-bold">•</span> {rule}
        </p>
      ))}
    </div>
  );
}
