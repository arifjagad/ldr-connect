"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  duration?: number;
  startedAt?: number;
  bonusActive?: boolean;
  onComplete: (score: number, timeTaken: number, metadata?: Record<string, unknown>) => void;
}

const TOTAL = 9;
const SHOW_MS   = 400;  // durasi tiap angka ditampilkan
const GAP_MS    = 150;  // jeda antar angka saat show

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function NumberOrderGame({ duration = 25, startedAt, bonusActive = false, onComplete }: Props) {
  // Urutan acak yang harus diingat: [3,7,1,9,5,2,8,4,6]
  const [sequence] = useState(() => shuffle(Array.from({ length: TOTAL }, (_, i) => i + 1)));
  // Posisi angka di grid (berbeda dari sequence — ini tampilan grid saja)
  const [gridNums] = useState(() => shuffle(Array.from({ length: TOTAL }, (_, i) => i + 1)));

  // show → input → done
  const [phase, setPhase]               = useState<"show" | "input" | "done">("show");
  const [highlighted, setHighlighted]   = useState<number | null>(null);
  const [showStepLabel, setShowStepLabel] = useState(1); // "Menampilkan X/9"

  // Input state
  const [inputIdx, setInputIdx]         = useState(0);   // index berikutnya yang harus di-tap
  const [wrongFlash, setWrongFlash]     = useState<number | null>(null);
  const [results, setResults]           = useState<(boolean | null)[]>(Array(TOTAL).fill(null));

  // Timer (hanya aktif saat input phase)
  const [timeLeft, setTimeLeft]         = useState(duration);
  const inputStartedAtRef               = useRef<number | null>(null);

  const gameStartRef    = useRef(startedAt ?? Date.now());
  const completedRef    = useRef(false);
  const inputIdxRef     = useRef(0);
  const correctCountRef = useRef(0);          // ← jumlah BENAR (bukan attempt)
  const phaseRef        = useRef<"show" | "input" | "done">("show");
  // onCompleteRef: selalu up-to-date agar finish() tidak tangkap onComplete stale
  const onCompleteRef   = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => { inputIdxRef.current  = inputIdx; }, [inputIdx]);
  useEffect(() => { phaseRef.current     = phase;    }, [phase]);

  const finish = useCallback((correct: number) => {
    if (completedRef.current) return;
    completedRef.current = true;
    const timeTaken = Date.now() - gameStartRef.current;
    const score = Math.round((correct / TOTAL) * 100);
    onCompleteRef.current(score, timeTaken, { correct, total: TOTAL });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Show phase: tampilkan urutan satu per satu ─────────────────────────────
  useEffect(() => {
    if (phase !== "show") return;
    let cancelled = false;
    let step = 0;

    const showNext = () => {
      if (cancelled) return;
      if (step >= TOTAL) {
        // Selesai show → masuk input
        setHighlighted(null);
        setTimeout(() => {
          if (!cancelled) {
            inputStartedAtRef.current = Date.now();
            setPhase("input");
          }
        }, 400);
        return;
      }
      setHighlighted(sequence[step]);
      setShowStepLabel(step + 1);
      step++;
      setTimeout(() => {
        if (cancelled) return;
        setHighlighted(null);
        setTimeout(showNext, GAP_MS);
      }, SHOW_MS);
    };

    const initDelay = setTimeout(showNext, 500); // jeda kecil sebelum mulai
    return () => { cancelled = true; clearTimeout(initDelay); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Countdown (hanya saat input) ──────────────────────────────────────────
  useEffect(() => {
    if (phase !== "input") return;
    const id = setInterval(() => {
      if (!inputStartedAtRef.current) return;
      const elapsed   = Math.floor((Date.now() - inputStartedAtRef.current) / 1000);
      const remaining = Math.max(0, duration - Math.floor(TOTAL * (SHOW_MS + GAP_MS) / 1000) - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0 && !completedRef.current) {
        clearInterval(id);
        setPhase("done");
        // ✅ Bug fix: pakai correctCountRef (jumlah benar), bukan inputIdxRef (jumlah attempt)
        finish(correctCountRef.current);
      }
    }, 250);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Tap handler ───────────────────────────────────────────────────────────
  const handleTap = (num: number) => {
    if (phaseRef.current !== "input" || completedRef.current) return;
    const expected = sequence[inputIdxRef.current];

    if (num === expected) {
      // ✅ Benar
      correctCountRef.current++;              // ← track jumlah benar via ref
      const newResults = [...results];
      newResults[inputIdxRef.current] = true;
      setResults(newResults);
      const newIdx = inputIdxRef.current + 1;
      setInputIdx(newIdx);
      if (newIdx >= TOTAL) {
        setPhase("done");
        finish(correctCountRef.current);
      }
    } else {
      // ❌ Salah — flash merah, catat hasil, tetap lanjut ke angka berikutnya
      setWrongFlash(num);
      setTimeout(() => setWrongFlash(null), 350);
      const newResults = [...results];
      newResults[inputIdxRef.current] = false;
      setResults(newResults);
      const newIdx = inputIdxRef.current + 1;
      setInputIdx(newIdx);
      if (newIdx >= TOTAL) {
        setPhase("done");
        finish(correctCountRef.current);      // ← gunakan correctCountRef, bukan filter(Boolean)
      }
    }
  };

  const urgent = phase === "input" && timeLeft <= 5;

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <div className="text-center">
        <p className="text-sm font-serif font-bold text-[#1F1D1B]">🔢 Urutan Angka</p>
        <p className="mt-1 text-xs text-[#78716C]">
          {phase === "show"
            ? "Perhatikan urutan angka yang menyala!"
            : phase === "input"
            ? "Tap angka sesuai urutan yang tadi muncul!"
            : "Selesai!"}
        </p>
      </div>

      {bonusActive && (
        <div className="rounded-full bg-[#FEF3C7] border border-[#FDE68A] px-3 py-1 text-xs font-bold text-[#D97706]">
          +50 BONUS AKTIF!
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center justify-between w-full">
        {phase === "show" ? (
          <span className="text-xs font-bold text-[#C84B31] animate-pulse">
            Menampilkan {showStepLabel}/{TOTAL}
          </span>
        ) : phase === "input" ? (
          <span className="text-xs font-bold text-[#C84B31]">
            {inputIdx}/{TOTAL}
          </span>
        ) : (
          <span className="text-xs font-bold text-emerald-600">✅ Selesai!</span>
        )}
        {phase === "input" && (
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
        )}
      </div>

      {/* Progress dots — urutan hasil input */}
      <div className="flex gap-1.5">
        {results.map((r, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all ${
              r === null   ? "bg-[#E7E5E4]"
              : r === true ? "bg-emerald-500"
              : "bg-red-500"
            }`}
          />
        ))}
      </div>

      {/* Grid 3×3 */}
      <div className="grid grid-cols-3 gap-3 w-full">
        {gridNums.map((num, cellIdx) => {
          const isHighlighted = highlighted === num;
          const isWrong       = wrongFlash === num;

          return (
            <button
              key={cellIdx}
              onClick={() => handleTap(num)}
              disabled={phase !== "input"}
              className={`
                h-16 rounded-2xl text-2xl font-bold transition-all duration-150 active:scale-95 cursor-pointer shadow-2xs
                ${isHighlighted
                  ? "bg-[#C84B31] border-2 border-[#C84B31] text-white scale-105 shadow-md shadow-[#C84B31]/30"
                  : isWrong
                  ? "bg-red-50 border-2 border-red-500 text-red-600 scale-95"
                  : phase === "input"
                  ? "bg-white border-2 border-[#E7E5E4] text-[#1F1D1B] hover:border-[#C84B31] hover:bg-[#FDF4F2]"
                  : "bg-[#FCFBF7] border-2 border-[#E7E5E4] text-[#A8A29E]"
                }
              `}
            >
              {num}
            </button>
          );
        })}
      </div>

      {/* Done state */}
      {phase === "done" && (
        <div className="w-full text-center py-3 rounded-2xl border border-[#E7E5E4] bg-white shadow-xl shadow-black/2 mt-1">
          <p className="text-xs font-bold text-[#1F1D1B]">
            {results.filter(Boolean).length}/{TOTAL} benar
          </p>
        </div>
      )}
    </div>
  );
}
