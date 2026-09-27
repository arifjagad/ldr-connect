import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAndCreditPayment } from "@/lib/coin/verify-payment";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/coin/verify
 * Cek status pembayaran ke Midtrans + update wallet jika sudah paid
 *
 * Body: { payment_reference: string }
 *
 * Logic inti ada di lib/coin/verify-payment.ts (dipakai bersama oleh
 * app/api/coin/cancel-topup untuk menangani race condition cancel-vs-bayar).
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

  // Rate limit: defense-in-depth untuk panggilan cek status ke Midtrans
  const rateLimitResponse = await checkRateLimit(user.id, {
    endpoint: "coin/verify",
    maxRequests: 20,
    windowMinutes: 10,
  });
  if (rateLimitResponse) return rateLimitResponse;

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

  const result = await verifyAndCreditPayment({
    paymentReference: payment_reference,
    userId: user.id,
    req: request,
  });

  if (!result.ok) {
    const statusMap: Record<typeof result.code, number> = {
      NOT_FOUND_IN_MIDTRANS: 404,
      STILL_PENDING: 400,
      OWNERSHIP_VIOLATION: 404,
      RPC_ERROR: 500,
      MIDTRANS_UNREACHABLE: 502,
    };
    return NextResponse.json(
      { success: false, message: result.message, data: null },
      { status: statusMap[result.code] }
    );
  }

  if (result.alreadyProcessed) {
    return NextResponse.json({
      success: true,
      message: "Coin sudah berhasil ditambahkan ke akun kamu!",
      data: null,
    });
  }

  return NextResponse.json({
    success: true,
    message: result.status === "paid"
      ? "Coin berhasil ditambahkan ke akun kamu!"
      : "Pembayaran gagal. Coin tidak ditambahkan.",
    data: { transaction: result.transaction },
  });
}
