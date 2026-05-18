"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Wishlist, WishlistCategory } from "@/lib/types";

const supabase = createClient();

const CATEGORIES: { value: WishlistCategory; label: string; emoji: string; color: string }[] = [
  { value: "virtual", label: "Virtual",  emoji: "🎮", color: "text-[#818CF8] bg-[#818CF8]/15 border-[#818CF8]/25" },
  { value: "offline", label: "Offline",  emoji: "✈️", color: "text-[#34D399] bg-[#34D399]/15 border-[#34D399]/25" },
  { value: "dream",   label: "Impian",   emoji: "🌙", color: "text-[#F472B6] bg-[#F472B6]/15 border-[#F472B6]/25" },
  { value: "gift",    label: "Hadiah",   emoji: "🎁", color: "text-yellow-400 bg-yellow-400/15 border-yellow-400/25" },
  { value: "other",   label: "Lainnya",  emoji: "📌", color: "text-[#9B93B0] bg-white/8 border-white/15" },
];

function getCat(v: WishlistCategory) {
  return CATEGORIES.find((c) => c.value === v) ?? CATEGORIES[4];
}

// ── Modal Tandai Selesai ─────────────────────────────────────────────────────
function DoneModal({ item, onClose, onDone }: {
  item: Wishlist;
  onClose: () => void;
  onDone: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    await onDone(note);
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !loading && onClose()} />
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[#34D399]/20 bg-[#0E0E12] shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        <div className="h-0.5 w-full bg-linear-to-r from-[#34D399] to-[#6EE7B7]" />
        <div className="p-6">
          <div className="mb-1 text-2xl text-center">🎉</div>
          <p className="text-center text-base font-bold text-[#FFF5F8]">Yeay, sudah kesampaian!</p>
          <p className="mt-1 text-center text-xs text-[#5C5470] truncate">"{item.title}"</p>
          <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-medium text-[#9B93B0]">
                Tambah catatan <span className="text-[#5C5470]">(opsional)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={200}
                placeholder="Cerita singkat tentang momen ini..."
                className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-[#18181C] px-3 py-2 text-sm text-[#FFF5F8] outline-none placeholder:text-[#5C5470] focus:border-[#34D399]/40 focus:ring-1 focus:ring-[#34D399]/20 transition"
              />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} disabled={loading}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-[#9B93B0] transition hover:bg-white/10 disabled:opacity-50">
                Batal
              </button>
              <button type="submit" disabled={loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#34D399] py-2.5 text-sm font-semibold text-[#0E0E12] shadow-[0_4px_16px_rgba(52,211,153,0.3)] transition hover:bg-[#6EE7B7] disabled:opacity-50">
                {loading ? (
                  <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                  </svg>
                ) : "✓"} Tandai Selesai
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Modal Edit ──────────────────────────────────────────────────────────────
function EditModal({ item, onClose, onSaved }: {
  item: Wishlist;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? "");
  const [category, setCategory] = useState<WishlistCategory>(item.category);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true); setError(null);
    const res = await fetch(`/api/wishlist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, category }),
    });
    const json = await res.json();
    if (json.success) { onSaved(); onClose(); }
    else setError(json.message);
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !loading && onClose()} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#818CF8]/20 bg-[#0E0E12] shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        <div className="h-0.5 w-full bg-linear-to-r from-[#818CF8] to-[#A78BFA]" />
        <div className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#818CF8]/15">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#FFF5F8]">Edit Wishlist</p>
                <p className="text-xs text-[#5C5470]">Perbarui detail wishlist ini</p>
              </div>
            </div>
            <button type="button" onClick={onClose} disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#5C5470] transition hover:bg-white/5 hover:text-[#9B93B0] disabled:opacity-50">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-medium text-[#9B93B0]">Judul</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={255}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#18181C] px-4 py-2.5 text-sm text-[#FFF5F8] outline-none placeholder:text-[#5C5470] focus:border-[#818CF8]/40 focus:ring-1 focus:ring-[#818CF8]/20 transition" />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9B93B0]">Kategori</label>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {CATEGORIES.map((cat) => (
                  <button key={cat.value} type="button" onClick={() => setCategory(cat.value)}
                    className={`rounded-xl border px-2 py-1.5 text-xs font-medium transition ${
                      category === cat.value ? cat.color + " ring-1 ring-current" : "border-white/10 bg-white/3 text-[#9B93B0] hover:bg-white/8"
                    }`}>
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9B93B0]">Detail <span className="text-[#5C5470]">(opsional)</span></label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={500}
                placeholder="Info tambahan..."
                className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-[#18181C] px-4 py-2.5 text-sm text-[#FFF5F8] outline-none placeholder:text-[#5C5470] focus:border-[#818CF8]/40 focus:ring-1 focus:ring-[#818CF8]/20 transition" />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} disabled={loading}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-[#9B93B0] transition hover:bg-white/10 disabled:opacity-50">
                Batal
              </button>
              <button type="submit" disabled={loading || !title.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#818CF8] py-2.5 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(129,140,248,0.25)] transition hover:bg-[#A78BFA] disabled:opacity-50">
                {loading ? (
                  <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" /></svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                )}
                {loading ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Wishlist Card ────────────────────────────────────────────────────────────
function WishlistCard({ item, currentUserId, onDoneClick, onDelete, onEdit }: {
  item: Wishlist;
  currentUserId: string;
  onDoneClick: (item: Wishlist) => void;
  onDelete: (id: number) => void;
  onEdit: (item: Wishlist) => void;
}) {
  const cat = getCat(item.category);
  const isOwn = item.created_by === currentUserId;
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 transition-all ${
      item.is_done
        ? "border-white/[0.06] bg-[#111113] opacity-60"
        : "border-white/[0.09] bg-[#111113] hover:border-white/15"
    }`}>
      {/* Done ribbon */}
      {item.is_done && (
        <div className="absolute top-3 right-3">
          <span className="rounded-full border border-[#34D399]/30 bg-[#34D399]/10 px-2 py-0.5 text-[10px] font-bold text-[#34D399]">✓ Selesai</span>
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Checkbox / done indicator */}
        <button
          type="button"
          onClick={() => !item.is_done && onDoneClick(item)}
          disabled={item.is_done}
          title={item.is_done ? "Sudah selesai" : "Tandai selesai"}
          className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 transition ${
            item.is_done
              ? "border-[#34D399] bg-[#34D399] flex items-center justify-center"
              : "border-white/20 hover:border-[#34D399]/60"
          }`}
        >
          {item.is_done && (
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`font-medium ${item.is_done ? "line-through text-[#5C5470]" : "text-[#FFF5F8]"}`}>
              {item.title}
            </p>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cat.color}`}>
              {cat.emoji} {cat.label}
            </span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              isOwn ? "bg-[#FF3D7F]/15 text-[#FF6B9D]" : "bg-[#818CF8]/15 text-[#818CF8]"
            }`}>
              {isOwn ? "Saya" : "Partner"}
            </span>
          </div>

          {item.description && (
            <p className="mt-1 text-xs text-[#9B93B0] leading-relaxed">{item.description}</p>
          )}

          {item.is_done && item.done_note && (
            <p className="mt-1.5 text-xs italic text-[#5C5470]">"{item.done_note}"</p>
          )}
        </div>
      </div>

      {/* Actions — hanya owner, hanya jika belum selesai */}
      {isOwn && !item.is_done && (
        <div className="mt-3 flex items-center gap-2 border-t border-white/[0.05] pt-3">
          {/* Edit */}
          <button type="button" onClick={() => onEdit(item)}
            className="flex items-center gap-1 rounded-lg border border-[#818CF8]/20 bg-[#818CF8]/8 px-2.5 py-1 text-[11px] font-medium text-[#818CF8] transition hover:bg-[#818CF8]/15">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Edit
          </button>

          {!confirmDelete ? (
            <button type="button" onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/5 px-2.5 py-1 text-[11px] font-medium text-red-400 transition hover:bg-red-500/15">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
              Hapus
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#9B93B0]">Yakin?</span>
              <button type="button" onClick={() => onDelete(item.id)}
                className="rounded-lg bg-red-500 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-red-400">Ya</button>
              <button type="button" onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-[#9B93B0] transition hover:bg-white/10">Batal</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function WishlistPage() {
  const [items, setItems] = useState<Wishlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [filter, setFilter] = useState<WishlistCategory | "all">("all");
  const [doneModal, setDoneModal] = useState<Wishlist | null>(null);
  const [editModal, setEditModal] = useState<Wishlist | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<WishlistCategory>("other");
  const [formLoading, setFormLoading] = useState(false);

  function showToast(ok: boolean, text: string) {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 3500);
  }

  const loadItems = useCallback(async () => {
    const res = await fetch("/api/wishlist");
    const json = await res.json();
    if (json.success) setItems(json.data ?? []);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
    loadItems().finally(() => setLoading(false));
  }, [loadItems]);

  // Realtime sync
  useEffect(() => {
    const channel = supabase
      .channel("wishlists-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "wishlists" }, loadItems)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadItems]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setFormLoading(true);
    const res = await fetch("/api/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, category }),
    });
    const json = await res.json();
    if (json.success) {
      setTitle(""); setDescription(""); setCategory("other");
      showToast(true, "Wishlist ditambahkan!");
      await loadItems();
    } else {
      showToast(false, json.message);
    }
    setFormLoading(false);
  }

  async function handleDone(note: string) {
    if (!doneModal) return;
    setActionLoading(true);
    const res = await fetch(`/api/wishlist/${doneModal.id}/done`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done_note: note }),
    });
    const json = await res.json();
    setDoneModal(null);
    showToast(json.success, json.message);
    if (json.success) await loadItems();
    setActionLoading(false);
  }

  async function handleDelete(id: number) {
    setActionLoading(true);
    const res = await fetch(`/api/wishlist/${id}`, { method: "DELETE" });
    const json = await res.json();
    showToast(json.success, json.message || "Dihapus");
    if (json.success) await loadItems();
    setActionLoading(false);
  }

  const filtered = items.filter((i) => filter === "all" || i.category === filter);
  const doneCount = items.filter((i) => i.is_done).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <main className="relative mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
      {/* Ambient glow */}
      <div aria-hidden
        className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full blur-[120px]"
        style={{ background: "radial-gradient(ellipse, rgba(52,211,153,0.08) 0%, transparent 70%)" }}
      />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium shadow-2xl transition-all ${
          toast.ok
            ? "border-[#34D399]/20 bg-[#0E0E12] text-[#34D399]"
            : "border-red-500/20 bg-[#0E0E12] text-red-400"
        }`}>
          {toast.ok
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          }
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="mb-10">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#5C5470]">Dashboard / Wishlist</p>
        <h1 className="mt-2 text-2xl sm:text-4xl font-bold tracking-tight text-[#FFF5F8]">
          Shared{" "}
          <span style={{ backgroundImage: "linear-gradient(90deg, #34D399, #6EE7B7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Wishlist
          </span>
        </h1>
        <p className="mt-2 text-sm text-[#5C5470]">Bucket list bersama — dari yang bisa dilakukan sekarang sampai impian masa depan.</p>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="mb-6 rounded-2xl border border-white/[0.07] bg-[#111113] p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-[#FFF5F8]">Progress Bersama</p>
            <span className="text-sm font-bold text-[#34D399]">{doneCount}/{totalCount} selesai</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-linear-to-r from-[#34D399] to-[#6EE7B7] transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-[#5C5470]">{progress}% dari total wishlist berhasil diwujudkan 🎉</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left — Form tambah */}
        <div className="lg:col-span-2">
          <div className="sticky top-6 rounded-2xl border border-[#34D399]/15 bg-linear-to-br from-[#34D399]/6 to-[#111113] p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#34D399]/15">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="1.8">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#FFF5F8]">Tambah Wishlist</p>
                <p className="text-xs text-[#5C5470]">Tulis hal yang ingin dilakukan</p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleCreate}>
              <div>
                <label className="block text-xs font-medium text-[#9B93B0]" htmlFor="wish-title">Judul</label>
                <input
                  id="wish-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={255}
                  placeholder="Nonton film bareng via Netflix Party"
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#18181C] px-4 py-2.5 text-sm text-[#FFF5F8] outline-none placeholder:text-[#5C5470] focus:border-[#34D399]/40 focus:ring-1 focus:ring-[#34D399]/20 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9B93B0]">
                  Kategori
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setCategory(cat.value)}
                      className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
                        category === cat.value
                          ? cat.color + " ring-1 ring-current"
                          : "border-white/10 bg-white/3 text-[#9B93B0] hover:bg-white/8"
                      }`}
                    >
                      {cat.emoji} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9B93B0]" htmlFor="wish-desc">
                  Detail <span className="text-[#5C5470]">(opsional)</span>
                </label>
                <textarea
                  id="wish-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Info tambahan..."
                  className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-[#18181C] px-4 py-2.5 text-sm text-[#FFF5F8] outline-none placeholder:text-[#5C5470] focus:border-[#34D399]/40 focus:ring-1 focus:ring-[#34D399]/20 transition"
                />
              </div>

              <button
                type="submit"
                disabled={formLoading || !title.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#34D399] px-4 py-3 text-sm font-semibold text-[#0E0E12] shadow-[0_4px_20px_rgba(52,211,153,0.25)] transition hover:bg-[#6EE7B7] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {formLoading ? (
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                )}
                {formLoading ? "Menyimpan..." : "Tambah Wishlist"}
              </button>
            </form>
          </div>
        </div>

        {/* Right — List */}
        <div className="space-y-5 lg:col-span-3">
          {/* Filter tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                filter === "all"
                  ? "border-white/20 bg-white/10 text-[#FFF5F8]"
                  : "border-white/[0.07] bg-transparent text-[#9B93B0] hover:bg-white/5"
              }`}
            >
              Semua ({items.length})
            </button>
            {CATEGORIES.map((cat) => {
              const count = items.filter((i) => i.category === cat.value).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setFilter(cat.value)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                    filter === cat.value
                      ? cat.color + " ring-1 ring-current"
                      : "border-white/[0.07] bg-transparent text-[#9B93B0] hover:bg-white/5"
                  }`}
                >
                  {cat.emoji} {cat.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Cards */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-20 animate-pulse rounded-2xl bg-white/4" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
              <div className="mb-4 text-5xl">📋</div>
              <p className="font-medium text-[#9B93B0]">
                {filter === "all" ? "Belum ada wishlist" : "Tidak ada item di kategori ini"}
              </p>
              <p className="mt-1 text-sm text-[#5C5470]">
                {filter === "all" ? "Tambahkan hal pertama yang ingin kalian wujudkan!" : "Coba pilih kategori lain."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => (
                <WishlistCard
                  key={item.id}
                  item={item}
                  currentUserId={currentUserId}
                  onDoneClick={setDoneModal}
                  onDelete={handleDelete}
                  onEdit={setEditModal}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Done Modal */}
      {doneModal && (
        <DoneModal
          item={doneModal}
          onClose={() => setDoneModal(null)}
          onDone={handleDone}
        />
      )}

      {/* Edit Modal */}
      {editModal && (
        <EditModal
          item={editModal}
          onClose={() => setEditModal(null)}
          onSaved={loadItems}
        />
      )}
    </main>
  );
}
