import { createServiceClient } from "@/lib/supabase/server";
import { getTransactionStatus, isPaidStatus, isFailedStatus, type MidtransStatusData } from "@/lib/midtrans";
import { logSecurityEvent } from "@/lib/security-logger";
import type { CoinTransaction } from "@/lib/types";

/**
 * Logic bersama untuk memverifikasi status pembayaran Midtrans dan meng-kredit
 * wallet jika sudah paid. Dipakai oleh:
 * - POST /api/coin/verify        (user memicu manual dari halaman success/coin)
 * - POST /api/coin/cancel-topup  (fallback saat ternyata sudah dibayar tepat
 *                                  sebelum user sempat membatalkan — lihat
 *                                  lib/midtrans.ts outcome "already_paid")
 *
 * Kredit coin SELALU lewat RPC `update_payment_status` (atomic, SECURITY DEFINER)
 * supaya satu sumber kebenaran dengan webhook Midtrans.
 */

export type VerifyPaymentResult =
  | { ok: true; status: "paid" | "failed"; alreadyProcessed: false; transaction: CoinTransaction }
  /** RPC melempar ALREADY_PAID — transaksi sudah dikreditkan sebelumnya (misal oleh webhook). Idempotent, bukan error. */
  | { ok: true; status: "paid"; alreadyProcessed: true }
  | { ok: false; code: "NOT_FOUND_IN_MIDTRANS" | "STILL_PENDING" | "OWNERSHIP_VIOLATION" | "RPC_ERROR" | "MIDTRANS_UNREACHABLE"; message: string };

/**
 * Verifikasi ownership: payment_reference harus milik userId yang diberikan.
 * Dipanggil sebelum keputusan kredit apapun untuk mencegah user A memverifikasi
 * transaksi milik user B (IDOR).
 */
async function assertOwnership(paymentReference: string, userId: string, req?: Request): Promise<boolean> {
  const serviceClient = createServiceClient();
  const { data: txOwner } = await serviceClient
    .from("coin_transactions")
    .select("user_id")
    .eq("payment_reference", paymentReference)
    .single();

  if (!txOwner || txOwner.user_id !== userId) {
    logSecurityEvent({
      event: "security:payment_ownership_violation",
      userId,
      metadata: { attempted_reference: paymentReference },
      req,
    });
    return false;
  }
  return true;
}

/**
 * Kredit/gagalkan transaksi berdasarkan status Midtrans yang SUDAH diketahui
 * (misal dari cancelTransaction() yang sudah re-check status saat outcome 412).
 * Tidak melakukan fetch status baru ke Midtrans — pemanggil bertanggung jawab
 * memastikan `statusData` adalah data terbaru.
 */
export async function creditFromKnownStatus(params: {
  paymentReference: string;
  userId: string;
  statusData: MidtransStatusData;
  req?: Request;
}): Promise<VerifyPaymentResult> {
  const { paymentReference, userId, statusData, req } = params;

  const ownedByUser = await assertOwnership(paymentReference, userId, req);
  if (!ownedByUser) {
    return { ok: false, code: "OWNERSHIP_VIOLATION", message: "Transaksi tidak ditemukan" };
  }

  const paid = isPaidStatus(statusData);
  const failed = isFailedStatus(statusData);

  if (!paid && !failed) {
    return {
      ok: false,
      code: "STILL_PENDING",
      message: `Pembayaran masih ${statusData.transaction_status ?? "pending"}. Harap selesaikan pembayaran terlebih dahulu.`,
    };
  }

  return applyPaymentStatus({ paymentReference, isPaid: paid, statusData });
}

/**
 * Verifikasi status pembayaran langsung ke Midtrans (fetch baru) lalu kredit
 * jika paid. Ini adalah jalur normal dipanggil dari POST /api/coin/verify.
 */
export async function verifyAndCreditPayment(params: {
  paymentReference: string;
  userId: string;
  req?: Request;
}): Promise<VerifyPaymentResult> {
  const { paymentReference, userId, req } = params;

  const ownedByUser = await assertOwnership(paymentReference, userId, req);
  if (!ownedByUser) {
    return { ok: false, code: "OWNERSHIP_VIOLATION", message: "Transaksi tidak ditemukan" };
  }

  let statusData: MidtransStatusData | null;
  try {
    statusData = await getTransactionStatus(paymentReference);
  } catch {
    return { ok: false, code: "MIDTRANS_UNREACHABLE", message: "Gagal menghubungi Midtrans. Coba beberapa saat lagi." };
  }

  if (!statusData) {
    return { ok: false, code: "NOT_FOUND_IN_MIDTRANS", message: "Transaksi tidak ditemukan di Midtrans" };
  }

  const paid = isPaidStatus(statusData);
  const failed = isFailedStatus(statusData);

  if (!paid && !failed) {
    return {
      ok: false,
      code: "STILL_PENDING",
      message: `Pembayaran masih ${statusData.transaction_status ?? "pending"}. Harap selesaikan pembayaran terlebih dahulu.`,
    };
  }

  return applyPaymentStatus({ paymentReference, isPaid: paid, statusData });
}

async function applyPaymentStatus(params: {
  paymentReference: string;
  isPaid: boolean;
  statusData: MidtransStatusData;
}): Promise<VerifyPaymentResult> {
  const { paymentReference, isPaid, statusData } = params;
  const newStatus = isPaid ? "paid" : "failed";
  const paidAt = isPaid ? (statusData.settlement_time ?? new Date().toISOString()) : null;

  const serviceClient = createServiceClient();
  const { data: updatedTx, error: rpcError } = await serviceClient.rpc("update_payment_status", {
    p_payment_reference: paymentReference,
    p_new_status: newStatus,
    p_paid_at: paidAt,
    p_metadata: { midtrans_verification: statusData },
  });

  if (rpcError) {
    if (rpcError.message?.includes("ALREADY_PAID")) {
      // Idempotent: sudah dikreditkan sebelumnya (misal oleh webhook Midtrans
      // yang tiba lebih dulu). Bukan error dari perspektif user.
      return { ok: true, status: "paid", alreadyProcessed: true };
    }
    return { ok: false, code: "RPC_ERROR", message: rpcError.message ?? "Gagal memverifikasi pembayaran" };
  }

  return {
    ok: true,
    status: newStatus,
    alreadyProcessed: false,
    transaction: updatedTx as CoinTransaction,
  };
}
