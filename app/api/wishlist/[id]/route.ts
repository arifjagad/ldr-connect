import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/wishlist/[id]
 * Edit title / description / category dari item milik sendiri
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated", data: null }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { title, description, category } = body as {
    title?: string;
    description?: string;
    category?: string;
  };

  const validCategories = ["virtual", "offline", "dream", "gift", "other"];
  const updates: Record<string, unknown> = {};
  if (title?.trim()) updates.title = title.trim();
  if (description !== undefined) updates.description = description?.trim() || null;
  if (category && validCategories.includes(category)) updates.category = category;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, message: "Tidak ada data yang diubah", data: null }, { status: 422 });
  }

  const serviceClient = createServiceClient();

  const { data, error } = await serviceClient
    .from("wishlists")
    .update(updates)
    .eq("id", id)
    .eq("created_by", user.id) // hanya owner
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, message: error.message, data: null }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Wishlist diperbarui!", data });
}

/**
 * DELETE /api/wishlist/[id]
 * Hapus item milik sendiri
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated", data: null }, { status: 401 });
  }

  const serviceClient = createServiceClient();

  const { error } = await serviceClient
    .from("wishlists")
    .delete()
    .eq("id", id)
    .eq("created_by", user.id);

  if (error) {
    return NextResponse.json({ success: false, message: error.message, data: null }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Wishlist dihapus.", data: null });
}
