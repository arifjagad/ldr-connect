import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/coin/validate-voucher?code=XXX&amount=XXXXX
 * Preview diskon voucher tanpa side effect (tidak decrement uses_remaining).
 * Dipanggil saat user mengetik kode voucher di checkout topup.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthorized", data: null },
      { status: 401 }
    );
  }

  const code   = (request.nextUrl.searchParams.get("code") ?? "").trim().toUpperCase();
  const amount = parseInt(request.nextUrl.searchParams.get("amount") ?? "0", 10);

  if (!code || code.length < 3) {
    return NextResponse.json(
      { success: false, message: "Kode voucher tidak valid", data: null },
      { status: 400 }
    );
  }
  if (!amount || amount <= 0) {
    return NextResponse.json(
      { success: false, message: "Jumlah pembelian tidak valid", data: null },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient.rpc("validate_topup_voucher", {
    p_user_id:         user.id,
    p_code:            code,
    p_purchase_amount: amount,
  });

  if (error) {
    console.error("[validate-voucher] RPC error:", error.message);
    return NextResponse.json(
      { success: false, message: "Gagal memvalidasi voucher", data: null },
      { status: 500 }
    );
  }

  const result = data as {
    success: boolean;
    message: string;
    discount_amount?: number;
    final_amount?: number;
    discount_type?: string;
    discount_value?: number;
    max_discount?: number;
    uses_remaining?: number;
  };

  return NextResponse.json({
    success: result.success,
    message: result.message,
    data: result.success ? {
      discount_amount: result.discount_amount,
      final_amount:    result.final_amount,
      discount_type:   result.discount_type,
      discount_value:  result.discount_value,
      max_discount:    result.max_discount,
      uses_remaining:  result.uses_remaining,
    } : null,
  });
}
