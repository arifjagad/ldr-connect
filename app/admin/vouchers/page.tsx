"use client";

import { useEffect, useState } from "react";

type VoucherType = "coin_credit" | "topup_discount";

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

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "LDR-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function fmtRp(n: number) {
  return "Rp" + n.toLocaleString("id-ID");
}

function VoucherBadge({ type }: { type: VoucherType }) {
  if (type === "topup_discount") {
    return (
      <span className="rounded-full bg-[#FBBF24]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#FBBF24]">
        Diskon
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[#A78BFA]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#A78BFA]">
      Coin
    </span>
  );
}

function DiscountLabel({ v }: { v: Voucher }) {
  if (v.type === "coin_credit") {
    return <span className="text-sm font-bold text-[#A78BFA]">+{v.coin_value} coin</span>;
  }
  if (v.discount_type === "percentage") {
    return (
      <span className="text-sm font-bold text-[#FBBF24]">
        {v.discount_value}%
        {v.max_discount ? <span className="ml-1 text-xs font-normal text-[#5C5470]">maks {fmtRp(v.max_discount)}</span> : null}
      </span>
    );
  }
  return <span className="text-sm font-bold text-[#FBBF24]">{fmtRp(v.discount_value ?? 0)}</span>;
}

export default function AdminVouchersPage() {
  const [vouchers, setVouchers]   = useState<Voucher[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast]         = useState<{ ok: boolean; msg: string } | null>(null);
  const [deleteId, setDeleteId]   = useState<number | null>(null);

  // Form state
  const [fType, setFType]                 = useState<VoucherType>("coin_credit");
  const [fCode, setFCode]                 = useState(() => generateCode());
  const [fMaxUses, setFMaxUses]           = useState("1");
  const [fValidUntil, setFValidUntil]     = useState("");
  // coin_credit fields
  const [fCoinValue, setFCoinValue]       = useState("10");
  // topup_discount fields
  const [fDiscountType, setFDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [fDiscountValue, setFDiscountValue] = useState("20");
  const [fMaxDiscount, setFMaxDiscount]   = useState("20000");
  const [fMinPurchase, setFMinPurchase]   = useState("50000");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function loadVouchers() {
    setLoading(true);
    const res  = await fetch("/api/admin/vouchers");
    const json = await res.json();
    setVouchers(json.data?.vouchers ?? []);
    setLoading(false);
  }

  useEffect(() => { loadVouchers(); }, []);

  function resetForm() {
    setFCode(generateCode());
    setFMaxUses("1");
    setFValidUntil("");
    setFCoinValue("10");
    setFDiscountType("percentage");
    setFDiscountValue("20");
    setFMaxDiscount("20000");
    setFMinPurchase("50000");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      code:      fCode.trim().toUpperCase(),
      type:      fType,
      max_uses:  Number(fMaxUses),
      valid_until: fValidUntil || null,
    };

    if (fType === "coin_credit") {
      payload.coin_value = Number(fCoinValue);
    } else {
      payload.discount_type  = fDiscountType;
      payload.discount_value = Number(fDiscountValue);
      payload.max_discount   = fDiscountType === "percentage" && fMaxDiscount ? Number(fMaxDiscount) : null;
      payload.min_purchase   = fMinPurchase ? Number(fMinPurchase) : null;
    }

    const res  = await fetch("/api/admin/vouchers", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    const json = await res.json();
    setToast({ ok: json.success, msg: json.message });
    if (json.success) {
      setShowForm(false);
      resetForm();
      await loadVouchers();
    }
    setSubmitting(false);
  }

  async function handleToggle(v: Voucher) {
    const res  = await fetch(`/api/admin/vouchers/${v.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ is_active: !v.is_active }),
    });
    const json = await res.json();
    setToast({ ok: json.success, msg: json.message });
    if (json.success) await loadVouchers();
  }

  async function handleDelete(id: number) {
    const res  = await fetch(`/api/admin/vouchers/${id}`, { method: "DELETE" });
    const json = await res.json();
    setToast({ ok: json.success, msg: json.message });
    setDeleteId(null);
    if (json.success) await loadVouchers();
  }

  const usedCount = (v: Voucher) => v.max_uses - v.uses_remaining;
  const usagePct  = (v: Voucher) => Math.round((usedCount(v) / v.max_uses) * 100);

  const inputCls = "w-full rounded-xl border border-white/10 bg-[#18181C] px-3 py-2 text-sm text-[#FFF5F8] outline-none focus:border-[#A78BFA]/50";
  const labelCls = "mb-1.5 block text-xs text-[#5C5470]";

  return (
    <div className="px-8 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#FFF5F8]">Voucher</h1>
          <p className="mt-1 text-sm text-[#5C5470]">{vouchers.length} voucher terdaftar</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm((v) => !v); }}
          className="flex items-center gap-2 rounded-xl bg-[#A78BFA] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(167,139,250,0.3)] transition hover:bg-[#C4B5FD]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          Buat Voucher
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-[#A78BFA]/30 bg-[#111113]">
          <div className="h-1 bg-[#A78BFA]" />
          <form onSubmit={handleCreate} className="p-6">
            <p className="mb-5 text-sm font-semibold text-[#FFF5F8]">Buat Voucher Baru</p>

            {/* Type selector */}
            <div className="mb-5 grid grid-cols-2 gap-2">
              {(["coin_credit", "topup_discount"] as VoucherType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFType(t)}
                  className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                    fType === t
                      ? "border-[#A78BFA]/50 bg-[#A78BFA]/10 text-[#FFF5F8]"
                      : "border-white/10 bg-[#18181C] text-[#5C5470] hover:border-white/20"
                  }`}
                >
                  <p className="font-semibold">
                    {t === "coin_credit" ? "Coin Gratis" : "Diskon Topup"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#5C5470]">
                    {t === "coin_credit"
                      ? "User langsung dapat coin"
                      : "Potongan harga saat beli paket"}
                  </p>
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
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
                    className="flex-1 rounded-xl border border-white/10 bg-[#18181C] px-3 py-2 font-mono text-sm text-[#FFF5F8] outline-none focus:border-[#A78BFA]/50"
                  />
                  <button
                    type="button"
                    onClick={() => setFCode(generateCode())}
                    title="Generate kode acak"
                    className="rounded-xl border border-white/10 bg-[#18181C] px-3 py-2 text-[#5C5470] transition hover:border-white/20 hover:text-[#9B93B0]"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Maks penggunaan */}
              <div>
                <label className={labelCls}>Maks Penggunaan</label>
                <input
                  type="number" value={fMaxUses}
                  onChange={(e) => setFMaxUses(e.target.value)}
                  min={1} max={10000} required className={inputCls}
                />
              </div>

              {/* === Fields berbeda berdasarkan type === */}
              {fType === "coin_credit" ? (
                <div>
                  <label className={labelCls}>Nilai Coin</label>
                  <input
                    type="number" value={fCoinValue}
                    onChange={(e) => setFCoinValue(e.target.value)}
                    min={1} max={1000} required className={inputCls}
                  />
                </div>
              ) : (
                <>
                  {/* Tipe diskon */}
                  <div>
                    <label className={labelCls}>Tipe Diskon</label>
                    <select
                      value={fDiscountType}
                      onChange={(e) => setFDiscountType(e.target.value as "percentage" | "fixed")}
                      className={inputCls + " scheme-dark"}
                    >
                      <option value="percentage">Persentase (%)</option>
                      <option value="fixed">Nominal (Rp)</option>
                    </select>
                  </div>

                  {/* Nilai diskon */}
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
                    />
                  </div>

                  {/* Maks diskon (hanya untuk persentase) */}
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

                  {/* Minimum pembelian */}
                  <div>
                    <label className={labelCls}>Minimum Pembelian (Rp, opsional)</label>
                    <input
                      type="number" value={fMinPurchase}
                      onChange={(e) => setFMinPurchase(e.target.value)}
                      min={0} className={inputCls}
                      placeholder="Kosongkan = tanpa minimum"
                    />
                  </div>
                </>
              )}

              {/* Valid until */}
              <div>
                <label className={labelCls}>Berlaku Hingga (opsional)</label>
                <input
                  type="datetime-local" value={fValidUntil}
                  onChange={(e) => setFValidUntil(e.target.value)}
                  className={inputCls + " scheme-dark"}
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl px-4 py-2 text-sm text-[#5C5470] transition hover:text-[#9B93B0]"
              >
                Batal
              </button>
              <button
                type="submit" disabled={submitting}
                className="flex items-center gap-2 rounded-xl bg-[#A78BFA] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#C4B5FD] disabled:opacity-50"
              >
                {submitting ? "Membuat..." : "Buat Voucher"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Vouchers table */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113]">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin text-[#A78BFA]" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
            </svg>
          </div>
        ) : vouchers.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#5C5470]">Belum ada voucher</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/6">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#5C5470]">Kode</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#5C5470]">Nilai</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#5C5470]">Syarat</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#5C5470]">Penggunaan</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#5C5470]">Berlaku s/d</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#5C5470]">Status</th>
                <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-widest text-[#5C5470]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              {vouchers.map((v) => (
                <tr key={v.id} className="group transition hover:bg-white/1.5">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-[#FFF5F8]">{v.code}</span>
                      <VoucherBadge type={v.type} />
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <DiscountLabel v={v} />
                  </td>
                  <td className="px-5 py-4 text-xs text-[#5C5470]">
                    {v.type === "topup_discount" && v.min_purchase
                      ? <span>Min. {fmtRp(v.min_purchase)}</span>
                      : "—"}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-[#9B93B0]">
                        {usedCount(v)} / {v.max_uses} terpakai
                      </span>
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-[#A78BFA] transition-all"
                          style={{ width: `${usagePct(v)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs text-[#5C5470]">
                    {fmtDate(v.valid_until)}
                  </td>
                  <td className="px-5 py-4">
                    {v.uses_remaining === 0 ? (
                      <span className="rounded-full bg-[#5C5470]/20 px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#5C5470]">Habis</span>
                    ) : v.is_active ? (
                      <span className="rounded-full bg-[#34D399]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#34D399]">Aktif</span>
                    ) : (
                      <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-red-400">Nonaktif</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggle(v)}
                        title={v.is_active ? "Nonaktifkan" : "Aktifkan"}
                        className="rounded-lg p-1.5 text-[#5C5470] transition hover:bg-white/10 hover:text-[#9B93B0]"
                      >
                        {v.is_active ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="1" y="5" width="22" height="14" rx="7" /><circle cx="16" cy="12" r="3" fill="currentColor" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="1" y="5" width="22" height="14" rx="7" /><circle cx="8" cy="12" r="3" fill="currentColor" />
                          </svg>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(v.id)}
                        title="Hapus voucher"
                        className="rounded-lg p-1.5 text-[#5C5470] transition hover:bg-red-500/10 hover:text-red-400"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-80 overflow-hidden rounded-2xl border border-white/10 bg-[#111113] shadow-2xl">
            <div className="h-1 bg-red-500" />
            <div className="p-6">
              <p className="text-sm font-semibold text-[#FFF5F8]">Hapus Voucher?</p>
              <p className="mt-1.5 text-xs text-[#5C5470]">
                Tindakan ini tidak dapat dibatalkan. Semua data redemption terkait juga akan terhapus.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteId(null)}
                  className="flex-1 rounded-xl border border-white/10 py-2 text-sm text-[#9B93B0] transition hover:bg-white/5"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(deleteId)}
                  className="flex-1 rounded-xl bg-red-500/15 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/25"
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed right-6 top-6 z-50 flex max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-sm ${
          toast.ok
            ? "border-[#A78BFA]/25 bg-[#0D0A1A]/95 text-[#A78BFA]"
            : "border-red-500/25 bg-[#1A0A10]/95 text-red-300"
        }`}>
          {toast.ok ? (
            <svg className="mt-0.5 shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg className="mt-0.5 shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          <p className="text-sm leading-snug">{toast.msg}</p>
          <button type="button" onClick={() => setToast(null)} className="ml-1 shrink-0 opacity-50 hover:opacity-100">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
