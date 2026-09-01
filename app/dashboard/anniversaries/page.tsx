"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import { dialog } from "@/components/ui/Dialog";
import type { Anniversary } from "@/lib/types";
import { DatePicker } from "@/components/DatePicker";

// Single client instance shared across all operations in this page
const supabase = createClient();

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
  currentUserId,
  onToggle,
  onDelete,
  onEdit,
}: {
  item: Anniversary;
  loading: boolean;
  currentUserId: string | null;
  onToggle: (item: Anniversary) => void;
  onDelete: (id: number) => void;
  onEdit: (item: Anniversary) => void;
}) {
  const isOwn = currentUserId ? item.user_id === currentUserId : true;
  const days = daysUntil(item.date);
  const isToday = days === 0 || days === 365;
  const isSoon = days <= 7 && !isToday;

  async function handleDeleteClick() {
    const confirmed = await dialog.confirm({
      title: "Hapus Momen?",
      description: `Apakah kamu yakin ingin menghapus momen "${item.title}"?`,
      confirmText: "Ya, Hapus",
      cancelText: "Batal",
      isDanger: true,
    });
    if (confirmed) {
      onDelete(item.id);
    }
  }

  return (
    <div
      className={`rounded-2xl border p-5 sm:p-6 transition shadow-xl shadow-black/2 ${
        item.is_active
          ? "border-[#E7E5E4] bg-white"
          : "border-[#E7E5E4] bg-[#FCFBF7] opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Icon + content */}
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl border ${
              item.is_active ? "border-[#E7E5E4] bg-[#FDF4F2] text-[#C84B31]" : "border-[#E7E5E4] bg-[#FCFBF7] text-[#78716C]"
            }`}
          >
            {isToday ? "🎉" : isSoon ? "⏳" : "📅"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm sm:text-base font-bold text-[#1F1D1B]">{item.title}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                isOwn
                  ? "bg-[#FDF4F2] text-[#C84B31] border border-[#FBDCD5]"
                  : "bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]"
              }`}>
                {isOwn ? "Saya" : "Partner"}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#78716C]">{formatDate(item.date)}</p>
            {item.notes && (
              <p className="mt-2 text-xs leading-relaxed text-[#78716C] bg-[#FCFBF7] border border-[#F5F5F4] p-2.5 rounded-xl">{item.notes}</p>
            )}
          </div>
        </div>

        {/* Countdown badge */}
        <div className="shrink-0 text-right">
          {isToday ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#C84B31]/20 bg-[#FDF4F2] px-3 py-1 text-xs font-bold text-[#C84B31]">
              Hari ini! 🎊
            </span>
          ) : (
            <div>
              <p className={`font-mono text-2xl font-bold tabular-nums ${isSoon ? "text-[#D97706]" : "text-[#1F1D1B]"}`}>
                {days}
              </p>
              <p className="text-[10px] text-[#78716C]">hari lagi</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#F5F5F4] pt-4">
        {/* Edit button */}
        <button
          type="button"
          onClick={() => onEdit(item)}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-[#E7E5E4] bg-white px-3 py-1.5 text-xs font-semibold text-[#1F1D1B] transition hover:border-[#C84B31] hover:text-[#C84B31] disabled:opacity-50 cursor-pointer shadow-xs"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Edit
        </button>

        <button
          type="button"
          onClick={() => onToggle(item)}
          disabled={loading}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
            item.is_active
              ? "border-[#E7E5E4] bg-[#FCFBF7] text-[#78716C] hover:bg-white hover:text-[#1F1D1B]"
              : "border-[#C84B31]/30 bg-[#FDF4F2] text-[#C84B31] hover:bg-[#FDF4F2]/80"
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

        <button
          type="button"
          onClick={handleDeleteClick}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50/50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100/50 cursor-pointer disabled:opacity-50"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" strokeLinecap="round" />
          </svg>
          Hapus
        </button>

        {/* Active indicator */}
        {item.is_active && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] font-semibold text-[#10B981]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
            Aktif
          </span>
        )}
      </div>
    </div>
  );
}

// ── Edit Modal ─────────────────────────────────────────────────────────────────

function EditModal({
  item,
  onClose,
  onSaved,
}: {
  item: Anniversary;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [date, setDate] = useState(item.date);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await supabase
      .from("anniversaries")
      .update({ title, date, notes: notes || null })
      .eq("id", item.id);

    if (err) {
      setError(err.message);
      toast.error("Gagal Menyimpan", err.message);
    } else {
      toast.success("Perubahan Disimpan", "Detail momen berhasil diperbarui.");
      onSaved();
      onClose();
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-xs"
        onClick={() => !loading && onClose()}
      />

      {/* Modal card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#E7E5E4] bg-white shadow-2xl">
        <div className="p-6">
          {/* Header */}
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FDF4F2] text-[#C84B31] border border-[#E7E5E4]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-[#1F1D1B]">Edit Momen</p>
                <p className="text-xs text-[#78716C]">Perbarui detail momen spesial ini</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#78716C] transition hover:bg-[#FCFBF7] hover:text-[#1F1D1B] disabled:opacity-50 cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-[#1F1D1B]">
                Judul Momen
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-4 py-2.5 text-xs font-medium text-[#1F1D1B] outline-none placeholder:text-[#A8A29E] focus:border-[#C84B31] focus:bg-white transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F1D1B]">
                Tanggal
              </label>
              <DatePicker value={date} onChange={setDate} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F1D1B]">
                Catatan <span className="text-[#78716C] font-normal">(opsional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1.5 w-full resize-none rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-4 py-2.5 text-xs text-[#1F1D1B] outline-none placeholder:text-[#A8A29E] focus:border-[#C84B31] focus:bg-white transition"
                rows={3}
                placeholder="Ceritakan momen ini..."
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 rounded-xl border border-[#E7E5E4] bg-white py-2.5 text-xs font-semibold text-[#78716C] transition hover:bg-[#FCFBF7] hover:text-[#1F1D1B] disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading || !title || !date}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#C84B31] py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#B33E26] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {loading ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AnniversariesPage() {
  const [items, setItems] = useState<Anniversary[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<Anniversary | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadAnniversaries = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("anniversaries")
      .select("*")
      .order("date", { ascending: true });

    if (err) {
      toast.error("Gagal Memuat", err.message);
      return;
    }
    setItems((data as Anniversary[]) ?? []);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
    loadAnniversaries().finally(() => setInitialLoading(false));
  }, [loadAnniversaries]);

  // Real-time: refreh saat ada perubahan anniversary (milik sendiri atau partner)
  useEffect(() => {
    const channel = supabase
      .channel("anniversaries-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "anniversaries" }, () => {
        loadAnniversaries();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadAnniversaries]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error: err } = await supabase.from("anniversaries").insert({
      user_id: user.id, title, date, notes: notes || null, is_active: true,
    });

    if (err) {
      toast.error("Gagal Menyimpan", err.message);
    } else {
      toast.success("Momen Disimpan!", `"${title}" berhasil ditambahkan ke pelacak momen.`);
      setTitle(""); setDate(""); setNotes("");
      await loadAnniversaries();
    }
    setLoading(false);
  }

  async function toggleActive(item: Anniversary) {
    setLoading(true);
    const { error: err } = await supabase
      .from("anniversaries")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);

    if (err) {
      toast.error("Gagal Memperbarui", err.message);
    } else {
      toast.info(
        item.is_active ? "Dinonaktifkan" : "Diaktifkan",
        `Momen "${item.title}" ${item.is_active ? "dinonaktifkan" : "diaktifkan kembali"}.`
      );
      await loadAnniversaries();
    }
    setLoading(false);
  }

  async function remove(itemId: number) {
    setLoading(true);
    const { error: err } = await supabase.from("anniversaries").delete().eq("id", itemId);

    if (err) {
      toast.error("Gagal Menghapus", err.message);
    } else {
      toast.info("Dihapus", "Momen berhasil dihapus.");
      await loadAnniversaries();
    }
    setLoading(false);
  }

  const activeItems = items.filter((i) => i.is_active);
  const inactiveItems = items.filter((i) => !i.is_active);

  return (
    <main className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#E7E5E4] bg-[#FDF4F2] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#C84B31]">
          <span>📅</span>
          <span>Pelacak Momen</span>
        </div>
        <h1 className="mt-3 font-serif text-3xl sm:text-4xl text-[#1F1D1B] tracking-tight">
          Anniversary Tracker
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-[#78716C]">
          Catat dan hitung mundur tanggal jadian, ulang tahun, dan momen penting kalian.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left — form */}
        <div className="lg:col-span-2">
          <div className="sticky top-24 rounded-2xl border border-[#E7E5E4] bg-white p-6 sm:p-8 shadow-xl shadow-black/2">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FDF4F2] text-[#C84B31] border border-[#E7E5E4]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="3" />
                  <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
                  <path d="M12 14v4M10 16h4" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#78716C]">Tambah Momen Baru</h2>
                <p className="text-[11px] text-[#A8A29E]">Simpan momen berharga bersama</p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleCreate}>
              <div>
                <label className="block text-xs font-semibold text-[#1F1D1B]" htmlFor="ann-title">
                  Judul Momen
                </label>
                <input
                  id="ann-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-4 py-2.5 text-xs font-medium text-[#1F1D1B] outline-none placeholder:text-[#A8A29E] focus:border-[#C84B31] focus:bg-white transition"
                  placeholder="Hari Jadian Kita"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F1D1B]">
                  Tanggal
                </label>
                <DatePicker value={date} onChange={setDate} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F1D1B]" htmlFor="ann-notes">
                  Catatan <span className="text-[#78716C] font-normal">(opsional)</span>
                </label>
                <textarea
                  id="ann-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1.5 w-full resize-none rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-4 py-2.5 text-xs text-[#1F1D1B] outline-none placeholder:text-[#A8A29E] focus:border-[#C84B31] focus:bg-white transition"
                  rows={3}
                  placeholder="Ceritakan kenangan momen ini..."
                />
              </div>

              <button
                type="submit"
                disabled={loading || !date || !title}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C84B31] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#B33E26] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
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
          </div>
        </div>

        {/* Right — list */}
        <div className="space-y-6 lg:col-span-3">
          {initialLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-36 animate-pulse rounded-2xl bg-white border border-[#E7E5E4]" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#E7E5E4] bg-white py-16 text-center">
              <div className="mb-3 text-4xl">📅</div>
              <p className="text-xs font-bold text-[#1F1D1B]">Belum ada momen tersimpan</p>
              <p className="mt-1 text-xs text-[#78716C]">Tambahkan momen penting pertama kalian pada form di samping.</p>
            </div>
          ) : (
            <>
              {activeItems.length > 0 && (
                <div>
                  <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#78716C]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                    Momen Aktif ({activeItems.length})
                  </p>
                  <div className="space-y-3">
                    {activeItems.map((item) => (
                      <AnniversaryCard
                        key={item.id}
                        item={item}
                        loading={loading}
                        currentUserId={currentUserId}
                        onToggle={toggleActive}
                        onDelete={remove}
                        onEdit={setEditingItem}
                      />
                    ))}
                  </div>
                </div>
              )}

              {inactiveItems.length > 0 && (
                <div>
                  <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#78716C]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#A8A29E]" />
                    Momen Nonaktif ({inactiveItems.length})
                  </p>
                  <div className="space-y-3">
                    {inactiveItems.map((item) => (
                      <AnniversaryCard
                        key={item.id}
                        item={item}
                        loading={loading}
                        currentUserId={currentUserId}
                        onToggle={toggleActive}
                        onDelete={remove}
                        onEdit={setEditingItem}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <EditModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={loadAnniversaries}
        />
      )}
    </main>
  );
}
