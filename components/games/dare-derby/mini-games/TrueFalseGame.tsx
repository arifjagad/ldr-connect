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

  const gameStartRef = useRef(startedAt ?? Date.now());
  const completedRef = useRef(false);
  // Selalu menyimpan answers terkini agar countdown tidak membaca stale closure.
  const answersRef = useRef<boolean[]>([]);
  useEffect(() => { answersRef.current = answers; }, [answers]);

  const finish = useCallback((ans: boolean[]) => {
    if (completedRef.current) return;
    completedRef.current = true;
    const timeTaken = Date.now() - gameStartRef.current;
    const correct = ans.filter((a, i) => a === statements[i]?.answer).length;
    onComplete(Math.round((correct / QUESTIONS_PER_ROUND) * 100), timeTaken, { correct, total: QUESTIONS_PER_ROUND });
  }, [onComplete, statements]);

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
    if (done || feedback !== null) return;
    const isCorrect = answer === statements[current].answer;
    setFeedback(isCorrect ? "correct" : "wrong");
    setTimeout(() => {
      setFeedback(null);
      const newAnswers = [...answers, answer];
      setAnswers(newAnswers);
      const next = current + 1;
      if (next >= QUESTIONS_PER_ROUND) { setDone(true); finish(newAnswers); }
      else setCurrent(next);
    }, 500);
  };

  const correctCount = answers.filter((a, i) => a === statements[i]?.answer).length;
  const urgent = timeLeft <= 5;

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <p className="text-sm font-medium text-[#9B93B0]">🎯 Benar/Salah</p>
        <p className="text-5xl font-bold text-[#FFF5F8]">{correctCount}/{QUESTIONS_PER_ROUND}</p>
        <p className="text-sm text-[#9B93B0]">pertanyaan benar</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 select-none">
      <div className="text-center">
        <p className="text-sm font-medium text-[#9B93B0]">🎯 Benar/Salah</p>
        <p className="mt-1 text-xs text-[#5C5470]">Tentukan apakah pernyataan ini benar atau salah!</p>
      </div>

      {bonusActive && (
        <div className="rounded-full bg-yellow-500/20 border border-yellow-500/40 px-3 py-1 text-xs font-bold text-yellow-400 text-center">
          +50 BONUS AKTIF!
        </div>
      )}

      <div className="flex items-center justify-between text-xs">
        <span className="text-[#5C5470]">{current + 1}/{QUESTIONS_PER_ROUND}</span>
        <span className={urgent ? "text-red-400 font-bold animate-pulse" : "text-[#5C5470]"}>{timeLeft}s</span>
      </div>

      <div className="flex gap-1.5">
        {statements.map((s, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all ${
              i < answers.length
                ? answers[i] === s.answer ? "bg-green-500" : "bg-red-500"
                : i === current ? "bg-[#818CF8]" : "bg-white/10"
            }`}
          />
        ))}
      </div>

      <div
        className={`rounded-2xl border p-5 text-center transition-colors ${
          feedback === "correct" ? "border-green-500/40 bg-green-500/10"
          : feedback === "wrong" ? "border-red-500/40 bg-red-500/10"
          : "border-white/10 bg-white/5"
        }`}
      >
        <p className="text-base font-medium text-[#FFF5F8] leading-relaxed">
          {statements[current].text}
        </p>
        {feedback && (
          <p className={`text-sm font-bold mt-2 ${feedback === "correct" ? "text-green-400" : "text-red-400"}`}>
            {feedback === "correct" ? "✓ Benar!" : `✗ Salah! (${statements[current].answer ? "BENAR" : "SALAH"})`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleAnswer(true)}
          disabled={feedback !== null}
          className="py-4 rounded-2xl bg-green-500/20 border border-green-500/40 text-green-400 font-bold text-lg hover:bg-green-500/30 transition active:scale-95 disabled:opacity-50"
        >
          ✓ BENAR
        </button>
        <button
          onClick={() => handleAnswer(false)}
          disabled={feedback !== null}
          className="py-4 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 font-bold text-lg hover:bg-red-500/30 transition active:scale-95 disabled:opacity-50"
        >
          ✗ SALAH
        </button>
      </div>
    </div>
  );
}
