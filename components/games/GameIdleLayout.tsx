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
  accentColor,
  accentColorLight,
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
    <div className="grid gap-5 md:grid-cols-2">
      {/* ── Buat Game ──────────────────────────────────────────────────── */}
      <div
        className="overflow-hidden rounded-2xl border bg-[#111113]"
        style={{ borderColor: `${accentColor}33` }}
      >
        <div
          className="h-0.5 w-full"
          style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColorLight})` }}
        />
        <div className="p-6">{createContent}</div>
      </div>

      {/* ── Gabung Game ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
        <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-[#5C5470]">
          Gabung Game
        </p>

        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#818CF8]/15">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" strokeLinecap="round" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-[#FFF5F8]">Join Sesi Partner</p>
            <p className="text-xs text-[#5C5470]">Masukkan session code dari partner</p>
          </div>
        </div>

        <input
          value={joinCodeInput}
          onChange={(e) => onJoinCodeChange(e.target.value.toUpperCase())}
          placeholder="Masukkan kode sesi"
          maxLength={12}
          className="w-full rounded-xl border border-white/10 bg-[#18181C] px-4 py-3 font-mono text-base font-bold tracking-widest text-[#FFF5F8] outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-[#5C5470] transition"
          style={{
            // dynamic focus ring color based on game accent
            // fallback to CSS custom property approach
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = `${accentColor}66`;
            e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}1a`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />

        <button
          onClick={onJoin}
          disabled={isJoinDisabled}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            borderColor: `${accentColor}4d`,
            backgroundColor: `${accentColor}1a`,
            color: accentColorLight,
          }}
        >
          {joinLoading ? (
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
            </svg>
          ) : null}
          {joinLoading ? "Bergabung..." : "Bergabung"}
        </button>

        {joinContent}
      </div>
    </div>
  );
}

// ── Helper: Rules List ────────────────────────────────────────────────────────
/** Reusable rules list — pass as joinContent */
export function GameRulesList({ rules }: { rules: string[] }) {
  return (
    <div className="mt-5 space-y-2 border-t border-white/[0.06] pt-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#5C5470]">
        Cara Main
      </p>
      {rules.map((rule, i) => (
        <p key={i} className="flex items-start gap-2 text-[10px] text-[#9B93B0]">
          <span className="mt-0.5 text-[#5C5470]">•</span> {rule}
        </p>
      ))}
    </div>
  );
}
