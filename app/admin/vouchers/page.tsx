"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { toast } from "@/components/ui/Toast";
import { dialog } from "@/components/ui/Dialog";
import { DatePicker } from "@/components/DatePicker";
import { Select } from "@/components/ui/Select";

type VoucherType = "coin_credit" | "topup_discount";
type VoucherStatus = "active" | "expired" | "exhausted" | "inactive";

type Voucher = {
  id: number;
  code: string;
  type: VoucherType;
  coin_value: number | null;
  discount_type: "percentage" | "fixed" | null;
  discount_value: number | null;
  max_discount: number | null;
  min_purchase: number | null;
  max_uses: number;
  uses_remaining: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  redemption_count: number;
};

type Redemption = {
  id: number;
  redeemed_at: string;
  users: {
    id: string;
    name: string;
    email: string;
    couple_code: string;
    avatar_url: string | null;
  } | null;
};

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "LDR-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function isExpired(v: Voucher) {
  if (!v.valid_until) return false;
  return new Date(v.valid_until).getTime() < Date.now();
}

function getVoucherStatus(v: Voucher): VoucherStatus {
  if (!v.is_active) return "inactive";
  if (v.uses_remaining <= 0) return "exhausted";
  if (isExpired(v)) return "expired";
  return "active";
}

