import { cancelSnapSession, cancelTransaction, getTransactionStatus } from "@/lib/midtrans";
import { creditFromKnownStatus, type VerifyPaymentResult } from "@/lib/coin/verify-payment";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Shared logic untuk menutup akses pembayaran Midtrans pada satu transaksi
 * topup yang masih 'pending'. Dipakai oleh DUA pemicu berbeda:
 * - POST /api/coin/cancel-topup — user membatalkan manual
 * - GET  /api/cron/expire-topup — auto-expire otomatis (>60 menit)
 *
 * Kedua pemicu itu funsinya SAMA dari sudut pandang Midtrans: "transaksi ini
 * harus dianggap tidak berlaku lagi." Race condition yang sama (user bayar
 * TEPAT sebelum ditutup) juga bisa terjadi di kedua jalur — makanya logic
 * ini disatukan di sini alih-alih diduplikasi.
 *
 * TIDAK melakukan ownership check atau mengubah status DB (`coin_transactions`) —
 * itu tanggung jawab RPC `cancel_topup_transaction` yang dipanggil oleh
 * pemanggil (baik dari endpoint user maupun cron, keduanya memakai RPC yang
 * sama dengan `p_user_id` = pemilik transaksi itu sendiri) SETELAH fungsi
 * ini memastikan aman difinalisasi sebagai gagal.
 */

export type CloseMidtransAccessOutcome =
  /** Aman difinalisasi sebagai gagal/expired di DB — Midtrans sudah dipastikan tidak akan menerima pembayaran lagi. */
  | { outcome: "safe_to_finalize_as_failed" }
  /** Race condition: user ternyata sudah bayar. Coin sudah dikreditkan sebagai sukses, JANGAN finalisasi sebagai gagal. */
  | { outcome: "credited_as_paid"; result: VerifyPaymentResult }
  /** Sudah terdeteksi sudah dibayar, tapi proses kredit coin gagal — perlu retry/investigasi manual. */
  | { outcome: "credit_failed"; message: string };

export async function closeMidtransAccessForTopup(params: {
  paymentReference: string;
  userId: string;
  snapToken?: string | null;
  req?: Request;
}): Promise<CloseMidtransAccessOutcome> {
  const { paymentReference, userId, snapToken, req } = params;

  async function creditAsAlreadyPaid(): Promise<CloseMidtransAccessOutcome> {
    // Ambil status terbaru langsung dari Midtrans untuk data yang akurat
    // (outcome cancel API kadang tidak menyertakan detail lengkap).
    const latestStatus = await getTransactionStatus(paymentReference);
    const creditResult = await creditFromKnownStatus({
      paymentReference,
      userId,
      statusData: latestStatus ?? { transaction_status: "settlement" },
      req,
    });

    if (!creditResult.ok) {
      return { outcome: "credit_failed", message: creditResult.message };
    }
    return { outcome: "credited_as_paid", result: creditResult };
  }

  // Step 1: tutup Snap PAGE SESSION dulu (jika ada token-nya) — mencegah
  // customer masih bisa mengakses/menyelesaikan pembayaran lewat URL Snap.
  if (snapToken) {
    const snapResult = await cancelSnapSession(snapToken);
    if (snapResult.outcome === "in_progress") {
      // Customer sedang di tengah proses bayar — jangan finalisasi gagal.
      return await creditAsAlreadyPaid();
    }
    // "cancelled" atau "not_found_or_already_gone" → aman, lanjut ke step 2.
  }

  // Step 2: batalkan transaksi Core API juga, untuk kasus customer sudah
  // memilih metode bayar (VA/QRIS sudah digenerate, transaksi Core API ada).
  const coreResult = await cancelTransaction(paymentReference);
  if (coreResult.outcome === "already_paid") {
    return await creditAsAlreadyPaid();
  }
  // "cancelled" atau "not_cancellable" (404/expired/denied di Midtrans) →
  // keduanya aman, transaksi ini sudah tidak mungkin dibayar lagi.

  return { outcome: "safe_to_finalize_as_failed" };
}

export type FinalizeTopupCancellationResult =
  | { ok: true; outcome: "cancelled"; message: string }
  | { ok: true; outcome: "credited_as_paid" }
  /** Kegagalan sistem (Midtrans unreachable, RPC/DB error) — 500 di route. */
  | { ok: false; reason: "system_error"; message: string }
  /** Kegagalan aturan bisnis (misal status transaksi berubah di antara pengecekan awal & finalisasi) — 400 di route. */
  | { ok: false; reason: "business_error"; message: string };

/**
 * Fungsi tingkat tinggi: gabungan "tutup akses Midtrans" (di atas) + panggil
 * RPC `cancel_topup_transaction` untuk finalisasi status di DB (termasuk
 * rollback voucher). Ini yang dipanggil langsung oleh KEDUA pemicu:
 * - POST /api/coin/cancel-topup (per satu transaksi, milik user yang login)
 * - GET  /api/cron/expire-topup (loop semua transaksi pending > 60 menit)
 *
 * Disatukan di sini supaya kedua pemicu benar-benar menjalankan langkah yang
 * identik — tidak ada logic yang bisa "kelewat" di salah satu jalur.
 */
export async function cancelOrCreditPendingTopup(params: {
  transactionId: number;
  paymentReference: string | null;
  userId: string;
  snapToken?: string | null;
  req?: Request;
}): Promise<FinalizeTopupCancellationResult> {
  const { transactionId, paymentReference, userId, snapToken, req } = params;

  if (paymentReference) {
    const closeResult = await closeMidtransAccessForTopup({ paymentReference, userId, snapToken, req });

    if (closeResult.outcome === "credited_as_paid") {
      return { ok: true, outcome: "credited_as_paid" };
    }
    if (closeResult.outcome === "credit_failed") {
      return { ok: false, reason: "system_error", message: closeResult.message };
    }
    // "safe_to_finalize_as_failed" → lanjut ke finalisasi DB di bawah.
  }

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient.rpc("cancel_topup_transaction", {
    p_transaction_id: transactionId,
    p_user_id: userId,
  });

  if (error) {
    return { ok: false, reason: "system_error", message: error.message ?? "Gagal membatalkan transaksi" };
  }

  const result = data as { success: boolean; message: string };
  if (!result.success) {
    return { ok: false, reason: "business_error", message: result.message };
  }

  return { ok: true, outcome: "cancelled", message: result.message };
}
