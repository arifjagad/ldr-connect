"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "@/components/ui/Toast";
import type { TodCustomQuestion } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<{ data: T; message: string }> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? "Terjadi kesalahan");
  return json;
}

const CATEGORIES = ["romantis", "kenangan", "mimpi", "tantangan", "seru", "keberanian", "refleksi"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function QuestionCard({ q }: { q: TodCustomQuestion }) {
  const isAI = q.source === "ai";
  const isPending = !q.is_active;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#E7E5E4] bg-white p-4 shadow-xs transition hover:border-[#D6D3D1]">
      {/* Type badge */}
      <span
        className={`mt-0.5 shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
          q.type === "truth"
            ? "bg-[#EEF2FF] text-[#4F46E5] border border-[#E0E7FF]"
            : "bg-[#FDF4F2] text-[#C84B31] border border-[#FBDCD5]"
        }`}
      >
        {q.type}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-[#1F1D1B] font-medium">{q.question}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-[#FCFBF7] px-2 py-0.5 text-[10px] font-semibold text-[#78716C] border border-[#E7E5E4]">
            {q.category}
          </span>
          <span className="h-1 w-1 rounded-full bg-[#E7E5E4]" />
          {isAI ? (
            <span className="flex items-center gap-1 rounded-full bg-[#EBF9EB] px-2 py-0.5 text-[10px] font-semibold text-[#10B981] border border-[#10B981]/20">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              AI Generated
            </span>
          ) : isPending ? (
            <span className="flex items-center gap-1 rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-semibold text-[#D97706] border border-[#FDE68A]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D97706] animate-pulse" />
              Menunggu Review
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-[#EBF9EB] px-2 py-0.5 text-[10px] font-semibold text-[#10B981] border border-[#10B981]/20">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
              Aktif
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TodQuestionsPage() {
  const [questions, setQuestions] = useState<TodCustomQuestion[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  // Submit form state
  const [submitType, setSubmitType] = useState<"truth" | "dare">("truth");
  const [submitCategory, setSubmitCategory] = useState("romantis");
  const [submitQuestion, setSubmitQuestion] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  // AI generate form state
  const [genType, setGenType] = useState<"truth" | "dare" | "both">("both");
  const [genCategory, setGenCategory] = useState("romantis");
  const [genCount, setGenCount] = useState(5);
  const [genLoading, setGenLoading] = useState(false);

  const loadQuestions = useCallback(async () => {
    try {
      const json = await apiFetch<{ questions: TodCustomQuestion[] }>("/api/game/tod/questions/my");
      setQuestions(json.data.questions);
    } catch {
      // jika belum linked, list kosong — handled gracefully
    }
  }, []);

  useEffect(() => {
    loadQuestions().finally(() => setInitialLoading(false));
  }, [loadQuestions]);

  // ── Submit handler ────────────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      const json = await apiFetch<unknown>("/api/game/tod/questions/submit", {
        method: "POST",
        body: JSON.stringify({ type: submitType, category: submitCategory, question: submitQuestion }),
      });
      toast.success("Pertanyaan Dikirim!", json.message || "Pertanyaan kamu akan diulas oleh admin sebelum aktif.");
      setSubmitQuestion("");
      await loadQuestions();
    } catch (e) {
      toast.error("Gagal Mengirim Pertanyaan", (e as Error).message);
    } finally {
      setSubmitLoading(false);
    }
  }

  // ── AI generate handler ───────────────────────────────────────────────────

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    setGenLoading(true);
    try {
      const json = await apiFetch<{ questions: TodCustomQuestion[] }>("/api/game/tod/questions/generate", {
        method: "POST",
        body: JSON.stringify({ type: genType, category: genCategory, count: genCount }),
      });
      toast.success("Pertanyaan AI Dibuat! ✨", json.message || `${genCount} pertanyaan berhasil dibuat dan langsung aktif.`);
      await loadQuestions();
    } catch (e) {
      toast.error("Gagal Generate Pertanyaan", (e as Error).message);
    } finally {
      setGenLoading(false);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const aiQuestions = questions.filter((q) => q.source === "ai");
  const userQuestions = questions.filter((q) => q.source === "user");
  const pendingCount = userQuestions.filter((q) => !q.is_active).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="relative mx-auto w-full max-w-6xl px-6 py-12 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#78716C]">
          <Link href="/dashboard/games" className="hover:text-[#1F1D1B] transition">Games</Link>
          <span>/</span>
          <Link href="/dashboard/games/tod" className="hover:text-[#1F1D1B] transition">Truth or Dare</Link>
          <span>/</span>
          <span className="text-[#C84B31]">Pertanyaan Kustom</span>
        </div>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-[#1F1D1B]">
          Pertanyaan <span className="text-[#C84B31] italic">Kustom</span>
        </h1>
        <p className="mt-1 text-sm text-[#78716C]">
          Tambahkan pertanyaan personal atau biarkan AI yang kreasikan untuk kalian.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* ── Panel Kiri: Submit pertanyaan ──────────────────────────────── */}
        <div className="space-y-6">

          {/* Form submit */}
          <div className="rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-xl shadow-black/2">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FDF4F2] text-[#C84B31] border border-[#FBDCD5]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-[#1F1D1B]">Kirim Pertanyaanmu</p>
                <p className="text-xs text-[#78716C]">Akan diulas admin sebelum aktif</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type toggle */}
              <div>
                <label className="block text-xs font-semibold text-[#1F1D1B] mb-2">Tipe</label>
                <div className="flex rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] p-1">
                  {(["truth", "dare"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSubmitType(t)}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                        submitType === t
                          ? "bg-white text-[#C84B31] shadow-xs"
                          : "bg-transparent text-[#78716C] hover:text-[#1F1D1B]"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-[#1F1D1B] mb-1.5">Kategori</label>
                <select
                  value={submitCategory}
                  onChange={(e) => setSubmitCategory(e.target.value)}
                  className="w-full rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-3.5 py-2.5 text-sm text-[#1F1D1B] outline-none transition focus:border-[#C84B31] focus:bg-white cursor-pointer"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} className="bg-white text-[#1F1D1B]">{c}</option>
                  ))}
                </select>
              </div>

              {/* Question */}
              <div>
                <label className="block text-xs font-semibold text-[#1F1D1B] mb-1.5">Pertanyaan / Tantangan</label>
                <textarea
                  value={submitQuestion}
                  onChange={(e) => setSubmitQuestion(e.target.value)}
                  rows={3}
                  placeholder={submitType === "truth" ? "Apa hal yang paling kamu rindukan dariku?" : "Kirimkan foto senyumanmu sekarang!"}
                  required
                  minLength={10}
                  className="w-full resize-none rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-4 py-2.5 text-sm text-[#1F1D1B] outline-none placeholder:text-[#A8A29E] transition focus:border-[#C84B31] focus:bg-white"
                />
                <p className="mt-1 text-right text-[10px] text-[#78716C]">{submitQuestion.length}/500</p>
              </div>

              <button
                type="submit"
                disabled={submitLoading || submitQuestion.trim().length < 10}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C84B31] py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#B33E26] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {submitLoading ? (
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {submitLoading ? "Mengirim..." : "Kirim untuk Diulas"}
              </button>
            </form>
          </div>

          {/* Form AI generate */}
          <div className="rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-xl shadow-black/2">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5] border border-[#E0E7FF]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-[#1F1D1B]">Generate dengan AI</p>
                <p className="text-xs text-[#78716C]">Langsung aktif, tanpa perlu review</p>
              </div>
            </div>

            <form onSubmit={handleGenerate} className="space-y-4">
              {/* Type */}
              <div>
                <label className="block text-xs font-semibold text-[#1F1D1B] mb-2">Tipe Pertanyaan</label>
                <div className="flex rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] p-1">
                  {([
                    { value: "both", label: "Campuran" },
                    { value: "truth", label: "Truth" },
                    { value: "dare", label: "Dare" },
                  ] as const).map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setGenType(t.value)}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-bold tracking-wide transition cursor-pointer ${
                        genType === t.value
                          ? "bg-white text-[#C84B31] shadow-xs"
                          : "bg-transparent text-[#78716C] hover:text-[#1F1D1B]"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-[#1F1D1B] mb-1.5">Tema / Kategori</label>
                <select
                  value={genCategory}
                  onChange={(e) => setGenCategory(e.target.value)}
                  className="w-full rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-3.5 py-2.5 text-sm text-[#1F1D1B] outline-none transition focus:border-[#C84B31] focus:bg-white cursor-pointer"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} className="bg-white text-[#1F1D1B]">{c}</option>
                  ))}
                </select>
              </div>

              {/* Count */}
              <div>
                <label className="block text-xs font-semibold text-[#1F1D1B] mb-1.5">
                  Jumlah Pertanyaan
                  <span className="ml-2 font-bold text-[#C84B31]">({genCount})</span>
                </label>
                <input
                  type="range"
                  min={3}
                  max={10}
                  value={genCount}
                  onChange={(e) => setGenCount(Number(e.target.value))}
                  className="w-full accent-[#C84B31] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-semibold text-[#78716C] mt-1">
                  <span>3</span><span>10</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={genLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C84B31] py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#B33E26] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {genLoading ? (
                  <>
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                    </svg>
                    AI sedang berpikir...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                    </svg>
                    Generate {genCount} Pertanyaan
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* ── Panel Kanan: Daftar pertanyaan ─────────────────────────────── */}
        <div>
          <div className="rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-xl shadow-black/2 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-sm font-bold text-[#1F1D1B]">Pertanyaan Kalian</p>
                  <p className="text-xs text-[#78716C]">
                    {questions.length} total pertanyaan
                    {pendingCount > 0 && (
                      <span className="ml-2 rounded-full bg-[#FEF3C7] border border-[#FDE68A] px-2 py-0.5 text-[#D97706] font-semibold">
                        {pendingCount} menunggu review
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {initialLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="h-20 animate-pulse rounded-xl bg-[#FCFBF7] border border-[#E7E5E4]" />
                  ))}
                </div>
              ) : questions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-3 text-4xl">💭</div>
                  <p className="font-serif text-base font-bold text-[#1F1D1B]">Belum ada pertanyaan kustom</p>
                  <p className="mt-1 text-xs text-[#78716C]">Kirim pertanyaanmu atau biarkan AI yang buat!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {/* AI questions */}
                  {aiQuestions.length > 0 && (
                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#78716C]">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5">
                          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                        </svg>
                        AI Generated ({aiQuestions.length})
                      </p>
                      <div className="space-y-2.5">
                        {aiQuestions.map((q) => <QuestionCard key={q.id} q={q} />)}
                      </div>
                    </div>
                  )}

                  {/* User questions */}
                  {userQuestions.length > 0 && (
                    <div className={aiQuestions.length > 0 ? "mt-6" : ""}>
                      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#78716C]">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#C84B31" strokeWidth="2.5">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                        </svg>
                        Dikirim Manual ({userQuestions.length})
                      </p>
                      <div className="space-y-2.5">
                        {userQuestions.map((q) => <QuestionCard key={q.id} q={q} />)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Info footer in right card */}
            <div className="mt-6 rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] p-3.5">
              <div className="flex gap-2.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C84B31" strokeWidth="2" className="shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <div className="text-[11px] leading-relaxed text-[#78716C]">
                  <strong className="text-[#1F1D1B]">Pertanyaan AI</strong> langsung aktif.{" "}
                  <strong className="text-[#1F1D1B]">Pertanyaan manual</strong> perlu review admin sebelum aktif di sesi permainan.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
