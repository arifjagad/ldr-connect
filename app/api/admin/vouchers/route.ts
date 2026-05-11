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

const VOUCHER_CODE_RE = /^[A-Z0-9\-]{3,50}$/;

/** GET /api/admin/vouchers — daftar semua voucher + jumlah redemption */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, message: "Forbidden", data: null }, { status: 403 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("vouchers")
    .select(`
      id, code, coin_value, max_uses, uses_remaining,
      valid_from, valid_until, is_active, created_at,
      voucher_redemptions ( count )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, message: error.message, data: null }, { status: 500 });
  }

  const vouchers = (data ?? []).map((v) => ({
    ...v,
    redemption_count: (v.voucher_redemptions as unknown as { count: number }[])?.[0]?.count ?? 0,
    voucher_redemptions: undefined,
  }));

  return NextResponse.json({ success: true, message: "OK", data: { vouchers } });
}

/** POST /api/admin/vouchers — buat voucher baru */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, message: "Forbidden", data: null }, { status: 403 });
  }

  let body: {
    code?: string;
    type?: string;
    max_uses?: number;
    valid_until?: string | null;
    valid_from?: string | null;
    // coin_credit
    coin_value?: number;
    // topup_discount
    discount_type?: string;
    discount_value?: number;
    max_discount?: number | null;
    min_purchase?: number | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Body tidak valid", data: null }, { status: 400 });
  }

  const code = (body.code ?? "").trim().toUpperCase();
  if (!code || !VOUCHER_CODE_RE.test(code)) {
    return NextResponse.json(
      { success: false, message: "Kode voucher harus 3-50 karakter (huruf, angka, tanda hubung)", data: null },
      { status: 400 }
    );
  }

  const type = body.type ?? "coin_credit";
  if (!["coin_credit", "topup_discount"].includes(type)) {
    return NextResponse.json({ success: false, message: "Tipe voucher tidak valid", data: null }, { status: 400 });
  }

  const maxUses = Number(body.max_uses ?? 1);
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 10000) {
    return NextResponse.json(
      { success: false, message: "Maks penggunaan harus antara 1–10000", data: null },
      { status: 400 }
    );
  }

  const record: Record<string, unknown> = {
    code,
    type,
    max_uses: maxUses,
    uses_remaining: maxUses,
    valid_from: body.valid_from ?? new Date().toISOString(),
    valid_until: body.valid_until ?? null,
    is_active: true,
    created_by: admin.id,
  };

  if (type === "coin_credit") {
    const coinValue = Number(body.coin_value);
    if (!Number.isInteger(coinValue) || coinValue < 1 || coinValue > 1000) {
      return NextResponse.json(
        { success: false, message: "Nilai coin harus antara 1–1000", data: null },
        { status: 400 }
      );
    }
    record.coin_value = coinValue;
  } else {
    const discountType = body.discount_type;
    if (!["percentage", "fixed"].includes(discountType ?? "")) {
      return NextResponse.json({ success: false, message: "Tipe diskon tidak valid", data: null }, { status: 400 });
    }
    const discountValue = Number(body.discount_value);
    if (!discountValue || discountValue < 1) {
      return NextResponse.json({ success: false, message: "Nilai diskon tidak valid", data: null }, { status: 400 });
    }
    if (discountType === "percentage" && discountValue > 100) {
      return NextResponse.json({ success: false, message: "Persentase diskon maksimal 100%", data: null }, { status: 400 });
    }
    record.discount_type  = discountType;
    record.discount_value = discountValue;
    record.max_discount   = body.max_discount ? Number(body.max_discount) : null;
    record.min_purchase   = body.min_purchase ? Number(body.min_purchase) : null;
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("vouchers")
    .insert(record)
    .select()
    .single();

  if (error) {
    const msg = error.code === "23505" ? "Kode voucher sudah digunakan" : error.message;
    return NextResponse.json({ success: false, message: msg, data: null }, { status: 400 });
  }

  return NextResponse.json({ success: true, message: "Voucher berhasil dibuat", data: { voucher: data } });
}
