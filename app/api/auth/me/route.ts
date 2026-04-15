import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/auth/me
 * Ambil profil user yang sedang login beserta saldo wallet
 */
export async function GET() {
  const supabase = await createClient();

  // Validasi session
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthenticated", data: null },
      { status: 401 }
    );
  }

  // Ambil profile + wallet dalam satu query
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select(`
      id,
      name,
      email,
      couple_code,
      partner_id,
      status,
      is_admin,
      created_at,
      wallets (balance)
    `)
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { success: false, message: "Profile tidak ditemukan", data: null },
      { status: 404 }
    );
  }

  // Flatten wallet balance ke dalam profile
  const wallets = profile.wallets as { balance: number } | { balance: number }[] | null;
  const walletBalance = Array.isArray(wallets)
    ? (wallets[0]?.balance ?? 0)
    : (wallets?.balance ?? 0);

  return NextResponse.json({
    success: true,
    message: "OK",
    data: {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      couple_code: profile.couple_code,
      partner_id: profile.partner_id,
      status: profile.status,
      is_admin: profile.is_admin ?? false,
      wallet_balance: walletBalance,
      created_at: profile.created_at,
    },
  });
}
