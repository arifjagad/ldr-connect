import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/coin/check-voucher?code=XXX
 * Cek voucher tanpa side effect — untuk preview di UI sebelum user klik Redeem/Topup.
 * Mengembalikan info lengkap voucher (type, value, syarat) agar client bisa render UI yang sesuai.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthorized", data: null }, { status: 401 });
  }

  const code = (request.nextUrl.searchParams.get("code") ?? "").trim().toUpperCase();
  if (!code || code.length < 3) {
    return NextResponse.json({ success: false, message: "Kode voucher tidak valid", data: null }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: voucher } = await service
    .from("vouchers")
    .select("id, type, code, coin_value, discount_type, discount_value, max_discount, min_purchase, is_active, valid_from, valid_until, uses_remaining")
    .eq("code", code)
    .single();

  if (!voucher) {
    return NextResponse.json({ success: false, message: "Voucher tidak ditemukan", data: null });
  }

  if (!voucher.is_active) {
    return NextResponse.json({ success: false, message: "Voucher tidak aktif", data: null });
  }

  const now = new Date();
  if (voucher.valid_from && now < new Date(voucher.valid_from)) {
    return NextResponse.json({ success: false, message: "Voucher belum berlaku", data: null });
  }
  if (voucher.valid_until && now > new Date(voucher.valid_until)) {
    return NextResponse.json({ success: false, message: "Voucher sudah kadaluarsa", data: null });
  }
  if (voucher.uses_remaining <= 0) {
    return NextResponse.json({ success: false, message: "Voucher sudah habis digunakan", data: null });
  }

  // Cek apakah user sudah pernah memakai voucher ini
  const { data: redemption } = await service
    .from("voucher_redemptions")
    .select("id")
    .eq("voucher_id", voucher.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (redemption) {
    return NextResponse.json({ success: false, message: "Kamu sudah pernah menggunakan voucher ini", data: null });
  }

  return NextResponse.json({
    success: true,
    message: "Voucher valid",
    data: {
      type:           voucher.type,
      code:           voucher.code,
      coin_value:     voucher.coin_value,
      discount_type:  voucher.discount_type,
      discount_value: voucher.discount_value,
      max_discount:   voucher.max_discount,
      min_purchase:   voucher.min_purchase,
      uses_remaining: voucher.uses_remaining,
    },
  });
}
