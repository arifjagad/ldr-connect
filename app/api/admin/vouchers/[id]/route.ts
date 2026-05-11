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

/** PATCH /api/admin/vouchers/[id] — toggle is_active atau update field lain */
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

  let body: { is_active?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Body tidak valid", data: null }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.is_active === "boolean") updates.is_active = body.is_active;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, message: "Tidak ada field yang diupdate", data: null }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("vouchers")
    .update(updates)
    .eq("id", voucherId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, message: error.message, data: null }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Voucher diperbarui", data: { voucher: data } });
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
