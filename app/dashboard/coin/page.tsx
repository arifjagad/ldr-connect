"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CoinPackage, CoinTransaction, WalletData } from "@/lib/types";

type TopupResponse = {
  message: string;
  payment_url: string | null;
  transaction: CoinTransaction;
};

function StatusBadge({ status }: { status: CoinTransaction["payment_status"] }) {
  const map = {
    paid: "border-[#34D399]/25 bg-[#34D399]/10 text-[#34D399]",
    pending: "border-yellow-500/25 bg-yellow-500/10 text-yellow-400",
    failed: "border-red-500/25 bg-red-500/10 text-red-400",
  };
  const label = { paid: "Paid", pending: "Pending", failed: "Failed" };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${map[status]}`}>
      {label[status]}
    </span>
  );
}

function TypeBadge({ type }: { type: CoinTransaction["type"] }) {
  if (type === "topup") {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-[#34D399]">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Topup
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-[#FF6B9D]">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Deduct
    </span>
  );
}

// Helper: parse error message dari fetch response
async function parseError(res: Response): Promise<string> {
  try { const j = await res.json(); return j.message ?? "Terjadi kesalahan"; }
  catch { return "Terjadi kesalahan"; }
}

export default function CoinPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [verifyReference, setVerifyReference] = useState("");
  const [lastPaymentUrl, setLastPaymentUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canTopup = useMemo(() => selectedPackage !== null, [selectedPackage]);
  const selectedPkg = useMemo(
    () => packages.find((p) => p.id === selectedPackage) ?? null,
    [packages, selectedPackage]
  );

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

  async function refreshWalletAndTransactions() {
    const [walletRes, txRes] = await Promise.all([
      fetch("/api/coin/balance"), fetch("/api/coin/transactions"),
    ]);
    const [walletJson, txJson] = await Promise.all([walletRes.json(), txRes.json()]);
    setWallet(walletJson.data?.wallet ?? null);
    setTransactions(txJson.data?.transactions ?? []);
  }

  async function handleTopup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPackage) return;
    setLoading(true); setError(null); setStatus(null);

    const res = await fetch("/api/coin/topup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coin_package_id: selectedPackage }),
    });
    const json: { success: boolean; message: string; data: TopupResponse } = await res.json();

    if (!res.ok) { setError(json.message); }
    else {
      setLastPaymentUrl(json.data.payment_url);
      setVerifyReference(json.data.transaction.payment_reference ?? "");
      setStatus(json.message);
      await refreshWalletAndTransactions();
    }
    setLoading(false);
  }

  async function handleVerify() {
    if (!verifyReference.trim()) return;
    setLoading(true); setError(null); setStatus(null);

    const res = await fetch("/api/coin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment_reference: verifyReference.trim() }),
    });

    if (res.ok) {
      const json = await res.json();
      setStatus(json.message);
      await refreshWalletAndTransactions();
    } else {
      setError(await parseError(res));
    }
    setLoading(false);
  }

  return (
    <main className="relative mx-auto w-full max-w-5xl px-6 py-12 lg:px-8">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full blur-[120px]"
        style={{ background: "radial-gradient(ellipse, rgba(52,211,153,0.09) 0%, transparent 70%)" }}
      />

      {/* Header */}
      <div className="mb-10">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#5C5470]">Dashboard / Coin</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-[#FFF5F8]">
          Coin{" "}
          <span style={{ backgroundImage: "linear-gradient(90deg, #34D399, #6EE7B7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Wallet
          </span>
        </h1>
        <p className="mt-2 text-sm text-[#5C5470]">Topup coin dan kelola riwayat transaksi kamu.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left column */}
        <div className="space-y-4 lg:col-span-3">

          {/* Balance card */}
          <div className="relative overflow-hidden rounded-2xl border border-[#34D399]/20 bg-linear-to-br from-[#34D399]/10 to-transparent p-6">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full blur-2xl"
              style={{ background: "rgba(52,211,153,0.15)" }}
            />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-[#5C5470]">Saldo Coin</p>
                <p className="mt-2 text-5xl font-bold tabular-nums text-[#FFF5F8]">
                  {wallet?.balance ?? 0}
                </p>
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

          {/* Topup section */}
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
                  <p className="text-lg font-bold text-[#FFF5F8]">{pkg.coin_amount}
                    <span className="ml-1 text-sm font-normal text-[#5C5470]">coin</span>
                  </p>
                  <p className="mt-1 text-xs font-medium text-[#34D399]">
                    Rp{pkg.price.toLocaleString("id-ID")}
                  </p>
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
              <div className="mt-5 flex items-center justify-between rounded-xl border border-white/[0.07] bg-[#18181C] px-4 py-3">
                <div>
                  <p className="text-xs text-[#5C5470]">Total pembayaran</p>
                  <p className="text-base font-bold text-[#FFF5F8]">
                    Rp{selectedPkg.price.toLocaleString("id-ID")}
                    <span className="ml-2 text-xs font-normal text-[#34D399]">→ {selectedPkg.coin_amount} coin</span>
                  </p>
                </div>
                <form onSubmit={handleTopup}>
                  <button
                    type="submit"
                    disabled={loading || !canTopup}
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
                </form>
              </div>
            )}

            {/* Payment URL */}
            {lastPaymentUrl && (
              <a
                href={lastPaymentUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[#34D399]/30 bg-[#34D399]/10 px-4 py-3 text-sm font-semibold text-[#34D399] transition hover:bg-[#34D399]/15"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Buka Halaman Pembayaran
              </a>
            )}
          </div>

          {/* Verify section */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
            <p className="text-xs font-medium uppercase tracking-widest text-[#5C5470]">Verifikasi Pembayaran</p>
            <p className="mt-1 text-sm text-[#5C5470]">Masukkan reference jika status belum terupdate otomatis.</p>
            <div className="mt-4 flex gap-3">
              <input
                value={verifyReference}
                onChange={(e) => setVerifyReference(e.target.value)}
                className="flex-1 rounded-xl border border-white/10 bg-[#18181C] px-4 py-2.5 text-sm text-[#FFF5F8] outline-none placeholder:text-[#5C5470] focus:border-[#FF3D7F]/40 focus:ring-1 focus:ring-[#FF3D7F]/20 transition"
                placeholder="TOPUP-xxxxxxxx"
              />
              <button
                type="button"
                onClick={handleVerify}
                disabled={loading || !verifyReference.trim()}
                className="flex items-center gap-2 rounded-xl bg-[#FF3D7F] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(255,61,127,0.25)] transition hover:bg-[#FF6B9D] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Verify
              </button>
            </div>
          </div>
        </div>

        {/* Right column — transaction history */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
            <p className="text-xs font-medium uppercase tracking-widest text-[#5C5470]">Riwayat Transaksi</p>

            <div className="mt-5 space-y-3">
              {transactions.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/10 py-10 text-center">
                  <svg className="mx-auto mb-3 text-[#5C5470]" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  <p className="text-sm text-[#5C5470]">Belum ada transaksi</p>
                </div>
              )}
              {transactions.map((tx) => (
                <div key={tx.id} className="rounded-xl border border-white/[0.07] bg-[#18181C] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <TypeBadge type={tx.type} />
                    <StatusBadge status={tx.payment_status} />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className={`text-xl font-bold ${tx.type === "topup" ? "text-[#34D399]" : "text-[#FF6B9D]"}`}>
                      {tx.type === "topup" ? "+" : "-"}{tx.amount}
                    </span>
                    <span className="text-xs text-[#5C5470]">coin</span>
                  </div>
                  <p className="mt-1.5 font-mono text-[10px] text-[#5C5470] break-all">{tx.payment_reference}</p>
                  {tx.paid_at && (
                    <p className="mt-1 text-[10px] text-[#5C5470]">
                      {new Date(tx.paid_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Feedback */}
      {status && (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#34D399]/20 bg-[#34D399]/10 px-4 py-3 text-sm text-[#34D399]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {status}
        </div>
      )}
      {error && (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}
    </main>
  );
}
