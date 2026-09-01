"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  duration?: number;
  startedAt?: number;   // unix ms — timestamp server saat ronde mulai (untuk timeTaken)
  bonusActive?: boolean;
  onComplete: (score: number, timeTaken: number, metadata?: Record<string, unknown>) => void;
}

const COLORS = [
  { id: "red",    bg: "bg-red-500",    glow: "#EF4444" },
  { id: "blue",   bg: "bg-blue-500",   glow: "#3B82F6" },
  { id: "green",  bg: "bg-green-500",  glow: "#22C55E" },
  { id: "yellow", bg: "bg-yellow-400", glow: "#EAB308" },
];

const SEQ_LEN = 5;
const SHOW_PHASE_MS = SEQ_LEN * 900 + 400; // ~4900ms untuk showing phase

type Phase = "showing" | "input" | "done";

export function MemorySequenceGame({ duration = 30, startedAt, bonusActive = false, onComplete }: Props) {
  const [sequence] = useState<string[]>(() =>
    Array.from({ length: SEQ_LEN }, () => COLORS[Math.floor(Math.random() * COLORS.length)].id)
  );
  const [showingIndex, setShowingIndex] = useState(-1);
  const [phase, setPhase] = useState<Phase>("showing");
  const [userInput, setUserInput] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(duration); // mulai dari durasi penuh
  const [highlight, setHighlight] = useState<string | null>(null);

  const gameStartRef      = useRef(startedAt ?? Date.now());
  const completedRef      = useRef(false);
  const inputStartedAtRef = useRef<number | null>(null);
  // userInputRef: sinkron dengan userInput agar handleColorTap tidak baca stale state
  const userInputRef      = useRef<string[]>([]);
  // onCompleteRef: selalu up-to-date agar finish() tidak tangkap onComplete stale
  const onCompleteRef     = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { userInputRef.current = userInput; }, [userInput]);

  const finish = useCallback((correct: number) => {
    if (completedRef.current) return;
    completedRef.current = true;
    const timeTaken = Date.now() - gameStartRef.current;
    onCompleteRef.current(Math.round((correct / SEQ_LEN) * 100), timeTaken, { correct, total: SEQ_LEN });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Showing phase: tampilkan urutan warna satu per satu ──────────────────────
  useEffect(() => {
    if (phase !== "showing") return;
    correctCountRef.current = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    sequence.forEach((_, i) => {
      timers.push(setTimeout(() => setShowingIndex(i),   i * 900));
      timers.push(setTimeout(() => setShowingIndex(-1),  i * 900 + 700));
    });
    timers.push(setTimeout(() => {
      setShowingIndex(-1);
      // Catat kapan input phase BENAR-BENAR dimulai (bukan kapan round dimulai).
      // Ini mencegah timer langsung 0 jika ada network/render latency.
      inputStartedAtRef.current = Date.now();
      setPhase("input");
    }, SHOW_PHASE_MS));
    return () => timers.forEach(clearTimeout);
  // `sequence` dan `phase` stabil — sequence dari useState lazy init, phase hanya berubah 1x ke "input"
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Countdown: hitung dari inputStartedAt, bukan dari startedAt round ────────
  useEffect(() => {
    if (phase !== "input") return;
    const inputStart = inputStartedAtRef.current ?? Date.now();
    const id = setInterval(() => {
      const elapsed   = Math.floor((Date.now() - inputStart) / 1000);
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0 && !completedRef.current) {
        clearInterval(id);
        // ✅ Bug fix: pakai correctCountRef (bukan 0) agar partial credit dihitung
        // Contoh: user jawab 3/5 benar lalu waktu habis → dapat round(3/5*100)=60, bukan 0
        finish(correctCountRef.current);
      }
    }, 250);
    return () => clearInterval(id);
  // `finish` stabil (useCallback); `duration` tidak berubah selama game.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, duration]);

  // ── Tap handler ───────────────────────────────────────────────────────────────
  const [wrongIndexes, setWrongIndexes] = useState<Set<number>>(new Set());
  const correctCountRef = useRef(0);

  const handleColorTap = (colorId: string) => {
    if (phase !== "input" || completedRef.current) return;
    const currentInput = userInputRef.current;
    if (currentInput.length >= SEQ_LEN) return; // sudah penuh
    const idx = currentInput.length;
    const isCorrect = colorId === sequence[idx];
    const newInput = [...currentInput, colorId];

    setHighlight(colorId);
    setTimeout(() => setHighlight(null), 300);

    if (isCorrect) {
      correctCountRef.current += 1;
    } else {
      setWrongIndexes(prev => new Set(prev).add(idx));
    }

    setUserInput(newInput);

    // Selesai saat semua 5 warna sudah diinput
    if (newInput.length === SEQ_LEN) {
      setPhase("done");
      finish(correctCountRef.current);
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 select-none">
      <div className="text-center">
        <p className="text-sm font-serif font-bold text-[#1F1D1B]">🧠 Ingat Urutan</p>
        <p className="mt-1 text-xs text-[#78716C]">Ingat dan ulangi urutan warna!</p>
      </div>

      {bonusActive && (
        <div className="rounded-full bg-[#FEF3C7] border border-[#FDE68A] px-3 py-1 text-xs font-bold text-[#D97706]">
          +50 BONUS AKTIF!
        </div>
      )}

      <div className="flex gap-2">
        {sequence.map((colorId, i) => {
          const c          = COLORS.find(x => x.id === colorId)!;
          const isActive   = showingIndex === i;
          const isAnswered = (phase === "input" || phase === "done") && i < userInput.length;
          const isWrong    = isAnswered && wrongIndexes.has(i);
          return (
            <div
              key={i}
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all duration-150 ${
                isActive   ? `${c.bg} border-transparent`
                : isWrong  ? "bg-red-100 border-red-500 text-red-600"
                : isAnswered ? "bg-emerald-100 border-emerald-500 text-emerald-700"
                : "bg-white border-[#E7E5E4]"
              }`}
              style={isActive ? { boxShadow: `0 0 12px ${c.glow}` } : undefined}
            >
              {isAnswered && !isActive && (isWrong ? "✗" : "✓")}
            </div>
          );
        })}
      </div>

      {phase === "showing" && (
        <p className="text-xs font-semibold text-[#78716C] animate-pulse">Perhatikan urutannya...</p>
      )}

      {phase === "input" && (
        <>
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-bold text-[#C84B31]">{userInput.length}/{SEQ_LEN}</span>
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
          <div className="grid grid-cols-2 gap-3 w-full">
            {COLORS.map(c => (
              <button
                key={c.id}
                onClick={() => handleColorTap(c.id)}
                className={`h-20 rounded-2xl ${c.bg} transition-all active:scale-95 cursor-pointer shadow-xs ${
                  highlight === c.id ? "opacity-60 scale-95" : "opacity-90 hover:opacity-100"
                }`}
                style={highlight === c.id ? { boxShadow: `0 0 20px ${c.glow}` } : undefined}
              />
            ))}
          </div>
        </>
      )}

      {phase === "done" && (
        <div className="w-full text-center py-4 rounded-2xl border border-[#E7E5E4] bg-white shadow-xl shadow-black/2">
          <p className="text-3xl font-serif font-bold text-[#1F1D1B]">
            {/* ✅ Bug fix: tampilkan jawaban BENAR saja, bukan total klik */}
            {userInput.length - wrongIndexes.size}/{SEQ_LEN}
          </p>
          <p className="text-xs text-[#78716C] font-semibold mt-1">urutan benar</p>
        </div>
      )}
    </div>
  );
}
