import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return profile?.is_admin ? user : null;
}

/** GET /api/admin/vouchers/[id]/redemptions — daftar user yang meredeem voucher ini */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, message: "Forbidden", data: null }, { status: 403 });
  }

  const { id } = await params;
  const voucherId = Number(id);
  if (!Number.isInteger(voucherId) || voucherId <= 0) {
    return NextResponse.json({ success: false, message: "ID tidak valid", data: null }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("voucher_redemptions")
    .select(`
      id, redeemed_at,
      users ( id, name, email, couple_code, avatar_url )
    `)
    .eq("voucher_id", voucherId)
    .order("redeemed_at", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, message: error.message, data: null }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "OK", data: { redemptions: data ?? [] } });
}
