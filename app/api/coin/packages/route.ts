import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/coin/packages
 * Ambil daftar paket coin yang aktif
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

  const { data: packages, error } = await supabase
    .from("coin_packages")
    .select("id, name, coin_amount, price, is_active")
    .eq("is_active", true)
    .order("price", { ascending: true });

  if (error) {
    return NextResponse.json(
      { success: false, message: "Gagal memuat paket coin", data: null },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "OK",
    data: { packages: packages ?? [] },
  });
}
