"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type VerifyState = "idle" | "loading" | "success" | "failed";

function TopupSuccessContent() {
  const searchParams = useSearchParams();

  const orderId = searchParams.get("order_id") ?? "";
  const statusCode = searchParams.get("status_code") ?? "";
  const transactionStatus = searchParams.get("transaction_status") ?? "";

  const isSuccess =
    transactionStatus === "capture" ||
    transactionStatus === "settlement" ||
    statusCode === "200";

  const [verifyState, setVerifyState] = useState<VerifyState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  // Auto-verify via Next.js API route (Step 4 — /api/coin/verify)
  useEffect(() => {
    if (!isSuccess || !orderId) return;

    async function autoVerify() {
      setVerifyState("loading");
      try {
        const res = await fetch("/api/coin/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payment_reference: orderId }),
        });
        const json = await res.json();
        if (res.ok && json.success) {
          setMessage(json.message ?? "Coin berhasil ditambahkan!");
          setVerifyState("success");
          setTimeout(() => window.close(), 3000);
        } else {
          setMessage(json.message ?? "Coin akan diproses otomatis oleh sistem.");
          setVerifyState("failed");
          setTimeout(() => window.close(), 3000);
        }
      } catch {
        setMessage("Coin akan diproses otomatis oleh sistem.");
        setVerifyState("failed");
        setTimeout(() => window.close(), 3000);
      }
    }

    autoVerify();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#FCFBF7] px-4">
      <div className="w-full max-w-md">
        {isSuccess ? (
          /* ── SUCCESS ── */
          <div className="overflow-hidden rounded-3xl border border-[#E7E5E4] bg-white shadow-xl shadow-black/2">
            {/* Top accent bar */}
            <div className="h-1.5 w-full bg-[#10B981]" />

            <div className="p-8">
              {/* Icon */}
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#EBF9EB] border border-[#10B981]/25">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>

              <h1 className="text-center text-2xl font-serif font-bold text-[#1F1D1B]">
                Pembayaran Berhasil!
              </h1>
              <p className="mt-2 text-center text-sm text-[#78716C]">
                Transaksi kamu telah dikonfirmasi oleh Midtrans.
              </p>

              {/* Order ID */}
              {orderId && (
                <div className="mt-5 rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#78716C]">
                    Order ID
                  </p>
                  <p className="mt-1 break-all font-mono text-sm text-[#1F1D1B]">
                    {orderId}
                  </p>
                </div>
              )}

              {/* Verify status */}
              <div className="mt-4">
                {verifyState === "loading" && (
                  <div className="flex items-center gap-3 rounded-xl border border-[#FDE68A] bg-[#FEF3C7] px-4 py-3 text-sm text-[#D97706]">
                    <svg
                      className="animate-spin shrink-0"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                    </svg>
                    Memverifikasi coin ke akun kamu…
                  </div>
                )}

                {verifyState === "success" && (
                  <div className="flex flex-col gap-2 rounded-xl border border-[#10B981]/25 bg-[#EBF9EB] px-4 py-3 text-sm text-[#10B981]">
                    <div className="flex items-center gap-3">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {message ?? "Coin berhasil ditambahkan ke akun kamu!"}
                    </div>
                    <p className="text-xs text-[#10B981]/70 text-center animate-pulse">Menutup halaman otomatis...</p>
                  </div>
                )}

                {verifyState === "failed" && (
                  <div className="flex flex-col gap-2 rounded-xl border border-[#FDE68A] bg-[#FEF3C7] px-4 py-3 text-sm text-[#D97706]">
                    <div className="flex items-center gap-3">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {message ?? "Coin akan diproses secara otomatis oleh sistem."}
                    </div>
                    <p className="text-xs text-[#D97706]/70 text-center animate-pulse">Menutup halaman otomatis...</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-6 flex flex-col gap-3">
                <Link
                  href="/dashboard"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C84B31] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#B33E26] cursor-pointer shadow-xs"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  Ke Dashboard
                </Link>
                <Link
                  href="/dashboard/coin"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E7E5E4] bg-white px-5 py-3 text-sm font-semibold text-[#1F1D1B] transition hover:bg-[#FCFBF7] cursor-pointer shadow-2xs"
                >
                  Lihat Riwayat Transaksi
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* ── FAILED / PENDING ── */
          <div className="overflow-hidden rounded-3xl border border-[#E7E5E4] bg-white shadow-xl shadow-black/2">
            <div className="h-1.5 w-full bg-[#EF4444]" />

            <div className="p-8">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#FEF2F2] border border-red-200">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#EF4444"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>

              <h1 className="text-center text-2xl font-serif font-bold text-[#1F1D1B]">
                Pembayaran Gagal
              </h1>
              <p className="mt-2 text-center text-sm text-[#78716C]">
                Transaksi tidak berhasil diproses. Silakan coba lagi.
              </p>

              {orderId && (
                <div className="mt-5 rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#78716C]">
                    Order ID
                  </p>
                  <p className="mt-1 break-all font-mono text-sm text-[#1F1D1B]">
                    {orderId}
                  </p>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3">
                <Link
                  href="/dashboard/coin"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C84B31] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#B33E26] cursor-pointer shadow-xs"
                >
                  Coba Top Up Lagi
                </Link>
                <Link
                  href="/dashboard"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E7E5E4] bg-white px-5 py-3 text-sm font-semibold text-[#1F1D1B] transition hover:bg-[#FCFBF7] cursor-pointer shadow-2xs"
                >
                  Ke Dashboard
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function TopupSuccessPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-[#FCFBF7]" />}>
      <TopupSuccessContent />
    </Suspense>
  );
}
