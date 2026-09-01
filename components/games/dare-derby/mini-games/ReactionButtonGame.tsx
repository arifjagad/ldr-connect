"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  duration?: number;
  startedAt?: number;
  bonusActive?: boolean;
  onComplete: (score: number, timeTaken: number, metadata?: Record<string, unknown>) => void;
}

const GRACE_PERIOD_SECONDS = 2;
const TOO_EARLY_PENALTY_MS = 800;

function calcRemaining(duration: number, startedAt?: number): number {
  if (!startedAt) return duration;
  return Math.max(0, duration + GRACE_PERIOD_SECONDS - Math.floor((Date.now() - startedAt) / 1000));
}

type State = "waiting" | "ready" | "too_early" | "tapped" | "timeout";

export function ReactionButtonGame({ duration = 8, startedAt, bonusActive = false, onComplete }: Props) {
  const [state, setState]         = useState<State>("waiting");
  const [reactionMs, setReactionMs] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(() => calcRemaining(duration, startedAt));

  const gameStartRef      = useRef(startedAt ?? Date.now());
  const completedRef      = useRef(false);
  const appearTimeRef     = useRef<number | null>(null);
  // stateRef: sumber kebenaran untuk state di dalam callbacks async
  const stateRef          = useRef<State>("waiting");
  // onCompleteRef: selalu up-to-date agar finish() tidak tangkap onComplete stale
  const onCompleteRef     = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const setStateSafe = useCallback((s: State) => {
    stateRef.current = s;
    setState(s);
  }, []);

  const finish = useCallback((score: number, ms: number | null) => {
    if (completedRef.current) return;
    completedRef.current = true;
    const timeTaken = Date.now() - gameStartRef.current;
    onCompleteRef.current(score, timeTaken, { reaction_ms: ms });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Countdown ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const remaining = calcRemaining(duration, startedAt);
      setCountdown(remaining);
      if (remaining <= 0 && !completedRef.current) {
        clearInterval(id);
        setStateSafe("timeout");
        finish(0, null);
      }
    }, 250);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, startedAt]);

  // ── Tombol muncul (random delay) ───────────────────────────────────────────
  useEffect(() => {
    if (calcRemaining(duration, startedAt) <= 0) {
      setStateSafe("timeout");
      finish(0, null);
      return;
    }
    const remaining = calcRemaining(duration, startedAt) * 1000;
    const maxDelay  = Math.min(remaining - 500, 3500);
    if (maxDelay <= 0) return;
    const delay = 1000 + Math.random() * Math.min(maxDelay - 1000, 2000);

    const t = setTimeout(() => {
      if (completedRef.current) return;
      // Langsung tampilkan tombol apapun state saat ini (termasuk jika masih too_early).
      // Ini mencegah race condition: too_early penalty 800ms menimpa setState("ready").
      appearTimeRef.current = Date.now();
      setStateSafe("ready");
    }, delay);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tap handler ───────────────────────────────────────────────────────────
  const handleTap = useCallback(() => {
    if (completedRef.current) return;

    const current = stateRef.current;

    if (current === "waiting") {
      // Tap sebelum tombol muncul → penalty visual saja (bukan penalty gameplay)
      // State tetap "too_early" sampai tombol muncul atau timer habis
      setStateSafe("too_early");
      // Kembali ke waiting setelah 800ms — HANYA jika tombol belum muncul
      // Jika tombol sudah muncul, setStateSafe("ready") di setTimeout tombol sudah dijalankan
      const penaltyTimer = setTimeout(() => {
        if (completedRef.current) return;
        // Cek via stateRef: jika masih "too_early" (tombol belum muncul), kembali ke waiting
        // Jika sudah "ready" (tombol muncul selama penalty), biarkan saja
        if (stateRef.current === "too_early") {
          setStateSafe("waiting");
        }
      }, TOO_EARLY_PENALTY_MS);
      return;
    }

    if (current === "too_early") {
      // Tap saat animasi too_early — abaikan
      return;
    }

    if (current !== "ready") return;

    // ✅ Tap yang valid saat tombol tampil
    const ms = Date.now() - (appearTimeRef.current ?? Date.now());
    setReactionMs(ms);
    setStateSafe("tapped");
    // Skor minimum 10 untuk tap yang valid — 0 hanya jika benar-benar timeout.
    // Ini fair karena too_early penalty (800ms) memotong window reaksi player.
    const rawScore = 100 - Math.floor(ms / 30);
    finish(Math.max(10, rawScore), ms);
  }, [finish, setStateSafe]);

  return (
    <div className="flex flex-col items-center gap-6 select-none">
      <div className="text-center">
        <p className="text-sm font-serif font-bold text-[#1F1D1B]">⚡ React!</p>
        <p className="mt-1 text-xs text-[#78716C]">Tap tombol secepat mungkin saat muncul!</p>
      </div>

      {bonusActive && (
        <div className="rounded-full bg-[#FEF3C7] border border-[#FDE68A] px-3 py-1 text-xs font-bold text-[#D97706]">
          +50 BONUS AKTIF!
        </div>
      )}

      <div className="flex justify-end w-full">
        <span
          className={`text-sm font-bold tabular-nums ${
            countdown <= 5
              ? "text-red-500 animate-pulse"
              : countdown <= 10
              ? "text-[#D97706]"
              : "text-[#1F1D1B]"
          }`}
        >
          {countdown}s
        </span>
      </div>

      <div
        className="w-full flex items-center justify-center rounded-2xl border border-[#E7E5E4] bg-[#FCFBF7] p-8 shadow-inner"
        style={{ minHeight: 200 }}
        onClick={handleTap}
      >
        {state === "waiting" && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#A8A29E] flex items-center justify-center">
              <span className="text-2xl animate-pulse">⏳</span>
            </div>
            <p className="text-xs font-semibold text-[#78716C]">Bersiap...</p>
          </div>
        )}
        {state === "too_early" && (
          <div className="flex flex-col items-center gap-2">
            <span className="text-4xl">❌</span>
            <p className="text-xs font-bold text-red-600">Terlalu cepat!</p>
          </div>
        )}
        {state === "ready" && (
          <button className="w-36 h-36 rounded-full bg-[#C84B31] hover:bg-[#B33E26] text-white text-2xl font-bold shadow-xl shadow-[#C84B31]/30 animate-bounce active:scale-95 transition cursor-pointer">
            TAP!
          </button>
        )}
        {state === "tapped" && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-4xl font-serif font-bold text-[#1F1D1B]">{reactionMs}ms</p>
            <p className="text-xs font-semibold text-[#78716C]">
              {reactionMs! < 300 ? "Luar biasa! 🚀" : reactionMs! < 500 ? "Bagus! ✨" : reactionMs! < 800 ? "Lumayan 👍" : "Pelan..."}
            </p>
          </div>
        )}
        {state === "timeout" && (
          <div className="flex flex-col items-center gap-2">
            <span className="text-4xl">😴</span>
            <p className="text-xs font-semibold text-[#78716C]">Waktu habis!</p>
          </div>
        )}
      </div>
    </div>
  );
}
