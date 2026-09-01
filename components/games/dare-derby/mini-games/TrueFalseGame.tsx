"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  duration?: number;
  startedAt?: number;   // unix ms — timestamp server saat ronde mulai
  bonusActive?: boolean;
  onComplete: (score: number, timeTaken: number, metadata?: Record<string, unknown>) => void;
}

const ALL_STATEMENTS = [
  { text: "Matahari terbenam di arah barat", answer: true },
  { text: "Panda adalah hewan karnivora", answer: false },
  { text: "Indonesia memiliki lebih dari 17.000 pulau", answer: true },
  { text: "Gurita memiliki 3 jantung", answer: true },
  { text: "Kupu-kupu merasakan rasa dengan kaki mereka", answer: true },
  { text: "Air mendidih pada 90°C di tekanan normal", answer: false },
  { text: "Bumi mengelilingi matahari dalam 365 hari", answer: true },
  { text: "Jerapah adalah hewan terbesar di bumi", answer: false },
  { text: "Coklat beracun untuk anjing", answer: true },
  { text: "Cicak bisa meregenerasi ekornya yang putus", answer: true },
  { text: "Lebah mati setelah menyengat sekali", answer: true },
  { text: "Manusia menggunakan 10% kapasitas otak mereka", answer: false },
  { text: "Udang memiliki jantung di kepalanya", answer: true },
  { text: "Bulan lebih besar dari Bumi", answer: false },
  { text: "Burung unta adalah burung terbang tercepat", answer: false },
];

const QUESTIONS_PER_ROUND = 5;

function pickRandom<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

// GRACE_PERIOD: buffer 2 detik untuk latency antara `updated_at` server
// dan saat player benar-benar melihat soal di layar.
const GRACE_PERIOD_SECONDS = 2;

function calcRemaining(duration: number, startedAt?: number): number {
  if (!startedAt) return duration;
  return Math.max(0, duration + GRACE_PERIOD_SECONDS - Math.floor((Date.now() - startedAt) / 1000));
}

