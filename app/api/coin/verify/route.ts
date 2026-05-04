import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logSecurityEvent } from "@/lib/security-logger";

const MIDTRANS_STATUS_URL = process.env.MIDTRANS_IS_PRODUCTION === "true"
  ? "https://api.midtrans.com/v2"
  : "https://api.sandbox.midtrans.com/v2";

/**
 * POST /api/coin/verify
 * Cek status pembayaran ke Midtrans + update wallet jika sudah paid
 *
 * Body: { payment_reference: string }
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

  // Parse body
  let body: { payment_reference?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Request body tidak valid", data: null },
      { status: 400 }
    );
  }

  const { payment_reference } = body;
  if (!payment_reference?.trim()) {
    return NextResponse.json(
      { success: false, message: "payment_reference wajib diisi", data: null },
      { status: 422 }
    );
  }

  // Cek Midtrans status
  const serverKey = process.env.MIDTRANS_SERVER_KEY!;
  const authHeader = "Basic " + Buffer.from(serverKey + ":").toString("base64");

  let midtransStatus: string | null = null;
  let midtransData: Record<string, unknown> = {};

  try {
    const statusRes = await fetch(
      `${MIDTRANS_STATUS_URL}/${encodeURIComponent(payment_reference)}/status`,
      { headers: { Authorization: authHeader } }
    );

    if (statusRes.ok) {
      midtransData = await statusRes.json();
      midtransStatus = midtransData.transaction_status as string ?? null;
    }
  } catch {
    return NextResponse.json(
      { success: false, message: "Gagal menghubungi Midtrans. Coba beberapa saat lagi.", data: null },
      { status: 502 }
    );
  }

  if (!midtransStatus) {
    return NextResponse.json(
      { success: false, message: "Transaksi tidak ditemukan di Midtrans", data: null },
      { status: 404 }
    );
  }

  // Map Midtrans status → internal status
  // capture HARUS fraud_status === "accept" — sama persis dengan logika di webhook
  const fraudStatus = midtransData.fraud_status as string | undefined;
  const isPaid =
    (midtransStatus === "capture" && fraudStatus === "accept") ||
    midtransStatus === "settlement";
  const isFailed = midtransStatus === "deny" || midtransStatus === "cancel" || midtransStatus === "expire";

  if (!isPaid && !isFailed) {
    return NextResponse.json(
      { success: false, message: `Pembayaran masih ${midtransStatus}. Harap selesaikan pembayaran terlebih dahulu.`, data: null },
      { status: 400 }
    );
  }

  const newStatus = isPaid ? "paid" : "failed";
  const paidAt = isPaid ? (midtransData.settlement_time as string ?? new Date().toISOString()) : null;

  // Pastikan payment_reference milik user yang sedang login (ownership check)
  const serviceClient = createServiceClient();
  const { data: txOwner } = await serviceClient
    .from("coin_transactions")
    .select("user_id")
    .eq("payment_reference", payment_reference)
    .single();

  if (!txOwner || txOwner.user_id !== user.id) {
    logSecurityEvent({
      event: "security:payment_ownership_violation",
      userId: user.id,
      metadata: { attempted_reference: payment_reference },
      req: request,
    });
    return NextResponse.json(
      { success: false, message: "Transaksi tidak ditemukan", data: null },
      { status: 404 }
    );
  }

  // Update via RPC (atomic: update tx + tambah wallet jika paid)
  const { data: updatedTx, error: rpcError } = await serviceClient.rpc("update_payment_status", {
    p_payment_reference: payment_reference,
    p_new_status: newStatus,
    p_paid_at: paidAt,
    p_metadata: { midtrans_verification: midtransData },
  });

  if (rpcError) {
    // ALREADY_PAID bukan error dari perspektif user
    if (rpcError.message?.includes("ALREADY_PAID")) {
      return NextResponse.json({
        success: true,
        message: "Coin sudah berhasil ditambahkan ke akun kamu!",
        data: null,
      });
    }
    return NextResponse.json(
      { success: false, message: rpcError.message ?? "Gagal memverifikasi pembayaran", data: null },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: isPaid
      ? "Coin berhasil ditambahkan ke akun kamu!"
      : "Pembayaran gagal. Coin tidak ditambahkan.",
    data: { transaction: updatedTx },
  });
}
