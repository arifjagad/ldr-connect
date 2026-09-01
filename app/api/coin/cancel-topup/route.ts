import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/coin/cancel-topup
 * Batalkan transaksi topup coin yang berstatus 'pending'
 * Body: { transaction_id: number }
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

  const { data, error } = await serviceClient.rpc("cancel_topup_transaction", {
    p_transaction_id: transaction_id,
    p_user_id: user.id,
  });

  if (error) {
    console.error("[cancel-topup] RPC error:", error.message);
    return NextResponse.json(
      { success: false, message: "Gagal membatalkan transaksi", data: null },
      { status: 500 }
    );
  }

  const result = data as { success: boolean; message: string };
  if (!result.success) {
    return NextResponse.json(
      { success: false, message: result.message, data: null },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    message: result.message,
    data: null,
  });
}
