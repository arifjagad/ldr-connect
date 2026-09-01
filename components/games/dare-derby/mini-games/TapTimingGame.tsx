"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  duration?: number;
  startedAt?: number;   // unix ms — untuk timeTaken saja, BUKAN untuk countdown
  bonusActive?: boolean;
  onComplete: (score: number, timeTaken: number, metadata?: Record<string, unknown>) => void;
}

// Skor kontinu: 100 saat pos=50, berkurang linear hingga 0 saat |pos-50| >= 50
function calcScore(pos: number): number {
  const dist = Math.abs(pos - 50);
  return Math.max(0, Math.round(100 - (dist / 50) * 100));
}

export function TapTimingGame({ duration = 10, startedAt, bonusActive = false, onComplete }: Props) {
  const [position, setPosition] = useState(0);
  const [tapped, setTapped]     = useState(false);
  const [score, setScore]       = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(duration); // mulai dari durasi penuh

  const gameStartRef  = useRef(startedAt ?? Date.now());
  const mountedAtRef  = useRef(Date.now());
  const posRef        = useRef(0);
  const dirRef        = useRef(1);
  const rafRef        = useRef<number>(0);
  const completedRef  = useRef(false);
  // onCompleteRef: selalu up-to-date agar finish() tidak tangkap onComplete stale
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const finish = useCallback((s: number, pos: number) => {
    if (completedRef.current) return;
    completedRef.current = true;
    cancelAnimationFrame(rafRef.current);
    const timeTaken = Date.now() - gameStartRef.current;
    setScore(s);
    onCompleteRef.current(s, timeTaken, { tap_position: pos, tapped: s > 0 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Bar animation ──────────────────────────────────────────────────────────
  useEffect(() => {
    const speed = 0.8;
    const animate = () => {
      posRef.current += dirRef.current * speed;
      if (posRef.current >= 100) { posRef.current = 100; dirRef.current = -1; }
      if (posRef.current <= 0)   { posRef.current = 0;   dirRef.current = 1; }
      setPosition(posRef.current);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Countdown — dihitung dari mountedAt, bukan startedAt ──────────────────
  // Menggunakan mountedAt memastikan setiap player selalu mendapat durasi penuh
  // (10s) dari saat mereka MELIHAT game, terlepas dari delay network/render.
  useEffect(() => {
    const id = setInterval(() => {
      const elapsed   = Math.floor((Date.now() - mountedAtRef.current) / 1000);
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0 && !completedRef.current) {
        clearInterval(id);
        finish(0, posRef.current);
      }
    }, 250);
    return () => clearInterval(id);
  // `finish` stabil (useCallback); `duration` tidak berubah selama game.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  // ── Tap handler ───────────────────────────────────────────────────────────
  const handleTap = () => {
    if (tapped || completedRef.current) return;
    setTapped(true);
    const s = calcScore(posRef.current);
    setScore(s);
    finish(s, posRef.current);
  };

  // Warna bar berdasarkan kedekatan ke tengah (kontinu)
  const dist     = Math.abs(position - 50);
  const barColor = dist <= 3  ? "#EF4444"   // sangat dekat tengah = merah (perfect)
                 : dist <= 10 ? "#EAB308"   // dekat = kuning
                 : "#22C55E";               // jauh = hijau

  return (
    <div className="flex flex-col items-center gap-6 select-none">
      <div className="text-center">
        <p className="text-sm font-serif font-bold text-[#1F1D1B]">⚡ Perfect Tap</p>
        <p className="mt-1 text-xs text-[#78716C]">Tap saat bar tepat di <span className="font-bold text-[#C84B31]">garis merah</span> di tengah!</p>
      </div>

      {bonusActive && (
        <div className="rounded-full bg-[#FEF3C7] border border-[#FDE68A] px-3 py-1 text-xs font-bold text-[#D97706]">
          +50 BONUS AKTIF!
        </div>
      )}

      <div className="flex justify-end w-full">
        <span
          className={`text-sm font-bold tabular-nums ${
            timeLeft <= 5
              ? "text-red-500 animate-pulse"
              : timeLeft <= 10
              ? "text-[#D97706]"
              : "text-[#1F1D1B]"
          }`}
        >
          {timeLeft}s
        </span>
      </div>

      <div className="relative w-full h-12 rounded-2xl bg-[#FCFBF7] border border-[#E7E5E4] overflow-hidden shadow-inner">
        {/* Garis tengah — satu-satunya target */}
        <div className="absolute inset-y-0 left-1/2 -translate-x-px w-0.5 bg-[#C84B31]"
             style={{ boxShadow: "0 0 6px #C84B31" }} />
        {/* Moving bar */}
        <div
          className="absolute top-2 bottom-2 w-3 rounded-full transition-none"
          style={{
            left: `calc(${position}% - 6px)`,
            backgroundColor: barColor,
            boxShadow: `0 0 10px ${barColor}`,
          }}
        />
      </div>

      {!tapped ? (
        <button
          onClick={handleTap}
          className="w-full py-4 rounded-2xl bg-[#C84B31] hover:bg-[#B33E26] text-white text-lg font-bold shadow-xs transition active:scale-95 cursor-pointer"
        >
          TAP!
        </button>
      ) : (
        <div className="w-full py-4 rounded-2xl bg-white border border-[#E7E5E4] text-center shadow-xl shadow-black/2">
          <p className="text-3xl font-serif font-bold text-[#1F1D1B]">{score}</p>
          <p className="text-xs text-[#78716C] mt-1 font-semibold">
            {(score ?? 0) >= 98 ? "Sempurna! 🎯" : (score ?? 0) >= 80 ? "Bagus! ✨" : (score ?? 0) >= 60 ? "Lumayan 👍" : "Coba lagi..."}
          </p>
        </div>
      )}
    </div>
  );
}
