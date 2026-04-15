import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/coin/balance
 * Ambil saldo wallet user yang sedang login
 */
export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthenticated", data: null },
      { status: 401 }
    );
  }

  const { data: wallet, error } = await supabase
    .from("wallets")
    .select("user_id, balance, updated_at")
    .eq("user_id", user.id)
    .single();

  if (error || !wallet) {
    return NextResponse.json(
      { success: false, message: "Wallet tidak ditemukan", data: null },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "OK",
    data: { wallet },
  });
}
