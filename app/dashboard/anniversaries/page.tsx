"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Anniversary } from "@/lib/types";
import { DatePicker } from "@/components/DatePicker";

function daysUntil(dateStr: string): number {
  const today = new Date();
  const target = new Date(dateStr);
  target.setFullYear(today.getFullYear());
  if (target < today) target.setFullYear(today.getFullYear() + 1);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function AnniversaryCard({
  item,
  loading,
  onToggle,
  onDelete,
}: {
  item: Anniversary;
  loading: boolean;
  onToggle: (item: Anniversary) => void;
  onDelete: (id: number) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const days = daysUntil(item.date);
  const isToday = days === 0 || days === 365;
  const isSoon = days <= 7 && !isToday;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-5 transition-all ${
        item.is_active
          ? "border-[#F472B6]/20 bg-linear-to-br from-[#F472B6]/8 to-transparent"
          : "border-white/[0.07] bg-[#111113] opacity-60"
      }`}
    >
      {/* Glow */}
      {item.is_active && (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl"
          style={{ background: "rgba(244,114,182,0.12)" }}
        />
      )}

      <div className="flex items-start justify-between gap-3">
        {/* Icon + content */}
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl ${
              item.is_active ? "bg-[#F472B6]/15" : "bg-white/5"
            }`}
          >
            {isToday ? "🎉" : isSoon ? "⏳" : "📅"}
          </div>
          <div>
            <p className="font-semibold text-[#FFF5F8]">{item.title}</p>
            <p className="mt-0.5 text-xs text-[#5C5470]">{formatDate(item.date)}</p>
            {item.notes && (
              <p className="mt-2 text-sm leading-relaxed text-[#9B93B0]">{item.notes}</p>
            )}
          </div>
        </div>

        {/* Countdown badge */}
        <div className="shrink-0 text-right">
          {isToday ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#F472B6]/30 bg-[#F472B6]/15 px-2.5 py-1 text-xs font-bold text-[#F472B6]">
              Hari ini! 🎊
            </span>
          ) : (
            <div>
              <p className={`text-2xl font-bold tabular-nums ${isSoon ? "text-yellow-400" : "text-[#FFF5F8]"}`}>
                {days}
              </p>
              <p className="text-[10px] text-[#5C5470]">hari lagi</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2 border-t border-white/6 pt-4">
        <button
          type="button"
          onClick={() => onToggle(item)}
          disabled={loading}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            item.is_active
              ? "border-white/10 bg-white/5 text-[#9B93B0] hover:bg-white/10"
              : "border-[#F472B6]/25 bg-[#F472B6]/10 text-[#F472B6] hover:bg-[#F472B6]/15"
          } disabled:opacity-50`}
        >
          {item.is_active ? (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
              Nonaktifkan
            </>
          ) : (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Aktifkan
            </>
          )}
        </button>

        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/15"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" strokeLinecap="round" />
            </svg>
            Hapus
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#9B93B0]">Yakin?</span>
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              disabled={loading}
              className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"
            >
              Ya
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-[#9B93B0] transition hover:bg-white/10"
            >
              Batal
            </button>
          </div>
        )}

        {/* Active indicator */}
        {item.is_active && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-[#34D399]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#34D399] shadow-[0_0_6px_#34D399]" />
            Aktif
          </span>
        )}
      </div>
    </div>
  );
}

export default function AnniversariesPage() {
  const [items, setItems] = useState<Anniversary[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const loadAnniversaries = useCallback(async () => {
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("anniversaries")
      .select("*")
      .order("date", { ascending: true });

    if (err) { setError(err.message); return; }
    setItems((data as Anniversary[]) ?? []);
  }, []);

  useEffect(() => {
    loadAnniversaries().finally(() => setInitialLoading(false));
  }, [loadAnniversaries]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError(null); setStatus(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error: err } = await supabase.from("anniversaries").insert({
      user_id: user.id, title, date, notes: notes || null, is_active: true,
    });

    if (err) { setError(err.message); }
    else {
      setStatus("Momen berhasil disimpan!");
      setTitle(""); setDate(""); setNotes("");
      await loadAnniversaries();
    }
    setLoading(false);
  }

  async function toggleActive(item: Anniversary) {
    setLoading(true); setError(null); setStatus(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("anniversaries")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);

    if (err) setError(err.message);
    else await loadAnniversaries();
    setLoading(false);
  }

  async function remove(itemId: number) {
    setLoading(true); setError(null); setStatus(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("anniversaries").delete().eq("id", itemId);

    if (err) setError(err.message);
    else { setStatus("Momen berhasil dihapus."); await loadAnniversaries(); }
    setLoading(false);
  }

  const activeItems = items.filter((i) => i.is_active);
  const inactiveItems = items.filter((i) => !i.is_active);

  return (
    <main className="relative mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full blur-[120px]"
        style={{ background: "radial-gradient(ellipse, rgba(244,114,182,0.10) 0%, transparent 70%)" }}
      />

      {/* Header */}
      <div className="mb-10">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#5C5470]">Dashboard / Anniversary</p>
        <h1 className="mt-2 text-2xl sm:text-4xl font-bold tracking-tight text-[#FFF5F8]">
          Anniversary{" "}
          <span style={{ backgroundImage: "linear-gradient(90deg, #F472B6, #E879F9)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Tracker
          </span>
        </h1>
        <p className="mt-2 text-sm text-[#5C5470]">Catat semua momen penting kalian. Jangan sampai terlewat.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left — form */}
        <div className="lg:col-span-2">
          <div className="sticky top-6 rounded-2xl border border-[#F472B6]/15 bg-linear-to-br from-[#F472B6]/8 to-[#111113] p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F472B6]/15">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F472B6" strokeWidth="1.8">
                  <rect x="3" y="4" width="18" height="18" rx="3" />
                  <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
                  <path d="M12 14v4M10 16h4" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#FFF5F8]">Tambah Momen Baru</p>
                <p className="text-xs text-[#5C5470]">Simpan momen berharga kalian</p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleCreate}>
              <div>
                <label className="block text-xs font-medium text-[#9B93B0]" htmlFor="ann-title">
                  Judul Momen
                </label>
                <input
                  id="ann-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#18181C] px-4 py-2.5 text-sm text-[#FFF5F8] outline-none placeholder:text-[#5C5470] focus:border-[#F472B6]/40 focus:ring-1 focus:ring-[#F472B6]/20 transition"
                  placeholder="Hari jadian kita"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9B93B0]">
                  Tanggal
                </label>
                <DatePicker value={date} onChange={setDate} />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9B93B0]" htmlFor="ann-notes">
                  Catatan <span className="text-[#5C5470]">(opsional)</span>
                </label>
                <textarea
                  id="ann-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-[#18181C] px-4 py-2.5 text-sm text-[#FFF5F8] outline-none placeholder:text-[#5C5470] focus:border-[#F472B6]/40 focus:ring-1 focus:ring-[#F472B6]/20 transition"
                  rows={3}
                  placeholder="Ceritakan momen ini..."
                />
              </div>

              <button
                type="submit"
                disabled={loading || !date || !title}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F472B6] px-4 py-3 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(244,114,182,0.30)] transition hover:bg-[#E879F9] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                )}
                {loading ? "Menyimpan..." : "Simpan Momen"}
              </button>
            </form>

            {/* Feedback */}
            {status && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#34D399]/20 bg-[#34D399]/10 px-3 py-2.5 text-xs text-[#34D399]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {status}
              </div>
            )}
            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Right — list */}
        <div className="space-y-6 lg:col-span-3">
          {initialLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-36 animate-pulse rounded-2xl bg-white/4" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
              <div className="mb-4 text-5xl">📅</div>
              <p className="font-medium text-[#9B93B0]">Belum ada momen tersimpan</p>
              <p className="mt-1 text-sm text-[#5C5470]">Tambahkan momen pertama kalian di sebelah kiri.</p>
            </div>
          ) : (
            <>
              {activeItems.length > 0 && (
                <div>
                  <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-[#5C5470]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#34D399] shadow-[0_0_6px_#34D399]" />
                    Aktif ({activeItems.length})
                  </p>
                  <div className="space-y-3">
                    {activeItems.map((item) => (
                      <AnniversaryCard
                        key={item.id}
                        item={item}
                        loading={loading}
                        onToggle={toggleActive}
                        onDelete={remove}
                      />
                    ))}
                  </div>
                </div>
              )}

              {inactiveItems.length > 0 && (
                <div>
                  <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-[#5C5470]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#5C5470]" />
                    Nonaktif ({inactiveItems.length})
                  </p>
                  <div className="space-y-3">
                    {inactiveItems.map((item) => (
                      <AnniversaryCard
                        key={item.id}
                        item={item}
                        loading={loading}
                        onToggle={toggleActive}
                        onDelete={remove}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
