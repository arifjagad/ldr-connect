"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/components/ui/Toast";
import { dialog } from "@/components/ui/Dialog";
import { emitCoinBalanceUpdated } from "@/lib/hooks/use-server-balance";
import { useAuthStore } from "@/stores/auth-store";
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
    paid:    "border-[#10B981]/20 bg-[#EBF9EB] text-[#10B981]",
    pending: "border-[#D97706]/20 bg-[#FEF3C7] text-[#D97706]",
    failed:  "border-red-200 bg-red-50 text-red-600",
  };
  const label = { paid: "Berhasil", pending: "Menunggu", failed: "Gagal" };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${map[status]}`}>
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
    return <span className="flex items-center gap-1 text-xs font-semibold text-[#D97706]">{iconGift} Voucher</span>;
  if (isRefund)
    return <span className="flex items-center gap-1 text-xs font-semibold text-[#2563EB]">{iconUp} Refund</span>;
  if (type === "topup" && metadata?.voucher_code)
    return <span className="flex items-center gap-1 text-xs font-semibold text-[#10B981]">{iconUp} Top Up <span className="text-[#D97706]">-{fmtRp((metadata.discount_amount as number) ?? 0)}</span></span>;
  if (type === "topup")
    return <span className="flex items-center gap-1 text-xs font-semibold text-[#10B981]">{iconUp} Top Up</span>;
  if (isGame)
    return <span className="flex items-center gap-1 text-xs font-semibold text-[#C84B31]">{iconDown} Main Game</span>;
  return <span className="flex items-center gap-1 text-xs font-semibold text-[#C84B31]">{iconDown} Dipotong</span>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CoinPage() {
  const [wallet, setWallet]           = useState<WalletData | null>(null);
  const [packages, setPackages]       = useState<CoinPackage[]>([]);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [loading, setLoading]         = useState(false);
  const [cancellingTxId, setCancellingTxId] = useState<number | null>(null);
  const verifyingRef                  = useRef(false);

  // Unified voucher state
  const [voucherInput, setVoucherInput]         = useState("");
  const [voucherChecking, setVoucherChecking]   = useState(false);
  const [voucherInfo, setVoucherInfo]           = useState<VoucherInfo | null>(null);
  const [voucherCheckError, setVoucherCheckError] = useState<string | null>(null);
  const [voucherRedeeming, setVoucherRedeeming] = useState(false);

  const setWalletBalance = useAuthStore((s) => s.setWalletBalance);

  const refreshWalletAndTransactions = useCallback(async () => {
    const [walletRes, txRes] = await Promise.all([fetch("/api/coin/balance"), fetch("/api/coin/transactions")]);
    const [walletJson, txJson] = await Promise.all([walletRes.json(), txRes.json()]);
    const newBal = walletJson.data?.wallet?.balance;
    if (typeof newBal === "number") {
      setWalletBalance(newBal);
      emitCoinBalanceUpdated(newBal);
    }
    setWallet(walletJson.data?.wallet ?? null);
    setTransactions(txJson.data?.transactions ?? []);
  }, [setWalletBalance]);

  // Focus → auto-refresh + verify pending
  // Guard: verifyingRef mencegah concurrent calls; lastFocusRef debounce 30s
  const lastFocusRef = useRef(0);
  useEffect(() => {
    const onFocus = async () => {
      // Debounce: jika refresh terakhir < 30 detik lalu, skip
      if (Date.now() - lastFocusRef.current < 30_000) return;
      // Concurrency guard: jika sedang proses, skip
      if (verifyingRef.current) return;
      verifyingRef.current = true;
      lastFocusRef.current = Date.now();

      try {
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
          await refreshWalletAndTransactions();
        }
      } finally {
        verifyingRef.current = false;
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshWalletAndTransactions]);

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
        const initialBal = walletJson.data?.wallet?.balance;
        if (typeof initialBal === "number") {
          setWalletBalance(initialBal);
          emitCoinBalanceUpdated(initialBal);
        }
        setWallet(walletJson.data?.wallet ?? null);
        setPackages(packagesJson.data?.packages ?? []);
        setTransactions(txJson.data?.transactions ?? []);
        if ((packagesJson.data?.packages ?? []).length > 0) {
          setSelectedPackage(packagesJson.data.packages[0].id);
        }
      } catch {
        toast.error("Gagal Memuat", "Gagal memuat data coin dan transaksi.");
      }
    }
    load();
  }, []);

  // ── Voucher: check ──────────────────────────────────────────────────────────
  async function handleCheckVoucher(e: FormEvent) {
    e.preventDefault();
    const code = voucherInput.trim().toUpperCase();
    if (!code) return;
    setVoucherChecking(true);
    setVoucherInfo(null);
    setVoucherCheckError(null);

    const res = await fetch(`/api/coin/check-voucher?code=${encodeURIComponent(code)}`);
    const json = await res.json();

    if (!json.success) {
      setVoucherCheckError(json.message);
      toast.error("Voucher Tidak Valid", json.message || "Kode voucher tidak ditemukan atau sudah kedaluwarsa.");
    } else {
      const d = json.data;
      if (d.type === "coin_credit") {
        setVoucherInfo({ type: "coin_credit", code: d.code, coinValue: d.coin_value });
        toast.success("Voucher Ditemukan!", `Voucher koin gratis +${d.coin_value} coin siap diklaim.`);
      } else {
        setVoucherInfo({
          type:          "topup_discount",
          code:          d.code,
          discountType:  d.discount_type,
          discountValue: d.discount_value,
          maxDiscount:   d.max_discount,
          minPurchase:   d.min_purchase,
        });
        toast.success("Voucher Diskon Diterapkan!", `Diskon voucher siap digunakan untuk paket topup.`);
      }
    }
    setVoucherChecking(false);
  }

  function clearVoucher() {
    setVoucherInput("");
    setVoucherInfo(null);
    setVoucherCheckError(null);
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
    if (json.success) {
      toast.success("Voucher Berhasil Diklaim! 🎉", `+${voucherInfo.coinValue} coin telah ditambahkan ke dompetmu.`);
      clearVoucher();
      await refreshWalletAndTransactions();
    } else {
      toast.error("Gagal Mengklaim", json.message || "Gagal mengklaim voucher.");
    }
    setVoucherRedeeming(false);
  }

  // ── Topup ───────────────────────────────────────────────────────────────────
  async function handleTopup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPackage) return;
    setLoading(true);

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

    if (!res.ok || !json.success) {
      toast.error("Gagal Top Up", json.message || "Terjadi kesalahan saat memproses top up.");
    } else {
      toast.success("Transaksi Dibuat!", json.message || "Silakan selesaikan pembayaran di jendela baru.");
      if (useVoucher) clearVoucher();
      await refreshWalletAndTransactions();
      if (json.data?.payment_url) window.open(json.data.payment_url, "_blank");
    }
    setLoading(false);
  }

  function handlePayPending(tx: CoinTransaction) {
    const meta = tx.metadata as Record<string, unknown> | null;
    const paymentUrl = meta?.payment_url as string | undefined;
    if (paymentUrl) {
      window.open(paymentUrl, "_blank");
    } else {
      toast.error("Link Tidak Ditemukan", "Link pembayaran tidak ditemukan, silakan buat transaksi baru.");
    }
  }

  // ── Cancel pending topup ───────────────────────────────────────────────────
  async function handleCancelPending(tx: CoinTransaction) {
    const confirmed = await dialog.confirm({
      title: "Batalkan Transaksi?",
      description: `Apakah kamu yakin ingin membatalkan transaksi top up +${tx.amount} koin? Transaksi yang dibatalkan tidak dapat dilanjutkan lagi.`,
      badge: "Batalkan Top Up",
      confirmText: "Ya, Batalkan",
      cancelText: "Kembali",
      variant: "danger",
      isDanger: true,
    });

    if (!confirmed) return;

    setCancellingTxId(tx.id);
    try {
      const res = await fetch("/api/coin/cancel-topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction_id: tx.id }),
      });
      const json = await res.json();

      if (json.success) {
        toast.success("Transaksi Dibatalkan", "Transaksi top up berhasil dibatalkan.");
        await refreshWalletAndTransactions();
      } else {
        toast.error("Gagal Membatalkan", json.message || "Gagal membatalkan transaksi.");
      }
    } catch {
      toast.error("Gagal Membatalkan", "Terjadi kesalahan jaringan.");
    } finally {
      setCancellingTxId(null);
    }
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
    <main className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#E7E5E4] bg-[#FEF3C7] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#D97706]">
          <span>🪙</span>
          <span>Dompet Koin</span>
        </div>
        <h1 className="mt-3 font-serif text-3xl sm:text-4xl text-[#1F1D1B] tracking-tight">
          Coin & Wallet
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-[#78716C]">
          Topup koin untuk bermain game room, redeem voucher hadiah, dan pantau seluruh riwayat transaksi.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ── Left column ── */}
        <div className="space-y-6 lg:col-span-3">

          {/* Balance card */}
          <div className="rounded-2xl border border-[#E7E5E4] bg-white p-6 sm:p-8 shadow-xl shadow-black/2">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#78716C]">Total Saldo Koin</p>
                <p className="mt-3 font-mono text-4xl sm:text-5xl font-bold tabular-nums text-[#1F1D1B]">{wallet?.balance ?? 0}</p>
                <p className="mt-2 text-xs font-semibold text-[#D97706] inline-flex items-center gap-1.5 bg-[#FEF3C7] border border-[#FDE68A] px-2.5 py-0.5 rounded-full">
                  <span>🪙</span> Siap digunakan untuk semua game
                </p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FEF3C7] border border-[#FDE68A] text-[#D97706]">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v2M12 16v2M9 9h4a1.5 1.5 0 0 1 0 3H9M9 12h5a1.5 1.5 0 0 1 0 3H9" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* ── Voucher card (UNIFIED) ── */}
          <div className="rounded-2xl border border-[#E7E5E4] bg-white p-6 sm:p-8 shadow-xl shadow-black/2">
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#FEF3C7] text-xs font-bold text-[#D97706]">🎁</span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#78716C]">Punya Kode Voucher?</h2>
            </div>
            <p className="mt-1 text-xs text-[#78716C]">Klaim koin gratis atau diskon topup dengan memasukkan kode unik.</p>

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
                  placeholder="Contoh: WELCOME10 atau DISKON20"
                  maxLength={50}
                  className="flex-1 rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-4 py-2.5 font-mono text-xs font-bold text-[#1F1D1B] placeholder-[#A8A29E] outline-none transition focus:border-[#C84B31] focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={voucherChecking || !voucherInput.trim()}
                  className="flex items-center gap-1.5 rounded-xl bg-[#1F1D1B] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#383330] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {voucherChecking ? (
                    <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                    </svg>
                  ) : null}
                  {voucherChecking ? "Cek..." : "Periksa"}
                </button>
              </form>
            ) : (
              /* Clear button when voucher is loaded */
              <div className="mt-4 flex items-center gap-2">
                <span className="flex-1 rounded-xl border border-[#FDE68A] bg-[#FEF3C7] px-4 py-2.5 font-mono text-xs font-bold text-[#D97706]">
                  {voucherInfo.code}
                </span>
                <button
                  type="button"
                  onClick={clearVoucher}
                  className="flex items-center gap-1.5 rounded-xl border border-[#E7E5E4] bg-white px-4 py-2.5 text-xs font-semibold text-[#78716C] transition hover:border-[#D6D3D1] hover:text-[#1F1D1B] cursor-pointer"
                >
                  Ganti
                </button>
              </div>
            )}

            {/* Check error */}
            {voucherCheckError && (
              <p className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {voucherCheckError}
              </p>
            )}

            {/* ── Coin credit result ── */}
            {voucherInfo?.type === "coin_credit" && (
              <div className="mt-4 rounded-xl border border-[#FDE68A] bg-[#FEF3C7] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-[#1F1D1B]">
                      +{voucherInfo.coinValue} Coin Gratis
                    </p>
                    <p className="mt-0.5 text-xs text-[#78716C]">
                      Koin akan langsung ditambahkan ke saldo dompetmu.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRedeemCoinVoucher}
                    disabled={voucherRedeeming}
                    className="shrink-0 rounded-xl bg-[#C84B31] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#B33E26] disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {voucherRedeeming ? "Memproses..." : "Klaim Koin"}
                  </button>
                </div>
              </div>
            )}

            {/* ── Topup discount result ── */}
            {voucherInfo?.type === "topup_discount" && (
              <div className="mt-4 rounded-xl border border-[#FDE68A] bg-[#FEF3C7] p-4">
                <p className="text-xs font-bold text-[#D97706]">{discountLabel(voucherInfo)}</p>
                {voucherInfo.minPurchase && (
                  <p className="mt-0.5 text-[11px] text-[#78716C]">Min. pembelian {fmtRp(voucherInfo.minPurchase)}</p>
                )}

                {/* Status per package selected */}
                {!selectedPkg ? (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#78716C]">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
                    </svg>
                    Pilih paket di bawah untuk melihat diskon
                  </p>
                ) : !meetsMinimum ? (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#D97706]">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Pilih paket min. {fmtRp(voucherInfo.minPurchase!)} untuk memakai voucher ini
                  </p>
                ) : discount !== null ? (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-[#10B981]">
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
          <div className="rounded-2xl border border-[#E7E5E4] bg-white p-6 sm:p-8 shadow-xl shadow-black/2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#78716C]">Pilih Paket Top Up</h2>
            <p className="mt-1 text-xs text-[#78716C]">Pilih nominal koin yang ingin ditambahkan ke akunmu.</p>

            {/* Package grid */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              {packages.map((pkg) => (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => setSelectedPackage(pkg.id)}
                  className={`relative rounded-xl border p-4 text-left transition cursor-pointer ${
                    selectedPackage === pkg.id
                      ? "border-[#C84B31] bg-[#FDF4F2] ring-1 ring-[#C84B31]/20"
                      : "border-[#E7E5E4] bg-[#FCFBF7] hover:border-[#D6D3D1] hover:bg-white"
                  }`}
                >
                  {selectedPackage === pkg.id && (
                    <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-[#C84B31]">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                  <p className="text-lg font-bold text-[#1F1D1B]">
                    {pkg.coin_amount}
                    <span className="ml-1 text-xs font-normal text-[#78716C]">coin</span>
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#C84B31]">{fmtRp(pkg.price)}</p>
                  <p className="mt-0.5 text-[10px] text-[#78716C]">{pkg.name}</p>
                </button>
              ))}
              {packages.length === 0 && (
                <div className="col-span-2 rounded-xl border border-dashed border-[#E7E5E4] py-8 text-center text-xs text-[#78716C]">
                  Belum ada paket koin tersedia
                </div>
              )}
            </div>

            {/* Summary + CTA */}
            {selectedPkg && (
              <form onSubmit={handleTopup} className="mt-6 border-t border-[#F5F5F4] pt-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] p-4">
                  <div>
                    <p className="text-[11px] font-medium text-[#78716C]">Total Pembayaran</p>
                    {discount !== null ? (
                      <>
                        <p className="text-lg font-bold text-[#1F1D1B]">
                          {fmtRp(selectedPkg.price - discount)}
                          <span className="ml-2 text-xs font-semibold text-[#10B981]">({selectedPkg.coin_amount} Coin)</span>
                        </p>
                        <p className="text-[10px] text-[#A8A29E] line-through">{fmtRp(selectedPkg.price)}</p>
                      </>
                    ) : (
                      <p className="text-lg font-bold text-[#1F1D1B]">
                        {fmtRp(selectedPkg.price)}
                        <span className="ml-2 text-xs font-semibold text-[#C84B31]">({selectedPkg.coin_amount} Coin)</span>
                      </p>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#C84B31] px-6 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#B33E26] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
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
                    {loading ? "Memproses..." : "Beli Sekarang"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* ── Right column: transaction history ── */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-xl shadow-black/2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#78716C]">Riwayat Transaksi</h2>
            <div className="mt-4 max-h-[580px] space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin]">
              {transactions.length === 0 && (
                <div className="rounded-xl border border-dashed border-[#E7E5E4] py-12 text-center">
                  <svg className="mx-auto mb-2 text-[#A8A29E]" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                  </svg>
                  <p className="text-xs text-[#78716C]">Belum ada riwayat transaksi</p>
                </div>
              )}
              {transactions.map((tx) => {
                const reason      = tx.metadata?.reason as string | undefined;
                const gameType    = tx.metadata?.game_type as string | undefined;
                const sessionCode = tx.metadata?.session_code as string | undefined;
                const isRefund    = reason === "session_expired_refund";
                const isGame      = reason === "game_session_created" || reason === "game_session_joined";
                const gameLabel   = gameType === "tod" ? "Truth or Dare" : gameType === "snake_ladder" ? "Ular Tangga" : null;
                const amountColor = isRefund ? "text-[#2563EB]" : tx.type === "topup" ? "text-[#10B981]" : "text-[#C84B31]";
                return (
                  <div key={tx.id} className="rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] p-3.5 transition hover:border-[#D6D3D1] hover:bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <TypeBadge type={tx.type} metadata={tx.metadata} />
                      <StatusBadge status={tx.payment_status} />
                    </div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className={`text-lg font-bold ${amountColor}`}>
                        {tx.type === "topup" ? "+" : "-"}{tx.amount}
                      </span>
                      <span className="text-[11px] text-[#78716C]">coin</span>
                    </div>
                    {gameLabel && (
                      <p className="mt-1 text-[11px] font-medium text-[#78716C]">🎮 {gameLabel}{sessionCode ? ` · ${sessionCode}` : ""}</p>
                    )}
                    {!isGame && !isRefund && tx.payment_reference && (
                      <p className="mt-1 font-mono text-[10px] text-[#A8A29E] break-all">{tx.payment_reference}</p>
                    )}
                    {tx.paid_at && (
                      <p className="mt-1 text-[10px] text-[#A8A29E]">
                        {new Date(tx.paid_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                    {tx.payment_status === "pending" && tx.type === "topup" && (
                      <div className="mt-2.5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handlePayPending(tx)}
                          disabled={cancellingTxId === tx.id}
                          className="flex-1 rounded-lg bg-[#FEF3C7] border border-[#FDE68A] py-1.5 text-xs font-semibold text-[#D97706] transition hover:bg-[#FDE68A]/60 cursor-pointer disabled:opacity-50 text-center"
                        >
                          Lanjutkan Pembayaran
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancelPending(tx)}
                          disabled={cancellingTxId === tx.id}
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 hover:border-red-300 cursor-pointer disabled:opacity-50"
                        >
                          {cancellingTxId === tx.id ? "Batal..." : "Batalkan"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
