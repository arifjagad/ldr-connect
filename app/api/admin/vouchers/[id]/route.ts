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

/** PATCH /api/admin/vouchers/[id] — update voucher (is_active atau edit field lain) */
export async function PATCH(
  request: NextRequest,
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

  let body: {
    code?: string;
    type?: string;
    max_uses?: number;
    valid_until?: string | null;
    valid_from?: string | null;
    coin_value?: number;
    discount_type?: string;
    discount_value?: number;
    max_discount?: number | null;
    min_purchase?: number | null;
    is_active?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Body tidak valid", data: null }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Ambil data voucher eksisting
  const { data: existingVoucher, error: getErr } = await supabase
    .from("vouchers")
    .select("id, max_uses, uses_remaining, type")
    .eq("id", voucherId)
    .single();

  if (getErr || !existingVoucher) {
    return NextResponse.json({ success: false, message: "Voucher tidak ditemukan", data: null }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};

  // is_active
  if (typeof body.is_active === "boolean") {
    updates.is_active = body.is_active;
  }

  // code
  if (typeof body.code === "string") {
    const code = body.code.trim().toUpperCase();
    if (!VOUCHER_CODE_RE.test(code)) {
      return NextResponse.json(
        { success: false, message: "Kode voucher harus 3-50 karakter (huruf, angka, tanda hubung)", data: null },
        { status: 400 }
      );
    }
    updates.code = code;
  }

  // type
  if (body.type) {
    if (!["coin_credit", "topup_discount"].includes(body.type)) {
      return NextResponse.json({ success: false, message: "Tipe voucher tidak valid", data: null }, { status: 400 });
    }
    updates.type = body.type;
  }

  // max_uses & uses_remaining adjustment
  if (body.max_uses !== undefined) {
    const maxUses = Number(body.max_uses);
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 10000) {
      return NextResponse.json(
        { success: false, message: "Maks penggunaan harus antara 1–10000", data: null },
        { status: 400 }
      );
    }
    const alreadyUsed = existingVoucher.max_uses - existingVoucher.uses_remaining;
    updates.max_uses = maxUses;
    updates.uses_remaining = Math.max(0, maxUses - alreadyUsed);
  }

  // valid_until & valid_from
  if ("valid_until" in body) {
    updates.valid_until = body.valid_until ?? null;
  }
  if ("valid_from" in body) {
    updates.valid_from = body.valid_from ?? null;
  }

  // Type specific updates
  const effectiveType = body.type ?? existingVoucher.type;
  if (effectiveType === "coin_credit") {
    if (body.coin_value !== undefined) {
      const coinValue = Number(body.coin_value);
      if (!Number.isInteger(coinValue) || coinValue < 1 || coinValue > 1000) {
        return NextResponse.json(
          { success: false, message: "Nilai coin harus antara 1–1000", data: null },
          { status: 400 }
        );
      }
      updates.coin_value = coinValue;
    }
    // Bersihkan field discount jika berubah tipe
    if (body.type === "coin_credit") {
      updates.discount_type = null;
      updates.discount_value = null;
      updates.max_discount = null;
      updates.min_purchase = null;
    }
  } else if (effectiveType === "topup_discount") {
    if (body.discount_type !== undefined) {
      if (!["percentage", "fixed"].includes(body.discount_type ?? "")) {
        return NextResponse.json({ success: false, message: "Tipe diskon tidak valid", data: null }, { status: 400 });
      }
      updates.discount_type = body.discount_type;
    }

    if (body.discount_value !== undefined) {
      const discountValue = Number(body.discount_value);
      if (!discountValue || discountValue < 1) {
        return NextResponse.json({ success: false, message: "Nilai diskon tidak valid", data: null }, { status: 400 });
      }
      if (body.discount_type === "percentage" && discountValue > 100) {
        return NextResponse.json({ success: false, message: "Persentase diskon maksimal 100%", data: null }, { status: 400 });
      }
      updates.discount_value = discountValue;
    }

    if ("max_discount" in body) {
      updates.max_discount = body.max_discount ? Number(body.max_discount) : null;
    }
    if ("min_purchase" in body) {
      updates.min_purchase = body.min_purchase ? Number(body.min_purchase) : null;
    }

    // Bersihkan coin_value jika berubah tipe
    if (body.type === "topup_discount") {
      updates.coin_value = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, message: "Tidak ada field yang diupdate", data: null }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("vouchers")
    .update(updates)
    .eq("id", voucherId)
    .select()
    .single();

  if (error) {
    const msg = error.code === "23505" ? "Kode voucher sudah digunakan" : error.message;
    return NextResponse.json({ success: false, message: msg, data: null }, { status: 400 });
  }

  return NextResponse.json({ success: true, message: "Voucher berhasil diperbarui", data: { voucher: data } });
}

/** DELETE /api/admin/vouchers/[id] — hapus voucher */
export async function DELETE(
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
  const { error } = await supabase
    .from("vouchers")
    .delete()
    .eq("id", voucherId);

  if (error) {
    return NextResponse.json({ success: false, message: error.message, data: null }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Voucher dihapus", data: null });
}
