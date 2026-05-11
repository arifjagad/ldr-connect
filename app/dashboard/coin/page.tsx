"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CoinPackage, CoinTransaction, WalletData } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type TopupResponse = {
  message: string;
  payment_url: string | null;
  snap_token?: string | null;
  transaction: CoinTransaction;
};

type VoucherInfo =
  | { type: "coin_credit"; code: string; coinValue: number }
  | {
      type: "topup_discount";
      code: string;
      discountType: "percentage" | "fixed";
      discountValue: number;
      maxDiscount: number | null;
      minPurchase: number | null;
    };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcDiscount(price: number, v: VoucherInfo & { type: "topup_discount" }): number {
  let d =
    v.discountType === "percentage"
      ? Math.floor((price * v.discountValue) / 100)
      : Math.min(v.discountValue, price);
  if (v.maxDiscount) d = Math.min(d, v.maxDiscount);
  return d;
}

function fmtRp(n: number) {
  return "Rp" + n.toLocaleString("id-ID");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CoinTransaction["payment_status"] }) {
  const map = {
    paid:    "border-[#34D399]/25 bg-[#34D399]/10 text-[#34D399]",
    pending: "border-yellow-500/25 bg-yellow-500/10 text-yellow-400",
    failed:  "border-red-500/25 bg-red-500/10 text-red-400",
  };
  const label = { paid: "Paid", pending: "Pending", failed: "Failed" };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${map[status]}`}>
      {label[status]}
    </span>
  );
}

function TypeBadge({ type, metadata }: { type: CoinTransaction["type"]; metadata: CoinTransaction["metadata"] }) {
  const reason = metadata?.reason as string | undefined;
  const isRefund = reason === "session_expired_refund";
  const isGame   = reason === "game_session_created" || reason === "game_session_joined";
  const isVoucher = reason === "voucher_redemption";

  const iconUp = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const iconDown = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const iconGift = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M20 12V22H4V12" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 7H2v5h20V7z" strokeLinecap="round" />
      <path d="M12 22V7" strokeLinecap="round" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" strokeLinecap="round" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" strokeLinecap="round" />
    </svg>
  );

  if (isVoucher)
    return <span className="flex items-center gap-1 text-xs font-medium text-[#A78BFA]">{iconGift} Voucher</span>;
  if (isRefund)
    return <span className="flex items-center gap-1 text-xs font-medium text-[#60A5FA]">{iconUp} Refund</span>;
  if (type === "topup" && metadata?.voucher_code)
    return <span className="flex items-center gap-1 text-xs font-medium text-[#34D399]">{iconUp} Top Up <span className="text-[#A78BFA]">-{fmtRp((metadata.discount_amount as number) ?? 0)}</span></span>;
  if (type === "topup")
    return <span className="flex items-center gap-1 text-xs font-medium text-[#34D399]">{iconUp} Top Up</span>;
  if (isGame)
    return <span className="flex items-center gap-1 text-xs font-medium text-[#FF6B9D]">{iconDown} Main Game</span>;
  return <span className="flex items-center gap-1 text-xs font-medium text-[#FF6B9D]">{iconDown} Dipotong</span>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CoinPage() {
  const [wallet, setWallet]           = useState<WalletData | null>(null);
  const [packages, setPackages]       = useState<CoinPackage[]>([]);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [status, setStatus]           = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const verifyingRef                  = useRef(false);

  // Unified voucher state
  const [voucherInput, setVoucherInput]         = useState("");
  const [voucherChecking, setVoucherChecking]   = useState(false);
  const [voucherInfo, setVoucherInfo]           = useState<VoucherInfo | null>(null);
  const [voucherCheckError, setVoucherCheckError] = useState<string | null>(null);
  const [voucherRedeeming, setVoucherRedeeming] = useState(false);
  const [voucherRedeemMsg, setVoucherRedeemMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!status && !error) return;
    const t = setTimeout(() => { setStatus(null); setError(null); }, 4000);
    return () => clearTimeout(t);
  }, [status, error]);

  // Auto-dismiss redeem message
  useEffect(() => {
    if (!voucherRedeemMsg) return;
    const t = setTimeout(() => setVoucherRedeemMsg(null), 5000);
    return () => clearTimeout(t);
  }, [voucherRedeemMsg]);

  // Focus → auto-refresh + verify pending
  useEffect(() => {
    const onFocus = async () => {
      const [walletRes, txRes] = await Promise.all([
        fetch("/api/coin/balance"), fetch("/api/coin/transactions"),
      ]);
      const [walletJson, txJson] = await Promise.all([walletRes.json(), txRes.json()]);
      setWallet(walletJson.data?.wallet ?? null);
      const txs: CoinTransaction[] = txJson.data?.transactions ?? [];
      setTransactions(txs);

      const pendings = txs.filter((t) => t.payment_status === "pending" && t.type === "topup");
      let needRefresh = false;
      for (const p of pendings) {
        if (p.payment_reference) {
          const vRes = await fetch("/api/coin/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payment_reference: p.payment_reference }),
          });
          if (vRes.ok) needRefresh = true;
        }
      }
      if (needRefresh) {
        const [wRes2, tRes2] = await Promise.all([fetch("/api/coin/balance"), fetch("/api/coin/transactions")]);
        const [wJson2, tJson2] = await Promise.all([wRes2.json(), tRes2.json()]);
        setWallet(wJson2.data?.wallet ?? null);
        setTransactions(tJson2.data?.transactions ?? []);
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const selectedPkg = useMemo(
    () => packages.find((p) => p.id === selectedPackage) ?? null,
    [packages, selectedPackage]
  );

  // Discount computed client-side (menggunakan voucherInfo + selectedPkg)
  const discount = useMemo<number | null>(() => {
    if (!voucherInfo || voucherInfo.type !== "topup_discount" || !selectedPkg) return null;
    if (voucherInfo.minPurchase && selectedPkg.price < voucherInfo.minPurchase) return null;
    return calcDiscount(selectedPkg.price, voucherInfo);
  }, [voucherInfo, selectedPkg]);

  const meetsMinimum = useMemo(() => {
    if (!voucherInfo || voucherInfo.type !== "topup_discount" || !selectedPkg) return true;
    if (!voucherInfo.minPurchase) return true;
    return selectedPkg.price >= voucherInfo.minPurchase;
  }, [voucherInfo, selectedPkg]);

  useEffect(() => {
    async function load() {
      try {
        const [walletRes, packagesRes, transactionsRes] = await Promise.all([
          fetch("/api/coin/balance"),
          fetch("/api/coin/packages"),
          fetch("/api/coin/transactions"),
        ]);
        const [walletJson, packagesJson, txJson] = await Promise.all([
          walletRes.json(), packagesRes.json(), transactionsRes.json(),
        ]);
        setWallet(walletJson.data?.wallet ?? null);
        setPackages(packagesJson.data?.packages ?? []);
        setTransactions(txJson.data?.transactions ?? []);
        if ((packagesJson.data?.packages ?? []).length > 0) {
          setSelectedPackage(packagesJson.data.packages[0].id);
        }
      } catch {
        setError("Gagal memuat data coin");
      }
    }
    load();
  }, []);

  const refreshWalletAndTransactions = useCallback(async () => {
    const [walletRes, txRes] = await Promise.all([fetch("/api/coin/balance"), fetch("/api/coin/transactions")]);
    const [walletJson, txJson] = await Promise.all([walletRes.json(), txRes.json()]);
    setWallet(walletJson.data?.wallet ?? null);
    setTransactions(txJson.data?.transactions ?? []);
  }, []);

  // ── Voucher: check ──────────────────────────────────────────────────────────
  async function handleCheckVoucher(e: FormEvent) {
    e.preventDefault();
    const code = voucherInput.trim().toUpperCase();
    if (!code) return;
    setVoucherChecking(true);
    setVoucherInfo(null);
    setVoucherCheckError(null);
    setVoucherRedeemMsg(null);

    const res = await fetch(`/api/coin/check-voucher?code=${encodeURIComponent(code)}`);
    const json = await res.json();

    if (!json.success) {
      setVoucherCheckError(json.message);
    } else {
      const d = json.data;
      if (d.type === "coin_credit") {
        setVoucherInfo({ type: "coin_credit", code: d.code, coinValue: d.coin_value });
      } else {
        setVoucherInfo({
          type:          "topup_discount",
          code:          d.code,
          discountType:  d.discount_type,
          discountValue: d.discount_value,
          maxDiscount:   d.max_discount,
          minPurchase:   d.min_purchase,
        });
      }
    }
    setVoucherChecking(false);
  }

  function clearVoucher() {
    setVoucherInput("");
    setVoucherInfo(null);
    setVoucherCheckError(null);
    setVoucherRedeemMsg(null);
  }

  // ── Voucher: redeem coin credit ─────────────────────────────────────────────
  async function handleRedeemCoinVoucher() {
    if (!voucherInfo || voucherInfo.type !== "coin_credit") return;
    setVoucherRedeeming(true);
    const res = await fetch("/api/coin/redeem-voucher", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ code: voucherInfo.code }),
    });
    const json = await res.json();
    setVoucherRedeemMsg({ ok: json.success, msg: json.message });
    if (json.success) {
      clearVoucher();
      await refreshWalletAndTransactions();
    }
    setVoucherRedeeming(false);
  }

  // ── Topup ───────────────────────────────────────────────────────────────────
  async function handleTopup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPackage) return;
    setLoading(true); setError(null); setStatus(null);

    const useVoucher =
      voucherInfo?.type === "topup_discount" && meetsMinimum
        ? voucherInfo.code
        : undefined;

    const res = await fetch("/api/coin/topup", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        coin_package_id: selectedPackage,
        ...(useVoucher ? { voucher_code: useVoucher } : {}),
      }),
    });
    const json: { success: boolean; message: string; data: TopupResponse } = await res.json();

    if (!res.ok) {
      setError(json.message);
    } else {
      setStatus(json.message);
      if (useVoucher) clearVoucher();
      await refreshWalletAndTransactions();
      if (json.data.payment_url) window.open(json.data.payment_url, "_blank");
    }
    setLoading(false);
  }

  function handlePayPending(tx: CoinTransaction) {
    const meta = tx.metadata as Record<string, unknown> | null;
    const paymentUrl = meta?.payment_url as string | undefined;
    if (paymentUrl) window.open(paymentUrl, "_blank");
    else setError("Link pembayaran tidak ditemukan, silakan buat topup baru.");
  }

  // ── Discount label helper ────────────────────────────────────────────────────
  function discountLabel(v: VoucherInfo & { type: "topup_discount" }) {
    if (v.discountType === "percentage") {
      let s = `Diskon ${v.discountValue}%`;
      if (v.maxDiscount) s += ` (maks ${fmtRp(v.maxDiscount)})`;
      return s;
    }
    return `Diskon ${fmtRp(v.discountValue)}`;
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="relative mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full blur-[120px]"
        style={{ background: "radial-gradient(ellipse, rgba(52,211,153,0.09) 0%, transparent 70%)" }}
      />

      {/* Header */}
      <div className="mb-10">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#5C5470]">Dashboard / Coin</p>
        <h1 className="mt-2 text-2xl sm:text-4xl font-bold tracking-tight text-[#FFF5F8]">
          Coin{" "}
          <span style={{ backgroundImage: "linear-gradient(90deg, #34D399, #6EE7B7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Wallet
          </span>
        </h1>
        <p className="mt-2 text-sm text-[#5C5470]">Topup coin dan kelola riwayat transaksi kamu.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ── Left column ── */}
        <div className="space-y-4 lg:col-span-3">

          {/* Balance card */}
          <div className="relative overflow-hidden rounded-2xl border border-[#34D399]/20 bg-linear-to-br from-[#34D399]/10 to-transparent p-6">
            <div aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full blur-2xl" style={{ background: "rgba(52,211,153,0.15)" }} />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-[#5C5470]">Saldo Coin</p>
                <p className="mt-2 text-5xl font-bold tabular-nums text-[#FFF5F8]">{wallet?.balance ?? 0}</p>
                <p className="mt-1 text-sm text-[#5C5470]">coins tersedia</p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#34D399]/15">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v2M12 16v2M9 9h4a1.5 1.5 0 0 1 0 3H9M9 12h5a1.5 1.5 0 0 1 0 3H9" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* ── Voucher card (UNIFIED) ── */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
            <div className="mb-1 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="1.8">
                <path d="M20 12V22H4V12" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M22 7H2v5h20V7z" strokeLinecap="round" />
                <path d="M12 22V7" strokeLinecap="round" />
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" strokeLinecap="round" />
                <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" strokeLinecap="round" />
              </svg>
              <p className="text-xs font-medium uppercase tracking-widest text-[#5C5470]">Punya Kode Voucher?</p>
            </div>
            <p className="mt-0.5 text-sm text-[#5C5470]">Coin gratis atau diskon topup — masukkan kode dan cek dulu.</p>

            {/* Input row */}
            {!voucherInfo ? (
              <form onSubmit={handleCheckVoucher} className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={voucherInput}
                  onChange={(e) => {
                    setVoucherInput(e.target.value.toUpperCase());
                    setVoucherCheckError(null);
                  }}
                  placeholder="Contoh: WELCOME10 atau SALE-20"
                  maxLength={50}
                  className="flex-1 rounded-xl border border-white/10 bg-[#18181C] px-4 py-2.5 font-mono text-sm text-[#FFF5F8] placeholder-[#5C5470] outline-none transition focus:border-[#A78BFA]/50 focus:ring-1 focus:ring-[#A78BFA]/20"
                />
                <button
                  type="submit"
                  disabled={voucherChecking || !voucherInput.trim()}
                  className="flex items-center gap-1.5 rounded-xl bg-[#A78BFA] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#C4B5FD] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {voucherChecking ? (
                    <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                    </svg>
                  ) : null}
                  {voucherChecking ? "Cek..." : "Cek"}
                </button>
              </form>
            ) : (
              /* Clear button when voucher is loaded */
              <div className="mt-4 flex items-center gap-2">
                <span className="flex-1 rounded-xl border border-[#A78BFA]/30 bg-[#A78BFA]/5 px-4 py-2.5 font-mono text-sm text-[#A78BFA]">
                  {voucherInfo.code}
                </span>
                <button
                  type="button"
                  onClick={clearVoucher}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-[#5C5470] transition hover:border-white/20 hover:text-[#9B93B0]"
                >
                  Ganti
                </button>
              </div>
            )}

            {/* Check error */}
            {voucherCheckError && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {voucherCheckError}
              </p>
            )}

            {/* ── Coin credit result ── */}
            {voucherInfo?.type === "coin_credit" && (
              <div className="mt-4 rounded-xl border border-[#A78BFA]/20 bg-[#A78BFA]/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#FFF5F8]">
                      +{voucherInfo.coinValue} coin gratis
                    </p>
                    <p className="mt-0.5 text-xs text-[#5C5470]">
                      Coin langsung masuk ke dompetmu setelah redeem
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRedeemCoinVoucher}
                    disabled={voucherRedeeming}
                    className="shrink-0 rounded-xl bg-[#A78BFA] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#C4B5FD] disabled:opacity-50"
                  >
                    {voucherRedeeming ? "Proses..." : "Redeem"}
                  </button>
                </div>
                {voucherRedeemMsg && (
                  <p className={`mt-3 flex items-center gap-1.5 text-xs ${voucherRedeemMsg.ok ? "text-[#34D399]" : "text-red-400"}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      {voucherRedeemMsg.ok
                        ? <polyline points="20 6 9 17 4 12" />
                        : <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>
                      }
                    </svg>
                    {voucherRedeemMsg.msg}
                  </p>
                )}
              </div>
            )}

            {/* ── Topup discount result ── */}
            {voucherInfo?.type === "topup_discount" && (
              <div className="mt-4 rounded-xl border border-[#FBBF24]/20 bg-[#FBBF24]/5 p-4">
                <p className="text-sm font-semibold text-[#FFF5F8]">{discountLabel(voucherInfo)}</p>
                {voucherInfo.minPurchase && (
                  <p className="mt-0.5 text-xs text-[#5C5470]">Min. pembelian {fmtRp(voucherInfo.minPurchase)}</p>
                )}

                {/* Status per package selected */}
                {!selectedPkg ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-[#5C5470]">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
                    </svg>
                    Pilih paket di bawah untuk melihat hematnya
                  </p>
                ) : !meetsMinimum ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-yellow-400">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Pilih paket min. {fmtRp(voucherInfo.minPurchase!)} untuk pakai voucher ini
                  </p>
                ) : discount !== null ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-[#FBBF24]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Hemat {fmtRp(discount)} dari {selectedPkg.name} → otomatis diterapkan saat Topup
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {/* ── Topup section ── */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
            <p className="text-xs font-medium uppercase tracking-widest text-[#5C5470]">Top Up Coin</p>
            <p className="mt-1 text-sm text-[#5C5470]">Pilih paket yang sesuai, lalu lanjutkan ke pembayaran.</p>

            {/* Package grid */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              {packages.map((pkg) => (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => setSelectedPackage(pkg.id)}
                  className={`relative rounded-xl border p-4 text-left transition-all ${
                    selectedPackage === pkg.id
                      ? "border-[#34D399]/50 bg-[#34D399]/10 ring-1 ring-[#34D399]/30"
                      : "border-white/[0.07] bg-[#18181C] hover:border-white/20"
                  }`}
                >
                  {selectedPackage === pkg.id && (
                    <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-[#34D399]">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                  <p className="text-lg font-bold text-[#FFF5F8]">
                    {pkg.coin_amount}
                    <span className="ml-1 text-sm font-normal text-[#5C5470]">coin</span>
                  </p>
                  <p className="mt-1 text-xs font-medium text-[#34D399]">{fmtRp(pkg.price)}</p>
                  <p className="mt-0.5 text-[10px] text-[#5C5470]">{pkg.name}</p>
                </button>
              ))}
              {packages.length === 0 && (
                <div className="col-span-2 rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-[#5C5470]">
                  Belum ada paket tersedia
                </div>
              )}
            </div>

            {/* Summary + CTA */}
            {selectedPkg && (
              <form onSubmit={handleTopup} className="mt-5">
                <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-[#18181C] px-4 py-3">
                  <div>
                    <p className="text-xs text-[#5C5470]">Total pembayaran</p>
                    {discount !== null ? (
                      <>
                        <p className="text-base font-bold text-[#FFF5F8]">
                          {fmtRp(selectedPkg.price - discount)}
                          <span className="ml-2 text-xs font-normal text-[#34D399]">→ {selectedPkg.coin_amount} coin</span>
                        </p>
                        <p className="text-[10px] text-[#5C5470] line-through">{fmtRp(selectedPkg.price)}</p>
                      </>
                    ) : (
                      <p className="text-base font-bold text-[#FFF5F8]">
                        {fmtRp(selectedPkg.price)}
                        <span className="ml-2 text-xs font-normal text-[#34D399]">→ {selectedPkg.coin_amount} coin</span>
                      </p>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 rounded-xl bg-[#34D399] px-5 py-2.5 text-sm font-semibold text-[#0A0A0B] shadow-[0_4px_16px_rgba(52,211,153,0.3)] transition hover:bg-[#6EE7B7] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {loading ? "Memproses..." : "Topup"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* ── Right column: transaction history ── */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
            <p className="text-xs font-medium uppercase tracking-widest text-[#5C5470]">Riwayat Transaksi</p>
            <div className="mt-5 max-h-161 space-y-3 overflow-y-auto pr-1 [scrollbar-color:#2D2A3E_transparent] [scrollbar-width:thin]">
              {transactions.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/10 py-10 text-center">
                  <svg className="mx-auto mb-3 text-[#5C5470]" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                  </svg>
                  <p className="text-sm text-[#5C5470]">Belum ada transaksi</p>
                </div>
              )}
              {transactions.map((tx) => {
                const reason      = tx.metadata?.reason as string | undefined;
                const gameType    = tx.metadata?.game_type as string | undefined;
                const sessionCode = tx.metadata?.session_code as string | undefined;
                const isRefund    = reason === "session_expired_refund";
                const isGame      = reason === "game_session_created" || reason === "game_session_joined";
                const gameLabel   = gameType === "tod" ? "Truth or Dare" : gameType === "snake_ladder" ? "Ular Tangga" : null;
                const amountColor = isRefund ? "text-[#60A5FA]" : tx.type === "topup" ? "text-[#34D399]" : "text-[#FF6B9D]";
                return (
                  <div key={tx.id} className="rounded-xl border border-white/[0.07] bg-[#18181C] p-4">
                    <div className="flex items-start justify-between gap-2">
                      <TypeBadge type={tx.type} metadata={tx.metadata} />
                      <StatusBadge status={tx.payment_status} />
                    </div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className={`text-xl font-bold ${amountColor}`}>
                        {tx.type === "topup" ? "+" : "-"}{tx.amount}
                      </span>
                      <span className="text-xs text-[#5C5470]">coin</span>
                    </div>
                    {gameLabel && (
                      <p className="mt-1 text-[10px] text-[#5C5470]">🎮 {gameLabel}{sessionCode ? ` · ${sessionCode}` : ""}</p>
                    )}
                    {!isGame && !isRefund && tx.payment_reference && (
                      <p className="mt-1.5 font-mono text-[10px] text-[#5C5470] break-all">{tx.payment_reference}</p>
                    )}
                    {tx.paid_at && (
                      <p className="mt-1 text-[10px] text-[#5C5470]">
                        {new Date(tx.paid_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                    {tx.payment_status === "pending" && tx.type === "topup" && (
                      <button
                        onClick={() => handlePayPending(tx)}
                        className="mt-3 w-full rounded-lg bg-[#34D399]/10 py-2 text-xs font-semibold text-[#34D399] transition hover:bg-[#34D399]/20"
                      >
                        Lanjutkan Pembayaran
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {(status || error) && (
        <div className={`fixed right-6 top-6 z-50 flex max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-sm transition-all ${
          error
            ? "border-red-500/25 bg-[#1A0A10]/95 text-red-300"
            : "border-[#34D399]/25 bg-[#0A1A12]/95 text-[#34D399]"
        }`}>
          {error ? (
            <svg className="mt-0.5 shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          ) : (
            <svg className="mt-0.5 shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          <p className="text-sm leading-snug">{error ?? status}</p>
          <button
            type="button"
            onClick={() => { setError(null); setStatus(null); }}
            className="ml-1 shrink-0 opacity-50 transition hover:opacity-100"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}
    </main>
  );
}
