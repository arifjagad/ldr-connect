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
        } else {
          setMessage(json.message ?? "Coin akan diproses otomatis oleh sistem.");
          setVerifyState("failed");
        }
      } catch {
        setMessage("Coin akan diproses otomatis oleh sistem.");
        setVerifyState("failed");
      }
    }

    autoVerify();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#0D0D10] px-4">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 40%, rgba(52,211,153,0.08) 0%, transparent 70%)",
        }}
      />

      <div className="w-full max-w-md">
        {isSuccess ? (
          /* ── SUCCESS ── */
          <div className="overflow-hidden rounded-3xl border border-[#34D399]/20 bg-[#111113]">
            {/* Top accent bar */}
            <div className="h-1 w-full bg-linear-to-r from-[#34D399] to-[#6EE7B7]" />

            <div className="p-8">
              {/* Icon */}
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-[#34D399]/20 to-[#34D399]/5 ring-1 ring-[#34D399]/20">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#34D399"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>

              <h1 className="text-center text-2xl font-bold text-[#FFF5F8]">
                Pembayaran Berhasil!
              </h1>
              <p className="mt-2 text-center text-sm text-[#5C5470]">
                Transaksi kamu telah dikonfirmasi oleh Midtrans.
              </p>

              {/* Order ID */}
              {orderId && (
                <div className="mt-5 rounded-xl border border-white/[0.07] bg-[#18181C] px-4 py-3">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-[#5C5470]">
                    Order ID
                  </p>
                  <p className="mt-1 break-all font-mono text-sm text-[#9B93B0]">
                    {orderId}
                  </p>
                </div>
              )}

              {/* Verify status */}
              <div className="mt-4">
                {verifyState === "loading" && (
                  <div className="flex items-center gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
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
                  <div className="flex items-center gap-3 rounded-xl border border-[#34D399]/20 bg-[#34D399]/10 px-4 py-3 text-sm text-[#34D399]">
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
                )}

                {verifyState === "failed" && (
                  <div className="flex items-center gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
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
                )}
              </div>

              {/* Actions */}
              <div className="mt-6 flex flex-col gap-3">
                <Link
                  href="/dashboard"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#34D399] px-5 py-3 text-sm font-semibold text-[#0D1F17] transition hover:bg-[#6EE7B7]"
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
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-[#9B93B0] transition hover:bg-white/10"
                >
                  Lihat Riwayat Transaksi
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* ── FAILED / PENDING ── */
          <div className="overflow-hidden rounded-3xl border border-red-500/20 bg-[#111113]">
            <div className="h-1 w-full bg-linear-to-r from-red-500 to-red-400" />

            <div className="p-8">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#F87171"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>

              <h1 className="text-center text-2xl font-bold text-[#FFF5F8]">
                Pembayaran Gagal
              </h1>
              <p className="mt-2 text-center text-sm text-[#5C5470]">
                Transaksi tidak berhasil diproses. Silakan coba lagi.
              </p>

              {orderId && (
                <div className="mt-5 rounded-xl border border-white/[0.07] bg-[#18181C] px-4 py-3">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-[#5C5470]">
                    Order ID
                  </p>
                  <p className="mt-1 break-all font-mono text-sm text-[#9B93B0]">
                    {orderId}
                  </p>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3">
                <Link
                  href="/dashboard/coin"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF3D7F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#FF6B9D]"
                >
                  Coba Top Up Lagi
                </Link>
                <Link
                  href="/dashboard"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-[#9B93B0] transition hover:bg-white/10"
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
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-[#0D0D10]" />}>
      <TopupSuccessContent />
    </Suspense>
  );
}
