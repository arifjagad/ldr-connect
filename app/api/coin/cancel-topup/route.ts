import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { cancelOrCreditPendingTopup } from "@/lib/coin/cancel-topup";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/coin/cancel-topup
 * Batalkan transaksi topup coin yang berstatus 'pending'
 * Body: { transaction_id: number }
 *
 * Logic inti "tutup akses Midtrans dulu, baru finalisasi di DB" ada di
 * lib/coin/cancel-topup.ts — dipakai bersama oleh cron auto-expire
 * (app/api/cron/expire-topup) supaya kedua jalur (cancel manual & auto-expire)
 * konsisten menangani hal yang sama:
 *
 * 1. Snap payment page punya SESSION SENDIRI yang terpisah dari transaksi
 *    Core API — perlu ditutup lewat endpoint Snap API, bukan cuma Core API.
 * 2. Race condition: jika user menyelesaikan pembayaran TEPAT sebelum
 *    dibatalkan/expired, transaksi HARUS dikreditkan sebagai sukses, bukan
 *    digagalkan (mencegah user bayar tapi coin hilang akibat fraud guard
 *    failed→paid di RPC update_payment_status).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Validate session
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthenticated", data: null },
      { status: 401 }
    );
  }

  // Rate limit: defense-in-depth untuk panggilan Midtrans Snap API di cancelOrCreditPendingTopup
  const rateLimitResponse = await checkRateLimit(user.id, {
    endpoint: "coin/cancel-topup",
    maxRequests: 10,
    windowMinutes: 15,
  });
  if (rateLimitResponse) return rateLimitResponse;

  let body: { transaction_id?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Request body tidak valid", data: null },
      { status: 400 }
    );
  }

  const { transaction_id } = body;
  if (!transaction_id || typeof transaction_id !== "number") {
    return NextResponse.json(
      { success: false, message: "transaction_id wajib diisi", data: null },
      { status: 422 }
    );
  }

  const serviceClient = createServiceClient();

  // Ambil transaksi dulu untuk validasi ownership/status & dapatkan payment_reference
  // (order_id Midtrans) sebelum memutuskan apapun ke Midtrans.
  const { data: tx, error: txError } = await serviceClient
    .from("coin_transactions")
    .select("id, user_id, type, payment_status, payment_reference, metadata")
    .eq("id", transaction_id)
    .single();

  if (txError || !tx) {
    return NextResponse.json(
      { success: false, message: "Transaksi tidak ditemukan", data: null },
      { status: 404 }
    );
  }
  if (tx.user_id !== user.id) {
    return NextResponse.json(
      { success: false, message: "Kamu tidak memiliki akses ke transaksi ini", data: null },
      { status: 403 }
    );
  }
  if (tx.type !== "topup") {
    return NextResponse.json(
      { success: false, message: "Hanya transaksi top-up yang dapat dibatalkan", data: null },
      { status: 400 }
    );
  }
  if (tx.payment_status !== "pending") {
    return NextResponse.json(
      { success: false, message: "Transaksi sudah tidak dalam status menunggu pembayaran", data: null },
      { status: 400 }
    );
  }

  const snapToken = (tx.metadata as Record<string, unknown> | null)?.snap_token as string | undefined;

  const finalizeResult = await cancelOrCreditPendingTopup({
    transactionId: transaction_id,
    paymentReference: tx.payment_reference,
    userId: user.id,
    snapToken,
    req: request,
  });

  if (!finalizeResult.ok) {
    if (finalizeResult.reason === "system_error") {
      console.error("[cancel-topup] gagal:", finalizeResult.message);
    }
    return NextResponse.json(
      { success: false, message: finalizeResult.message, data: null },
      { status: finalizeResult.reason === "business_error" ? 400 : 500 }
    );
  }

  if (finalizeResult.outcome === "credited_as_paid") {
    return NextResponse.json({
      success: true,
      message: "Pembayaran kamu ternyata sudah berhasil sebelum dibatalkan — coin sudah ditambahkan ke akun kamu!",
      data: { paid_instead_of_cancelled: true },
    });
  }

  return NextResponse.json({
    success: true,
    message: finalizeResult.message,
    data: null,
  });
}
