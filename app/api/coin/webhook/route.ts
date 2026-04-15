import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createHash } from "crypto";

/**
 * POST /api/coin/webhook
 * Midtrans payment notification webhook
 * Server-to-server, tidak butuh session user
 *
 * Midtrans docs: https://docs.midtrans.com/reference/http-notification-webhooks
 */
export async function POST(request: NextRequest) {
  let body: Record<string, string>;
  try {
    body = await request.json();
    console.log("[webhook] Received payload:", JSON.stringify(body));
  } catch {
    // Midtrans "Tes URL" mungkin kirim body kosong / bukan JSON
    console.log("[webhook] Non-JSON body received (URL test?)");
    return NextResponse.json({ message: "OK" });
  }

  const {
    order_id,
    status_code,
    gross_amount,
    transaction_status,
    fraud_status,
    signature_key: receivedSignature,
    settlement_time,
  } = body;

  // Verifikasi signature Midtrans
  // Format: SHA512(order_id + status_code + gross_amount + server_key)
  const serverKey = process.env.MIDTRANS_SERVER_KEY!;
  const expectedSignature = createHash("sha512")
    .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
    .digest("hex");

  if (receivedSignature !== expectedSignature) {
    // Di sandbox, Midtrans "Tes URL" mengirim payload test dengan signature tidak valid.
    // Jika ini payload test (tidak ada order_id), return 200 supaya URL test hijau.
    if (!order_id) {
      return NextResponse.json({ message: "OK (test)" });
    }
    return NextResponse.json({ message: "Invalid signature" }, { status: 403 });
  }

  // Tentukan status internal
  const isPaid =
    (transaction_status === "capture" && fraud_status === "accept") ||
    transaction_status === "settlement";
  const isFailed =
    transaction_status === "deny" ||
    transaction_status === "cancel" ||
    transaction_status === "expire";

  if (!isPaid && !isFailed) {
    // Status pending / lainnya — abaikan, Midtrans akan kirim notif lagi saat final
    return NextResponse.json({ message: "OK" });
  }

  const newStatus = isPaid ? "paid" : "failed";
  const paidAt = isPaid ? (settlement_time ?? new Date().toISOString()) : null;

  const serviceClient = await createServiceClient();
  const { error: rpcError } = await serviceClient.rpc("update_payment_status", {
    p_payment_reference: order_id,
    p_new_status: newStatus,
    p_paid_at: paidAt,
    p_metadata: { webhook_payload: body },
  });

  if (rpcError) {
    const msg = rpcError.message ?? "";
    // ALREADY_PAID & TRANSACTION_NOT_FOUND — bukan error fatal, return 200
    // supaya Midtrans tidak retry terus-menerus
    if (msg.includes("ALREADY_PAID") || msg.includes("TRANSACTION_NOT_FOUND")) {
      console.log("[webhook] Skipped:", msg);
      return NextResponse.json({ message: "OK" });
    }
    console.error("[webhook] update_payment_status error:", msg);
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ message: "OK" });
}
