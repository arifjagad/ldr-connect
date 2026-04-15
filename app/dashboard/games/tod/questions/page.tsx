"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
    <div className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-[#111113] p-4">
      {/* Type badge */}
      <span
        className={`mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
          q.type === "truth"
            ? "bg-[#818CF8]/15 text-[#A78BFA]"
            : "bg-[#FF3D7F]/15 text-[#FF6B9D]"
        }`}
      >
        {q.type}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-[#FFF5F8]">{q.question}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-[#5C5470]">{q.category}</span>
          <span className="h-1 w-1 rounded-full bg-[#5C5470]" />
          {isAI ? (
            <span className="flex items-center gap-1 text-[10px] font-medium text-[#34D399]">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              AI Generated
            </span>
          ) : isPending ? (
            <span className="flex items-center gap-1 text-[10px] font-medium text-yellow-400">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
              Menunggu Review
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-medium text-[#34D399]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" />
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
  const [submitMsg, setSubmitMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // AI generate form state
  const [genType, setGenType] = useState<"truth" | "dare" | "both">("both");
  const [genCategory, setGenCategory] = useState("romantis");
  const [genCount, setGenCount] = useState(5);
  const [genLoading, setGenLoading] = useState(false);
  const [genMsg, setGenMsg] = useState<{ ok: boolean; text: string } | null>(null);

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
    setSubmitMsg(null);
    try {
      const json = await apiFetch<unknown>("/api/game/tod/questions/submit", {
        method: "POST",
        body: JSON.stringify({ type: submitType, category: submitCategory, question: submitQuestion }),
      });
      setSubmitMsg({ ok: true, text: json.message });
      setSubmitQuestion("");
      await loadQuestions();
    } catch (e) {
      setSubmitMsg({ ok: false, text: (e as Error).message });
    } finally {
      setSubmitLoading(false);
    }
  }

  // ── AI generate handler ───────────────────────────────────────────────────

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    setGenLoading(true);
    setGenMsg(null);
    try {
      const json = await apiFetch<{ questions: TodCustomQuestion[] }>("/api/game/tod/questions/generate", {
        method: "POST",
        body: JSON.stringify({ type: genType, category: genCategory, count: genCount }),
      });
      setGenMsg({ ok: true, text: json.message });
      await loadQuestions();
    } catch (e) {
      setGenMsg({ ok: false, text: (e as Error).message });
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
    <main className="relative mx-auto w-full max-w-5xl px-6 py-12 lg:px-8">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full blur-[120px]"
        style={{ background: "radial-gradient(ellipse, rgba(255,61,127,0.08) 0%, rgba(129,140,248,0.06) 50%, transparent 70%)" }}
      />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-[#5C5470]">
          <Link href="/dashboard/games" className="hover:text-[#9B93B0] transition">Games</Link>
          <span>/</span>
          <Link href="/dashboard/games/tod" className="hover:text-[#9B93B0] transition">Truth or Dare</Link>
          <span>/</span>
          <span>Pertanyaan Kustom</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#FFF5F8]">
          Pertanyaan{" "}
          <span style={{ backgroundImage: "linear-gradient(90deg, #FF3D7F, #818CF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Kustom
          </span>
        </h1>
        <p className="mt-1 text-sm text-[#5C5470]">
          Tambahkan pertanyaan personal atau biarkan AI yang kreasikan untuk kalian.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* ── Panel Kiri: Submit pertanyaan ──────────────────────────────── */}
        <div className="space-y-5">

          {/* Form submit */}
          <div className="rounded-2xl border border-[#818CF8]/20 bg-[#111113] p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#818CF8]/15">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="1.8">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#FFF5F8]">Kirim Pertanyaanmu</p>
                <p className="text-xs text-[#5C5470]">Akan diulas admin sebelum aktif</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type toggle */}
              <div>
                <label className="block text-xs font-medium text-[#9B93B0] mb-2">Tipe</label>
                <div className="flex rounded-xl border border-white/10 overflow-hidden">
                  {(["truth", "dare"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSubmitType(t)}
                      className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                        submitType === t
                          ? t === "truth"
                            ? "bg-[#818CF8]/20 text-[#A78BFA]"
                            : "bg-[#FF3D7F]/20 text-[#FF6B9D]"
                          : "bg-transparent text-[#5C5470] hover:text-[#9B93B0]"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-[#9B93B0] mb-1.5">Kategori</label>
                <select
                  value={submitCategory}
                  onChange={(e) => setSubmitCategory(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#18181C] px-3 py-2.5 text-sm text-[#FFF5F8] outline-none focus:border-[#818CF8]/40 transition"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} className="bg-[#18181C]">{c}</option>
                  ))}
                </select>
              </div>

              {/* Question */}
              <div>
                <label className="block text-xs font-medium text-[#9B93B0] mb-1.5">Pertanyaan / Tantangan</label>
                <textarea
                  value={submitQuestion}
                  onChange={(e) => setSubmitQuestion(e.target.value)}
                  rows={3}
                  placeholder={submitType === "truth" ? "Apa hal yang paling kamu rindukan dariku?" : "Kirimkan foto senyumanmu sekarang!"}
                  required
                  minLength={10}
                  className="w-full resize-none rounded-xl border border-white/10 bg-[#18181C] px-4 py-2.5 text-sm text-[#FFF5F8] outline-none placeholder:text-[#5C5470] focus:border-[#818CF8]/40 focus:ring-1 focus:ring-[#818CF8]/20 transition"
                />
                <p className="mt-1 text-right text-[10px] text-[#5C5470]">{submitQuestion.length}/500</p>
              </div>

              <button
                type="submit"
                disabled={submitLoading || submitQuestion.trim().length < 10}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#818CF8] py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(129,140,248,0.25)] transition hover:bg-[#A78BFA] disabled:cursor-not-allowed disabled:opacity-50"
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

            {submitMsg && (
              <div className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs ${
                submitMsg.ok
                  ? "border-[#34D399]/20 bg-[#34D399]/10 text-[#34D399]"
                  : "border-red-500/20 bg-red-500/10 text-red-300"
              }`}>
                {submitMsg.ok
                  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                }
                {submitMsg.text}
              </div>
            )}
          </div>

          {/* Form AI generate */}
          <div className="rounded-2xl border border-[#FF3D7F]/20 bg-[#111113] p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF3D7F]/15">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6B9D" strokeWidth="1.8">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#FFF5F8]">Generate dengan AI</p>
                <p className="text-xs text-[#5C5470]">Langsung aktif, tanpa perlu review</p>
              </div>
            </div>

            <form onSubmit={handleGenerate} className="space-y-4">
              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-[#9B93B0] mb-2">Tipe Pertanyaan</label>
                <div className="flex rounded-xl border border-white/10 overflow-hidden">
                  {([
                    { value: "both", label: "Campuran" },
                    { value: "truth", label: "Truth" },
                    { value: "dare", label: "Dare" },
                  ] as const).map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setGenType(t.value)}
                      className={`flex-1 py-2 text-xs font-semibold tracking-wide transition ${
                        genType === t.value
                          ? "bg-[#FF3D7F]/20 text-[#FF6B9D]"
                          : "bg-transparent text-[#5C5470] hover:text-[#9B93B0]"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-[#9B93B0] mb-1.5">Tema / Kategori</label>
                <select
                  value={genCategory}
                  onChange={(e) => setGenCategory(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#18181C] px-3 py-2.5 text-sm text-[#FFF5F8] outline-none focus:border-[#FF3D7F]/40 transition"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} className="bg-[#18181C]">{c}</option>
                  ))}
                </select>
              </div>

              {/* Count */}
              <div>
                <label className="block text-xs font-medium text-[#9B93B0] mb-1.5">
                  Jumlah Pertanyaan
                  <span className="ml-2 font-bold text-[#FF6B9D]">{genCount}</span>
                </label>
                <input
                  type="range"
                  min={3}
                  max={10}
                  value={genCount}
                  onChange={(e) => setGenCount(Number(e.target.value))}
                  className="w-full accent-[#FF3D7F]"
                />
                <div className="flex justify-between text-[10px] text-[#5C5470] mt-1">
                  <span>3</span><span>10</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={genLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF3D7F] py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(255,61,127,0.25)] transition hover:bg-[#FF6B9D] disabled:cursor-not-allowed disabled:opacity-50"
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

            {genMsg && (
              <div className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs ${
                genMsg.ok
                  ? "border-[#34D399]/20 bg-[#34D399]/10 text-[#34D399]"
                  : "border-red-500/20 bg-red-500/10 text-red-300"
              }`}>
                {genMsg.ok
                  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                }
                {genMsg.text}
              </div>
            )}
          </div>
        </div>

        {/* ── Panel Kanan: Daftar pertanyaan ─────────────────────────────── */}
        <div>
          <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-6 h-full">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-sm font-semibold text-[#FFF5F8]">Pertanyaan Kalian</p>
                <p className="text-xs text-[#5C5470]">
                  {questions.length} pertanyaan
                  {pendingCount > 0 && (
                    <span className="ml-2 rounded-full bg-yellow-400/20 px-2 py-0.5 text-yellow-400">
                      {pendingCount} menunggu review
                    </span>
                  )}
                </p>
              </div>
            </div>

            {initialLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-20 animate-pulse rounded-xl bg-white/4" />
                ))}
              </div>
            ) : questions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-3 text-4xl">💭</div>
                <p className="font-medium text-[#9B93B0]">Belum ada pertanyaan kustom</p>
                <p className="mt-1 text-sm text-[#5C5470]">Kirim pertanyaanmu atau biarkan AI yang buat!</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {/* AI questions */}
                {aiQuestions.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-[#5C5470]">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                      </svg>
                      AI Generated ({aiQuestions.length})
                    </p>
                    {aiQuestions.map((q) => <QuestionCard key={q.id} q={q} />)}
                  </div>
                )}

                {/* User questions */}
                {userQuestions.length > 0 && (
                  <div className={aiQuestions.length > 0 ? "mt-5" : ""}>
                    <p className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-[#5C5470]">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2.5">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                      </svg>
                      Dikirim Manual ({userQuestions.length})
                    </p>
                    {userQuestions.map((q) => <QuestionCard key={q.id} q={q} />)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="mt-6 rounded-2xl border border-[#818CF8]/15 bg-[#818CF8]/5 p-4">
        <div className="flex gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2" className="shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="text-xs leading-relaxed text-[#9B93B0]">
            <strong className="text-[#A78BFA]">Pertanyaan AI</strong> langsung aktif dan bisa dipakai di game berikutnya.{" "}
            <strong className="text-[#A78BFA]">Pertanyaan manual</strong> perlu diulas admin terlebih dahulu sebelum aktif.
            Pertanyaan yang aktif akan muncul di pool saat membuat sesi game baru.
          </div>
        </div>
      </div>
    </main>
  );
}
