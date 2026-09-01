"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import { dialog } from "@/components/ui/Dialog";
import type { Wishlist, WishlistCategory } from "@/lib/types";

const supabase = createClient();

const CATEGORIES: { value: WishlistCategory; label: string; emoji: string; color: string }[] = [
  { value: "virtual", label: "Virtual",  emoji: "🎮", color: "text-[#4F46E5] bg-[#EEF2FF] border-[#E0E7FF]" },
  { value: "offline", label: "Offline",  emoji: "✈️", color: "text-[#0D9488] bg-[#F0FDFA] border-[#CCFBF1]" },
  { value: "dream",   label: "Impian",   emoji: "🌙", color: "text-[#C84B31] bg-[#FDF4F2] border-[#FBDCD5]" },
  { value: "gift",    label: "Hadiah",   emoji: "🎁", color: "text-[#D97706] bg-[#FEF3C7] border-[#FDE68A]" },
  { value: "other",   label: "Lainnya",  emoji: "📌", color: "text-[#78716C] bg-[#F5F5F4] border-[#E7E5E4]" },
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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => !loading && onClose()} />
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[#E7E5E4] bg-white shadow-2xl">
        <div className="h-1 w-full bg-[#10B981]" />
        <div className="p-6">
          <div className="mb-2 text-3xl text-center">🎉</div>
          <p className="text-center font-serif text-xl font-bold text-[#1F1D1B]">Yeay, sudah kesampaian!</p>
          <p className="mt-1 text-center text-xs text-[#78716C] truncate">"{item.title}"</p>
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-[#1F1D1B]">
                Tambah catatan <span className="font-normal text-[#78716C]">(opsional)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={200}
                placeholder="Cerita singkat tentang momen ini..."
                className="mt-1.5 w-full resize-none rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-3.5 py-2.5 text-xs text-[#1F1D1B] outline-none placeholder:text-[#A8A29E] focus:border-[#10B981] focus:bg-white transition"
              />
            </div>
            <div className="flex gap-3">
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
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#10B981] py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#059669] disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                Tandai Selesai
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
    if (json.success) {
      toast.success("Perubahan Disimpan", "Detail wishlist berhasil diperbarui.");
      onSaved();
      onClose();
    } else {
      setError(json.message);
      toast.error("Gagal Menyimpan", json.message);
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => !loading && onClose()} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#E7E5E4] bg-white shadow-2xl">
        <div className="h-1 w-full bg-[#C84B31]" />
        <div className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FDF4F2] text-[#C84B31] border border-[#E7E5E4]">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="font-serif text-lg font-bold text-[#1F1D1B]">Edit Wishlist</p>
                <p className="text-xs text-[#78716C]">Perbarui detail item wishlist ini</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#78716C] transition hover:bg-[#F5F5F4] hover:text-[#1F1D1B] disabled:opacity-50 cursor-pointer"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-[#1F1D1B]">Judul Wishlist</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={255}
                className="mt-1.5 w-full rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-4 py-2.5 text-xs text-[#1F1D1B] outline-none placeholder:text-[#A8A29E] focus:border-[#C84B31] focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F1D1B]">Kategori</label>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`rounded-xl border px-2.5 py-2 text-xs font-semibold transition cursor-pointer ${
                      category === cat.value
                        ? cat.color + " ring-1 ring-current"
                        : "border-[#E7E5E4] bg-white text-[#78716C] hover:bg-[#FCFBF7] hover:text-[#1F1D1B]"
                    }`}
                  >
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F1D1B]">
                Detail <span className="font-normal text-[#78716C]">(opsional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Info atau lokasi tambahan..."
                className="mt-1.5 w-full resize-none rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-4 py-2.5 text-xs text-[#1F1D1B] outline-none placeholder:text-[#A8A29E] focus:border-[#C84B31] focus:bg-white transition"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-600">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
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
                disabled={loading || !title.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#C84B31] py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#B33E26] disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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

  async function handleDeleteClick() {
    const confirmed = await dialog.confirm({
      title: "Hapus Wishlist?",
      description: `Apakah kamu yakin ingin menghapus "${item.title}" dari wishlist bersama?`,
      confirmText: "Ya, Hapus",
      cancelText: "Batal",
      isDanger: true,
    });
    if (confirmed) {
      onDelete(item.id);
    }
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 transition-all ${
      item.is_done
        ? "border-[#E7E5E4] bg-[#FAFAF9] opacity-80"
        : "border-[#E7E5E4] bg-white shadow-xl shadow-black/2 hover:border-[#D6D3D1]"
    }`}>
      {/* Done badge */}
      {item.is_done && (
        <div className="absolute top-4 right-4">
          <span className="rounded-full border border-[#10B981]/20 bg-[#EBF9EB] px-2.5 py-0.5 text-[10px] font-bold text-[#10B981]">
            ✓ Selesai
          </span>
        </div>
      )}

      <div className="flex items-start gap-3.5">
        {/* Checkbox / done indicator */}
        <button
          type="button"
          onClick={() => !item.is_done && onDoneClick(item)}
          disabled={item.is_done}
          title={item.is_done ? "Sudah selesai" : "Tandai selesai"}
          className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 transition cursor-pointer ${
            item.is_done
              ? "border-[#10B981] bg-[#10B981] flex items-center justify-center text-white"
              : "border-[#D6D3D1] hover:border-[#10B981]"
          }`}
        >
          {item.is_done && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
              <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1 pr-16">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-sm font-bold ${item.is_done ? "line-through text-[#A8A29E]" : "text-[#1F1D1B]"}`}>
              {item.title}
            </p>
            <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${cat.color}`}>
              {cat.emoji} {cat.label}
            </span>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              isOwn ? "border-[#FBDCD5] bg-[#FDF4F2] text-[#C84B31]" : "border-[#E0E7FF] bg-[#EEF2FF] text-[#4F46E5]"
            }`}>
              {isOwn ? "Saya" : "Partner"}
            </span>
          </div>

          {item.description && (
            <p className="mt-1.5 text-xs text-[#78716C] leading-relaxed">{item.description}</p>
          )}

          {item.is_done && item.done_note && (
            <p className="mt-2 text-xs italic text-[#78716C] bg-[#F5F5F4] rounded-lg px-3 py-1.5 inline-block">
              "{item.done_note}"
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      {isOwn && !item.is_done && (
        <div className="mt-4 flex items-center gap-2 border-t border-[#F5F5F4] pt-3">
          {/* Edit */}
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="flex items-center gap-1.5 rounded-lg border border-[#E7E5E4] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1F1D1B] transition hover:border-[#C84B31] hover:text-[#C84B31] cursor-pointer shadow-2xs"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Edit
          </button>

          <button
            type="button"
            onClick={handleDeleteClick}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-100/50 cursor-pointer shadow-2xs"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
            Hapus
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function WishlistPage() {
  const [items, setItems] = useState<Wishlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setActionLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [filter, setFilter] = useState<WishlistCategory | "all">("all");
  const [doneModal, setDoneModal] = useState<Wishlist | null>(null);
  const [editModal, setEditModal] = useState<Wishlist | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<WishlistCategory>("other");
  const [formLoading, setFormLoading] = useState(false);

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
      toast.success("Berhasil!", "Wishlist berhasil ditambahkan.");
      await loadItems();
    } else {
      toast.error("Gagal", json.message || "Gagal menambahkan wishlist");
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
    if (json.success) {
      toast.success("Yeay, Selesai!", "Wishlist berhasil ditandai selesai.");
      await loadItems();
    } else {
      toast.error("Gagal", json.message || "Gagal memperbarui status");
    }
    setActionLoading(false);
  }

  async function handleDelete(id: number) {
    setActionLoading(true);
    const res = await fetch(`/api/wishlist/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) {
      toast.info("Dihapus", "Wishlist telah dihapus.");
      await loadItems();
    } else {
      toast.error("Gagal Menghapus", json.message || "Gagal menghapus wishlist");
    }
    setActionLoading(false);
  }

  const filtered = items.filter((i) => filter === "all" || i.category === filter);
  const doneCount = items.filter((i) => i.is_done).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <main className="relative mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#E7E5E4] bg-[#FDF4F2] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#C84B31]">
          <span>✨</span>
          <span>Daftar Keinginan Bersama</span>
        </div>
        <h1 className="mt-3 font-serif text-3xl sm:text-4xl text-[#1F1D1B] tracking-tight">
          Shared Wishlist
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-[#78716C]">
          Bucket list bersama — dari rencana kencan virtual sampai impian masa depan.
        </p>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="mb-8 rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-xl shadow-black/2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#78716C]">Progress Bucket List</p>
              <p className="mt-0.5 text-xs text-[#78716C]">Wujudkan impian satu per satu bersama pasangan.</p>
            </div>
            <div className="text-right">
              <span className="font-mono text-xl font-bold text-[#C84B31]">{doneCount}/{totalCount}</span>
              <span className="ml-1 text-xs text-[#78716C]">selesai</span>
            </div>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[#F5F5F4]">
            <div
              className="h-full rounded-full bg-[#C84B31] transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] font-semibold text-[#78716C]">{progress}% dari total wishlist berhasil diwujudkan 🎉</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left — Form tambah */}
        <div className="lg:col-span-2">
          <div className="sticky top-6 rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-xl shadow-black/2">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FDF4F2] text-[#C84B31] border border-[#E7E5E4]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p className="font-serif text-lg font-bold text-[#1F1D1B]">Tambah Wishlist</p>
                <p className="text-xs text-[#78716C]">Tulis hal yang ingin dilakukan</p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleCreate}>
              <div>
                <label className="block text-xs font-semibold text-[#1F1D1B]" htmlFor="wish-title">Judul Wishlist</label>
                <input
                  id="wish-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={255}
                  placeholder="Nonton film bareng via Teleparty"
                  className="mt-1.5 w-full rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-4 py-2.5 text-xs text-[#1F1D1B] outline-none placeholder:text-[#A8A29E] focus:border-[#C84B31] focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F1D1B]">
                  Kategori
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setCategory(cat.value)}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                        category === cat.value
                          ? cat.color + " ring-1 ring-current"
                          : "border-[#E7E5E4] bg-white text-[#78716C] hover:bg-[#FCFBF7] hover:text-[#1F1D1B]"
                      }`}
                    >
                      {cat.emoji} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F1D1B]" htmlFor="wish-desc">
                  Detail <span className="font-normal text-[#78716C]">(opsional)</span>
                </label>
                <textarea
                  id="wish-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Info atau referensi tambahan..."
                  className="mt-1.5 w-full resize-none rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-4 py-2.5 text-xs text-[#1F1D1B] outline-none placeholder:text-[#A8A29E] focus:border-[#C84B31] focus:bg-white transition"
                />
              </div>

              <button
                type="submit"
                disabled={formLoading || !title.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C84B31] px-4 py-3 text-xs font-semibold text-white shadow-xs transition hover:bg-[#B33E26] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
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
                {formLoading ? "Menyimpan..." : "Tambah ke Wishlist"}
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
              className={`rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                filter === "all"
                  ? "border-[#C84B31] bg-[#FDF4F2] text-[#C84B31]"
                  : "border-[#E7E5E4] bg-white text-[#78716C] hover:text-[#1F1D1B]"
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
                  className={`rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    filter === cat.value
                      ? cat.color + " ring-1 ring-current"
                      : "border-[#E7E5E4] bg-white text-[#78716C] hover:text-[#1F1D1B]"
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
                <div key={n} className="h-24 animate-pulse rounded-2xl bg-white border border-[#E7E5E4]" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#E7E5E4] bg-white py-16 text-center">
              <div className="mb-3 text-4xl">📋</div>
              <p className="text-sm font-bold text-[#1F1D1B]">
                {filter === "all" ? "Belum ada wishlist" : "Tidak ada item di kategori ini"}
              </p>
              <p className="mt-1 text-xs text-[#78716C]">
                {filter === "all" ? "Tambahkan hal pertama yang ingin kalian wujudkan bersama!" : "Coba pilih kategori lain di atas."}
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
