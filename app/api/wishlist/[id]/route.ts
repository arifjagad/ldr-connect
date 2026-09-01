import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

const patchSchema = z.object({
  title:       z.string().min(1).max(200).trim().optional(),
  description: z.string().max(1000).trim().nullable().optional(),
  category:    z.enum(["virtual", "offline", "dream", "gift", "other"]).optional(),
});

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

  let body: z.infer<typeof patchSchema>;
  try {
    const raw = await req.json().catch(() => ({}));
    body = patchSchema.parse(raw);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ success: false, message: e.issues[0].message, data: null }, { status: 422 });
    }
    return NextResponse.json({ success: false, message: "Request tidak valid", data: null }, { status: 400 });
  }

  const { title, description, category } = body;

  const updates: Record<string, unknown> = {};
  if (title) updates.title = title;
  if (description !== undefined) updates.description = description ?? null;
  if (category) updates.category = category;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, message: "Tidak ada data yang diubah", data: null }, { status: 422 });
  }

  const serviceClient = createServiceClient();

  const { data: profile } = await serviceClient
    .from("users")
    .select("partner_id, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "linked" || !profile.partner_id) {
    return NextResponse.json({ success: false, message: "Kamu belum terhubung dengan partner", data: null }, { status: 400 });
  }

  const coupleId = user.id < profile.partner_id ? user.id : profile.partner_id;

  const { data, error } = await serviceClient
    .from("wishlists")
    .update(updates)
    .eq("id", id)
    .eq("created_by", user.id) // hanya owner
    .eq("couple_id", coupleId) // pastikan milik relasi aktif saat ini
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ success: false, message: error?.message || "Wishlist tidak ditemukan atau tidak memiliki akses", data: null }, { status: error ? 500 : 404 });
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

  const { data: profile } = await serviceClient
    .from("users")
    .select("partner_id, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "linked" || !profile.partner_id) {
    return NextResponse.json({ success: false, message: "Kamu belum terhubung dengan partner", data: null }, { status: 400 });
  }

  const coupleId = user.id < profile.partner_id ? user.id : profile.partner_id;

  const { error } = await serviceClient
    .from("wishlists")
    .delete()
    .eq("id", id)
    .eq("created_by", user.id)
    .eq("couple_id", coupleId);

  if (error) {
    return NextResponse.json({ success: false, message: error.message, data: null }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Wishlist dihapus.", data: null });
}