export function TrueFalseGame({ duration = 15, startedAt, bonusActive = false, onComplete }: Props) {
  const [statements] = useState(() => pickRandom(ALL_STATEMENTS, QUESTIONS_PER_ROUND));
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [done, setDone] = useState(false);
  const [timeLeft, setTimeLeft] = useState(() => calcRemaining(duration, startedAt));

  const gameStartRef  = useRef(startedAt ?? Date.now());
  const completedRef  = useRef(false);
  // Selalu menyimpan answers terkini agar countdown tidak membaca stale closure.
  const answersRef    = useRef<boolean[]>([]);
  const finalScoreRef = useRef<{ correct: number } | null>(null);
  // onCompleteRef: selalu up-to-date agar finish() tidak tangkap onComplete stale
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { answersRef.current = answers; }, [answers]);

  const finish = useCallback((ans: boolean[]) => {
    if (completedRef.current) return;
    completedRef.current = true;
    const timeTaken = Date.now() - gameStartRef.current;
    const correct = ans.filter((a, i) => a === statements[i]?.answer).length;
    finalScoreRef.current = { correct };
    onCompleteRef.current(Math.round((correct / QUESTIONS_PER_ROUND) * 100), timeTaken, { correct, total: QUESTIONS_PER_ROUND });
  // statements stabil dari useState lazy init; onComplete diganti pakai ref
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statements]);

  // Countdown sinkron
  // Penting: gunakan `answersRef.current` (bukan `answers`) di dalam interval
  // agar tidak membaca stale closure saat timeout — `answers` tidak masuk dep array
  // supaya effect tidak restart setiap soal dijawab (itu akan me-reset timer).
  useEffect(() => {
    const id = setInterval(() => {
      const remaining = calcRemaining(duration, startedAt);
      setTimeLeft(remaining);
      if (remaining === 0 && !completedRef.current) {
        clearInterval(id);
        setDone(true);
        finish(answersRef.current); // ← pakai ref, bukan stale closure
      }
    }, 250);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, startedAt]);

  // Langsung timeout jika sudah habis saat mount
  useEffect(() => {
    if (calcRemaining(duration, startedAt) === 0) { setDone(true); finish(answersRef.current); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAnswer = (answer: boolean) => {
    if (completedRef.current || feedback !== null) return;
    const isCorrect = answer === statements[current].answer;
    // ⚡ Update ref SEGERA sebelum 500ms delay agar timer tidak baca data lama
    // Simpan `answer` (raw) bukan `isCorrect` — scoring di finish() butuh nilai asli
    const newAnswers = [...answersRef.current, answer];
    answersRef.current = newAnswers;
    setFeedback(isCorrect ? "correct" : "wrong");
    setTimeout(() => {
      setFeedback(null);
      setAnswers(newAnswers);
      const next = newAnswers.length;
      if (next >= QUESTIONS_PER_ROUND) { setDone(true); finish(newAnswers); }
      else setCurrent(next);
    }, 500);
  };

  const correctCount = finalScoreRef.current?.correct ?? answers.filter((a, i) => a === statements[i]?.answer).length;
  const urgent = timeLeft <= 5;

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 rounded-2xl border border-[#E7E5E4] bg-white shadow-xl shadow-black/2">
        <p className="text-sm font-serif font-bold text-[#1F1D1B]">🎯 Benar/Salah</p>
        <p className="text-5xl font-serif font-bold text-[#1F1D1B]">{correctCount}/{QUESTIONS_PER_ROUND}</p>
        <p className="text-xs font-semibold text-[#78716C]">pertanyaan benar</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 select-none">
      <div className="text-center">
        <p className="text-sm font-serif font-bold text-[#1F1D1B]">🎯 Benar/Salah</p>
        <p className="mt-1 text-xs text-[#78716C]">Tentukan apakah pernyataan ini benar atau salah!</p>
      </div>

      {bonusActive && (
        <div className="rounded-full bg-[#FEF3C7] border border-[#FDE68A] px-3 py-1 text-xs font-bold text-[#D97706] text-center">
          +50 BONUS AKTIF!
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#C84B31]">{current + 1}/{QUESTIONS_PER_ROUND}</span>
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

      <div className="flex gap-1.5">
        {statements.map((s, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all ${
              i < answers.length
                ? answers[i] === s.answer ? "bg-emerald-500" : "bg-red-500"
                : i === current ? "bg-[#C84B31]" : "bg-[#E7E5E4]"
            }`}
          />
        ))}
      </div>

      <div
        className={`rounded-2xl border p-5 text-center transition-colors shadow-sm ${
          feedback === "correct" ? "border-emerald-200 bg-emerald-50"
          : feedback === "wrong" ? "border-red-200 bg-red-50"
          : "border-[#E7E5E4] bg-white"
        }`}
      >
        <p className="text-base font-serif font-semibold text-[#1F1D1B] leading-relaxed">
          {statements[current].text}
        </p>
        {feedback && (
          <p className={`text-xs font-bold mt-2 ${feedback === "correct" ? "text-emerald-600" : "text-red-600"}`}>
            {feedback === "correct" ? "✓ Benar!" : `✗ Salah! (${statements[current].answer ? "BENAR" : "SALAH"})`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleAnswer(true)}
          disabled={feedback !== null}
          className="py-4 rounded-2xl bg-[#EBF9EB] border border-[#10B981]/25 text-[#10B981] font-bold text-base hover:bg-[#10B981]/15 transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
        >
          ✓ BENAR
        </button>
        <button
          onClick={() => handleAnswer(false)}
          disabled={feedback !== null}
          className="py-4 rounded-2xl bg-[#FEF2F2] border border-red-200 text-red-600 font-bold text-base hover:bg-red-100 transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
        >
          ✗ SALAH
        </button>
      </div>
    </div>
  );
}