function fmtDate(iso: string | null) {
  if (!iso) return "Selamanya";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtRp(n: number) {
  return "Rp" + n.toLocaleString("id-ID");
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function VoucherBadge({ type }: { type: VoucherType }) {
  if (type === "topup_discount") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF3C7] border border-[#FDE68A] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#D97706]">
        <span>🏷️</span> Diskon Topup
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF2FF] border border-[#E0E7FF] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#4F46E5]">
      <span>🪙</span> Coin Gratis
    </span>
  );
}

function DiscountLabel({ v }: { v: Voucher }) {
  if (v.type === "coin_credit") {
    return <span className="font-mono text-xs font-bold text-[#4F46E5]">+{v.coin_value} coin</span>;
  }
  if (v.discount_type === "percentage") {
    return (
      <div className="flex flex-col">
        <span className="font-mono text-xs font-bold text-[#D97706]">{v.discount_value}%</span>
        {v.max_discount ? (
          <span className="text-[10px] text-[#78716C]">Maks {fmtRp(v.max_discount)}</span>
        ) : null}
      </div>
    );
  }
  return <span className="font-mono text-xs font-bold text-[#D97706]">{fmtRp(v.discount_value ?? 0)}</span>;
}

export default function AdminVouchersPage() {
  const [vouchers, setVouchers]       = useState<Voucher[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingVoucher, setEditingVoucher]   = useState<Voucher | null>(null);
  const [submitting, setSubmitting]   = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType]   = useState<"all" | VoucherType>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | VoucherStatus>("all");

  // Usage Modal
  const [selectedVoucherForUsage, setSelectedVoucherForUsage] = useState<Voucher | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loadingUsage, setLoadingUsage] = useState(false);

  // Form state
  const [fType, setFType]                 = useState<VoucherType>("coin_credit");
  const [fCode, setFCode]                 = useState(() => generateCode());
  const [fMaxUses, setFMaxUses]           = useState("10");
  const [fValidUntil, setFValidUntil]     = useState("");
  // coin_credit fields
  const [fCoinValue, setFCoinValue]       = useState("10");
  // topup_discount fields
  const [fDiscountType, setFDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [fDiscountValue, setFDiscountValue] = useState("20");
  const [fMaxDiscount, setFMaxDiscount]   = useState("20000");
  const [fMinPurchase, setFMinPurchase]   = useState("50000");

  async function loadVouchers(showSpinner = true) {
    if (showSpinner) setLoading(true);
    try {
      const res  = await fetch("/api/admin/vouchers");
      const json = await res.json();
      setVouchers(json.data?.vouchers ?? []);
    } catch {
      toast.error("Gagal Memuat", "Tidak dapat mengambil data voucher.");
    }
    if (showSpinner) setLoading(false);
  }

  useEffect(() => {
    loadVouchers(true);
  }, []);

  function resetForm() {
    setFCode(generateCode());
    setFType("coin_credit");
    setFMaxUses("10");
    setFValidUntil("");
    setFCoinValue("10");
    setFDiscountType("percentage");
    setFDiscountValue("20");
    setFMaxDiscount("20000");
    setFMinPurchase("50000");
  }

  function handleOpenCreate() {
    setEditingVoucher(null);
    resetForm();
    setShowCreateModal(true);
  }

  function handleOpenEdit(v: Voucher) {
    setEditingVoucher(v);
    setFCode(v.code);
    setFType(v.type);
    setFMaxUses(String(v.max_uses));
    setFValidUntil(v.valid_until ? v.valid_until.slice(0, 10) : "");
    setFCoinValue(v.coin_value ? String(v.coin_value) : "10");
    setFDiscountType(v.discount_type ?? "percentage");
    setFDiscountValue(v.discount_value ? String(v.discount_value) : "20");
    setFMaxDiscount(v.max_discount ? String(v.max_discount) : "");
    setFMinPurchase(v.min_purchase ? String(v.min_purchase) : "");
    setShowCreateModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      code:        fCode.trim().toUpperCase(),
      type:        fType,
      max_uses:    Number(fMaxUses),
      valid_until: fValidUntil ? new Date(`${fValidUntil}T23:59:59.999Z`).toISOString() : null,
    };

    if (fType === "coin_credit") {
      payload.coin_value = Number(fCoinValue);
    } else {
      payload.discount_type  = fDiscountType;
      payload.discount_value = Number(fDiscountValue);
      payload.max_discount   = fDiscountType === "percentage" && fMaxDiscount ? Number(fMaxDiscount) : null;
      payload.min_purchase   = fMinPurchase ? Number(fMinPurchase) : null;
    }

    try {
      const url = editingVoucher
        ? `/api/admin/vouchers/${editingVoucher.id}`
        : "/api/admin/vouchers";
      const method = editingVoucher ? "PATCH" : "POST";

      const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(
          editingVoucher ? "Voucher Diperbarui" : "Voucher Dibuat",
          json.message || (editingVoucher ? "Voucher berhasil diperbarui." : "Voucher baru berhasil diterbitkan.")
        );
        setShowCreateModal(false);
        setEditingVoucher(null);
        resetForm();
        await loadVouchers(false);
      } else {
        toast.error(editingVoucher ? "Gagal Memperbarui" : "Gagal Membuat Voucher", json.message || "Terjadi kesalahan.");
      }
    } catch {
      toast.error(editingVoucher ? "Gagal Memperbarui" : "Gagal Membuat Voucher", "Koneksi bermasalah.");
    }
    setSubmitting(false);
  }

  async function handleToggle(v: Voucher) {
    const nextActive = !v.is_active;

    // Optimistic UI update: instantly flip the toggle without page reload or spinner
    setVouchers((prev) =>
      prev.map((item) => (item.id === v.id ? { ...item, is_active: nextActive } : item))
    );

    try {
      const res  = await fetch(`/api/admin/vouchers/${v.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ is_active: nextActive }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(
          nextActive ? "Voucher Diaktifkan" : "Voucher Dinonaktifkan",
          `Voucher ${v.code} berhasil ${nextActive ? "diaktifkan" : "dinonaktifkan"}.`
        );
        if (json.data?.voucher) {
          setVouchers((prev) =>
            prev.map((item) => (item.id === v.id ? { ...item, ...json.data.voucher } : item))
          );
        }
      } else {
        // Revert on error
        setVouchers((prev) =>
          prev.map((item) => (item.id === v.id ? { ...item, is_active: v.is_active } : item))
        );
        toast.error("Gagal Memperbarui", json.message || "Terjadi kesalahan.");
      }
    } catch {
      // Revert on network exception
      setVouchers((prev) =>
        prev.map((item) => (item.id === v.id ? { ...item, is_active: v.is_active } : item))
      );
      toast.error("Gagal Memperbarui", "Koneksi bermasalah.");
    }
  }

  async function handleDelete(v: Voucher) {
    const confirmed = await dialog.confirm({
      title: "Hapus Voucher?",
      description: `Apakah kamu yakin ingin menghapus voucher "${v.code}"? Tindakan ini tidak dapat dibatalkan. Semua data klaim terkait juga akan terhapus.`,
      confirmText: "Ya, Hapus",
      cancelText: "Batal",
      isDanger: true,
    });
    if (!confirmed) return;

    // Optimistic removal from table
    setVouchers((prev) => prev.filter((item) => item.id !== v.id));

    try {
      const res  = await fetch(`/api/admin/vouchers/${v.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast.success("Voucher Dihapus", `Voucher ${v.code} berhasil dihapus.`);
      } else {
        await loadVouchers(false);
        toast.error("Gagal Menghapus", json.message || "Terjadi kesalahan.");
      }
    } catch {
      await loadVouchers(false);
      toast.error("Gagal Menghapus", "Koneksi bermasalah.");
    }
  }

  async function handleOpenUsage(v: Voucher) {
    setSelectedVoucherForUsage(v);
    setLoadingUsage(true);
    try {
      const res = await fetch(`/api/admin/vouchers/${v.id}/redemptions`);
      const json = await res.json();
      if (json.success) {
        setRedemptions(json.data?.redemptions ?? []);
      } else {
        toast.error("Gagal Memuat Riwayat", json.message);
      }
    } catch {
      toast.error("Gagal Memuat Riwayat", "Koneksi bermasalah.");
    }
    setLoadingUsage(false);
  }

  function handleCopyCode(code: string) {
    navigator.clipboard.writeText(code);
    toast.success("Kode Tersalin", `Voucher ${code} disalin ke clipboard.`);
  }

  const usedCount = (v: Voucher) => v.max_uses - v.uses_remaining;
  const usagePct  = (v: Voucher) => Math.min(100, Math.round((usedCount(v) / v.max_uses) * 100));

  // Filtered vouchers
  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        if (!v.code.toLowerCase().includes(q)) return false;
      }
      // Type
      if (filterType !== "all" && v.type !== filterType) return false;
      // Status
      if (filterStatus !== "all") {
        const status = getVoucherStatus(v);
        if (status !== filterStatus) return false;
      }

      return true;
    });
  }, [vouchers, searchQuery, filterType, filterStatus]);

  // Overall statistics
  const stats = useMemo(() => {
    const total = vouchers.length;
    const active = vouchers.filter((v) => getVoucherStatus(v) === "active").length;
    const totalRedeemed = vouchers.reduce((acc, v) => acc + (v.max_uses - v.uses_remaining), 0);
    const totalMaxUses = vouchers.reduce((acc, v) => acc + v.max_uses, 0);

    return { total, active, totalRedeemed, totalMaxUses };
  }, [vouchers]);

  const inputCls = "w-full rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-3.5 py-2.5 text-xs text-[#1F1D1B] outline-none transition focus:border-[#C84B31] focus:bg-white placeholder:text-[#A8A29E]";
  const labelCls = "mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#78716C]";

  return (
    <div className="px-6 py-8 sm:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C84B31]">
            Promosi & Loyalty
          </p>
          <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#1F1D1B] sm:text-3xl">
            Manajemen Voucher
          </h1>
          <p className="mt-1 text-xs text-[#78716C]">
            Kelola kode promo coin gratis, diskon pembelian paket, dan monitor riwayat klaim user.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#C84B31] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#B33E26] cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          Buat Voucher
        </button>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-[#E7E5E4] bg-white p-5 shadow-xl shadow-black/2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#78716C]">Total Voucher</p>
          <p className="mt-2 font-mono text-2xl font-bold text-[#1F1D1B]">{stats.total}</p>
          <p className="mt-1 text-[11px] text-[#78716C]">Semua promo terdaftar</p>
        </div>
        <div className="rounded-2xl border border-[#10B981]/25 bg-[#EBF9EB]/50 p-5 shadow-xl shadow-black/2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#10B981]">Voucher Aktif</p>
          <p className="mt-2 font-mono text-2xl font-bold text-[#10B981]">{stats.active}</p>
          <p className="mt-1 text-[11px] text-[#10B981]/80">Siap & dapat diklaim user</p>
        </div>
        <div className="rounded-2xl border border-[#E0E7FF] bg-[#EEF2FF]/50 p-5 shadow-xl shadow-black/2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#4F46E5]">Total Klaim / Pakai</p>
          <p className="mt-2 font-mono text-2xl font-bold text-[#4F46E5]">{stats.totalRedeemed}</p>
          <p className="mt-1 text-[11px] text-[#4F46E5]/80">Dari kuota {stats.totalMaxUses} klaim</p>
        </div>
        <div className="rounded-2xl border border-[#FDE68A] bg-[#FEF3C7]/50 p-5 shadow-xl shadow-black/2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#D97706]">Rasio Penggunaan</p>
          <p className="mt-2 font-mono text-2xl font-bold text-[#D97706]">
            {stats.totalMaxUses > 0 ? `${Math.round((stats.totalRedeemed / stats.totalMaxUses) * 100)}%` : "0%"}
          </p>
          <p className="mt-1 text-[11px] text-[#D97706]/80">Efektivitas promo voucher</p>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Search */}
          <div className="relative min-w-50 flex-1 sm:max-w-xs">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode voucher..."
              className="w-full rounded-xl border border-[#E7E5E4] bg-white py-2.5 pl-9 pr-7 text-xs text-[#1F1D1B] outline-none transition focus:border-[#C84B31] placeholder:text-[#A8A29E]"
            />
            <svg className="absolute left-3 top-3 text-[#78716C]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-[#78716C] hover:text-[#1F1D1B] text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Type Filter with Select Component */}
          <div className="w-44">
            <Select
              value={filterType}
              onChange={(val) => setFilterType(val as "all" | VoucherType)}
              options={[
                { value: "all", label: "Semua Kategori" },
                { value: "coin_credit", label: "🪙 Coin Gratis" },
                { value: "topup_discount", label: "🏷️ Diskon Topup" },
              ]}
              placeholder="Pilih Kategori"
            />
          </div>

          {/* Status Filter with Select Component */}
          <div className="w-48">
            <Select
              value={filterStatus}
              onChange={(val) => setFilterStatus(val as "all" | VoucherStatus)}
              options={[
                { value: "all", label: "Semua Status" },
                { value: "active", label: "🟢 Aktif & Tersedia" },
                { value: "expired", label: "🟡 Kadaluarsa" },
                { value: "exhausted", label: "⚪ Habis / Kuota Penuh" },
                { value: "inactive", label: "🔴 Dinonaktifkan" },
              ]}
              placeholder="Pilih Status"
            />
          </div>
        </div>

        <p className="text-xs text-[#78716C] sm:text-right">
          Menampilkan <span className="font-bold text-[#1F1D1B]">{filteredVouchers.length}</span> dari {vouchers.length} voucher
        </p>
      </div>

      {/* Vouchers table */}
      <div className="overflow-x-auto rounded-2xl border border-[#E7E5E4] bg-white shadow-xl shadow-black/2">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin text-[#C84B31]" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
            </svg>
          </div>
        ) : filteredVouchers.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#78716C]">
            {vouchers.length === 0 ? "Belum ada voucher yang dibuat" : "Tidak ada voucher yang cocok dengan filter"}
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E7E5E4] bg-[#FCFBF7]">
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[#78716C]">Kode Voucher</th>
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[#78716C]">Kategori</th>
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[#78716C]">Benefit</th>
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[#78716C]">Syarat</th>
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[#78716C]">Penggunaan / Kuota</th>
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[#78716C]">Berlaku s/d</th>
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[#78716C]">Status</th>
                <th className="px-5 py-3.5 text-right font-bold uppercase tracking-wider text-[#78716C]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E5E4]">
              {filteredVouchers.map((v) => {
                const status = getVoucherStatus(v);
                return (
                  <tr key={v.id} className="transition hover:bg-[#FCFBF7]">
                    {/* Kode Voucher */}
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => handleCopyCode(v.code)}
                        title="Klik untuk menyalin kode"
                        className="group inline-flex items-center gap-1.5 font-mono text-xs font-bold text-[#1F1D1B] hover:text-[#C84B31] transition cursor-pointer"
                      >
                        <span className="tracking-wide">{v.code}</span>
                        <svg className="opacity-0 group-hover:opacity-100 transition text-[#78716C]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                    </td>

                    {/* Kategori */}
                    <td className="px-5 py-4">
                      <VoucherBadge type={v.type} />
                    </td>

                    {/* Benefit */}
                    <td className="px-5 py-4">
                      <DiscountLabel v={v} />
                    </td>

                    {/* Syarat */}
                    <td className="px-5 py-4 text-xs font-medium text-[#78716C]">
                      {v.type === "topup_discount" && v.min_purchase
                        ? <span>Min. {fmtRp(v.min_purchase)}</span>
                        : "—"}
                    </td>

                    {/* Penggunaan / Kuota */}
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => handleOpenUsage(v)}
                        className="group flex flex-col gap-1 text-left cursor-pointer"
                        title="Lihat riwayat user yang klaim"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-[#1F1D1B] group-hover:text-[#C84B31] transition">
                            {usedCount(v)} / {v.max_uses} klaim ({usagePct(v)}%)
                          </span>
                          <span className="text-[10px] text-[#78716C] group-hover:text-[#C84B31]">➔</span>
                        </div>
                        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-[#FCFBF7] border border-[#E7E5E4]">
                          <div
                            className="h-full rounded-full bg-[#C84B31] transition-all"
                            style={{ width: `${usagePct(v)}%` }}
                          />
                        </div>
                      </button>
                    </td>

                    {/* Berlaku s/d */}
                    <td className="px-5 py-4 text-xs font-medium text-[#78716C]">
                      {fmtDate(v.valid_until)}
                    </td>

                    {/* Status Badge */}
                    <td className="px-5 py-4">
                      {status === "inactive" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-[10px] font-bold uppercase text-red-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                          Nonaktif
                        </span>
                      ) : status === "exhausted" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#F5F5F4] border border-[#E7E5E4] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#78716C]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#A8A29E]" />
                          Habis
                        </span>
                      ) : status === "expired" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF3C7] border border-[#FDE68A] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#D97706]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B]" />
                          Kadaluarsa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#EBF9EB] border border-[#10B981]/20 px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#10B981]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                          Aktif
                        </span>
                      )}
                    </td>

                    {/* Aksi */}
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit voucher */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(v)}
                          title="Edit voucher"
                          className="rounded-lg p-1.5 text-[#78716C] transition hover:bg-[#FCFBF7] hover:text-[#C84B31] cursor-pointer"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>

                        {/* Riwayat usage */}
                        <button
                          type="button"
                          onClick={() => handleOpenUsage(v)}
                          title="Lihat riwayat klaim"
                          className="rounded-lg p-1.5 text-[#78716C] transition hover:bg-[#FCFBF7] hover:text-[#C84B31] cursor-pointer"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                        </button>

                        {/* Toggle On/Off Switch */}
                        <button
                          type="button"
                          onClick={() => handleToggle(v)}
                          title={v.is_active ? "Nonaktifkan voucher" : "Aktifkan voucher"}
                          aria-label={`Toggle status voucher ${v.code}`}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out cursor-pointer focus:outline-none ${
                            v.is_active ? "bg-[#10B981]" : "bg-[#D6D3D1]"
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                              v.is_active ? "translate-x-4.5" : "translate-x-1"
                            }`}
                          />
                        </button>

                        {/* Hapus */}
                        <button
                          type="button"
                          onClick={() => handleDelete(v)}
                          title="Hapus voucher"
                          className="rounded-lg p-1.5 text-[#78716C] transition hover:bg-red-50 hover:text-red-600 cursor-pointer"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ======================================================== */}
      {/* Modal Buat / Edit Voucher */}
      {/* ======================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#1F1D1B]/40 backdrop-blur-xs transition-opacity"
            onClick={() => { if (!submitting) { setShowCreateModal(false); setEditingVoucher(null); } }}
          />

          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[#E7E5E4] bg-white p-6 sm:p-7 shadow-2xl transition-all">
            {/* Header Modal */}
            <div className="flex items-start justify-between gap-4 border-b border-[#E7E5E4] pb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C84B31]">
                  {editingVoucher ? "Edit Voucher" : "Voucher Form"}
                </p>
                <h3 className="mt-0.5 font-serif text-xl font-bold text-[#1F1D1B]">
                  {editingVoucher ? `Edit Voucher ${editingVoucher.code}` : "Buat Voucher Baru"}
                </h3>
                <p className="mt-1 text-xs text-[#78716C]">
                  {editingVoucher
                    ? "Ubah benefit, kuota, atau masa berlaku voucher."
                    : "Tentukan tipe promo, kode unik, batas klaim, dan masa berlaku voucher."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setShowCreateModal(false); setEditingVoucher(null); }}
                disabled={submitting}
                className="rounded-lg p-1 text-[#78716C] hover:bg-[#FCFBF7] hover:text-[#1F1D1B] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {/* Type selector */}
              <div>
                <label className={labelCls}>Tipe Promo</label>
                <div className="grid grid-cols-2 gap-3">
                  {(["coin_credit", "topup_discount"] as VoucherType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFType(t)}
                      className={`rounded-2xl border p-3.5 text-left transition cursor-pointer ${
                        fType === t
                          ? "border-[#FBDCD5] bg-[#FDF4F2] text-[#C84B31] ring-1 ring-[#C84B31]/30"
                          : "border-[#E7E5E4] bg-white text-[#78716C] hover:bg-[#FCFBF7]"
                      }`}
                    >
                      <p className="font-bold text-xs">
                        {t === "coin_credit" ? "🪙 Coin Gratis Langsung" : "🏷️ Diskon Topup"}
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-[#78716C]">
                        {t === "coin_credit"
                          ? "User langsung dapat koin ke wallet"
                          : "Potongan harga persen / nominal paket"}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2">
                {/* Code */}
                <div>
                  <label className={labelCls}>Kode Voucher</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={fCode}
                      onChange={(e) => setFCode(e.target.value.toUpperCase())}
                      maxLength={50} required
                      pattern="[A-Z0-9\-]{3,50}"
                      title="Huruf kapital, angka, tanda hubung (3-50 karakter)"
                      className="flex-1 rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-3.5 py-2.5 font-mono text-xs font-bold text-[#1F1D1B] outline-none transition focus:border-[#C84B31] focus:bg-white"
                    />
                    {!editingVoucher && (
                      <button
                        type="button"
                        onClick={() => setFCode(generateCode())}
                        title="Generate kode acak"
                        className="rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-3 py-2.5 text-[#78716C] transition hover:bg-white hover:text-[#1F1D1B] cursor-pointer"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Kuota pemakaian */}
                <div>
                  <label className={labelCls}>Kuota Penggunaan (User Max)</label>
                  <input
                    type="number" value={fMaxUses}
                    onChange={(e) => setFMaxUses(e.target.value)}
                    min={1} max={10000} required className={inputCls}
                    placeholder="Contoh: 100"
                  />
                  {editingVoucher && (
                    <span className="mt-1 block text-[10px] text-[#78716C]">
                      Sudah terpakai: {editingVoucher.max_uses - editingVoucher.uses_remaining} kali
                    </span>
                  )}
                </div>

                {/* Dynamic fields */}
                {fType === "coin_credit" ? (
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Jumlah Coin Gratis per User</label>
                    <input
                      type="number" value={fCoinValue}
                      onChange={(e) => setFCoinValue(e.target.value)}
                      min={1} max={1000} required className={inputCls}
                      placeholder="Contoh: 10"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className={labelCls}>Tipe Diskon</label>
                      <Select
                        value={fDiscountType}
                        onChange={(val) => setFDiscountType(val as "percentage" | "fixed")}
                        options={[
                          { value: "percentage", label: "Persentase (%)" },
                          { value: "fixed", label: "Nominal Tetap (Rp)" },
                        ]}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>
                        {fDiscountType === "percentage" ? "Besar Diskon (%)" : "Nominal Diskon (Rp)"}
                      </label>
                      <input
                        type="number" value={fDiscountValue}
                        onChange={(e) => setFDiscountValue(e.target.value)}
                        min={1}
                        max={fDiscountType === "percentage" ? 100 : 9999999}
                        required className={inputCls}
                        placeholder={fDiscountType === "percentage" ? "20" : "15000"}
                      />
                    </div>

                    {fDiscountType === "percentage" && (
                      <div>
                        <label className={labelCls}>Maks Diskon (Rp, opsional)</label>
                        <input
                          type="number" value={fMaxDiscount}
                          onChange={(e) => setFMaxDiscount(e.target.value)}
                          min={0} className={inputCls}
                          placeholder="Kosongkan = tanpa batas"
                        />
                      </div>
                    )}

                    <div>
                      <label className={labelCls}>Min. Pembelian Paket (Rp, opsional)</label>
                      <input
                        type="number" value={fMinPurchase}
                        onChange={(e) => setFMinPurchase(e.target.value)}
                        min={0} className={inputCls}
                        placeholder="Kosongkan = tanpa minimum"
                      />
                    </div>
                  </>
                )}

                {/* Valid until dengan DatePicker */}
                <div className={fType === "coin_credit" ? "sm:col-span-2" : ""}>
                  <label className={labelCls}>Berlaku Hingga (Opsional)</label>
                  <DatePicker
                    value={fValidUntil}
                    onChange={setFValidUntil}
                    min={toYMD(new Date())}
                    placeholder="Pilih batas tanggal kadaluarsa..."
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#E7E5E4] pt-4">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setEditingVoucher(null); }}
                  disabled={submitting}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-[#78716C] transition hover:text-[#1F1D1B] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit" disabled={submitting}
                  className="flex items-center gap-2 rounded-xl bg-[#C84B31] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#B33E26] disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {submitting
                    ? (editingVoucher ? "Menyimpan..." : "Menerbitkan...")
                    : (editingVoucher ? "Simpan Perubahan" : "Simpan & Terbitkan")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* Modal Riwayat Penggunaan / Redemptions */}
      {/* ======================================================== */}
      {selectedVoucherForUsage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#1F1D1B]/40 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedVoucherForUsage(null)}
          />

          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-[#E7E5E4] bg-white p-6 sm:p-7 shadow-2xl transition-all">
            {/* Header Modal */}
            <div className="flex items-start justify-between gap-4 border-b border-[#E7E5E4] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-[#1F1D1B]">
                    {selectedVoucherForUsage.code}
                  </span>
                  <VoucherBadge type={selectedVoucherForUsage.type} />
                </div>
                <p className="mt-1 text-xs text-[#78716C]">
                  Riwayat klaim voucher ini oleh pengguna.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVoucherForUsage(null)}
                className="rounded-lg p-1 text-[#78716C] hover:bg-[#FCFBF7] hover:text-[#1F1D1B] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quota Progress */}
            <div className="my-4 rounded-2xl border border-[#E7E5E4] bg-[#FCFBF7] p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#1F1D1B]">Total Klaim</span>
                <span className="font-mono font-bold text-[#C84B31]">
                  {usedCount(selectedVoucherForUsage)} / {selectedVoucherForUsage.max_uses} kuota
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white border border-[#E7E5E4]">
                <div
                  className="h-full rounded-full bg-[#C84B31] transition-all"
                  style={{ width: `${usagePct(selectedVoucherForUsage)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-[#78716C]">
                <span>Sisa kuota: {selectedVoucherForUsage.uses_remaining}</span>
                <span>Berlaku s/d: {fmtDate(selectedVoucherForUsage.valid_until)}</span>
              </div>
            </div>

            {/* Redemptions List */}
            <div>
              <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-[#78716C]">
                Daftar Pengguna ({redemptions.length})
              </p>

              {loadingUsage ? (
                <div className="flex items-center justify-center py-10">
                  <svg className="animate-spin text-[#C84B31]" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                  </svg>
                </div>
              ) : redemptions.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#78716C]">
                  Belum ada pengguna yang mengklaim voucher ini.
                </div>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {redemptions.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#E7E5E4] bg-white p-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#FDF4F2] text-[10px] font-bold text-[#C84B31] ring-1 ring-[#FBDCD5]">
                          {r.users?.avatar_url ? (
                            <Image
                              src={r.users.avatar_url}
                              alt={r.users.name}
                              width={32}
                              height={32}
                              className="h-full w-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <span>{r.users?.name?.[0]?.toUpperCase() ?? "?"}</span>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#1F1D1B]">{r.users?.name ?? "User"}</p>
                          <p className="text-[10px] text-[#78716C]">{r.users?.email}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-mono text-[10px] text-[#78716C]">
                          {fmtDateTime(r.redeemed_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-6 border-t border-[#E7E5E4] pt-4 text-right">
              <button
                type="button"
                onClick={() => setSelectedVoucherForUsage(null)}
                className="rounded-full border border-[#E7E5E4] bg-white px-5 py-2 text-xs font-semibold text-[#1F1D1B] transition hover:bg-[#FCFBF7] cursor-pointer shadow-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
