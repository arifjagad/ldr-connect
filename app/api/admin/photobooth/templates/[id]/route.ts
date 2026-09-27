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

/**
 * PATCH /api/admin/photobooth/templates/[id]
 * Update template photobooth (nama, slot koordinat, image_url, is_active, dll)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, message: "Forbidden", data: null }, { status: 403 });
  }

  const { id } = await params;
  const templateId = Number(id);
  if (!Number.isInteger(templateId) || templateId <= 0) {
    return NextResponse.json({ success: false, message: "ID template tidak valid", data: null }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Body tidak valid", data: null }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.description === "string" || body.description === null) updates.description = body.description;
  if (typeof body.image_url === "string") updates.image_url = body.image_url.trim();
  if (typeof body.thumbnail_url === "string" || body.thumbnail_url === null) updates.thumbnail_url = body.thumbnail_url;
  if (typeof body.aspect_ratio === "string") updates.aspect_ratio = body.aspect_ratio.trim();
  if (typeof body.canvas_width === "number") updates.canvas_width = body.canvas_width;
  if (typeof body.canvas_height === "number") updates.canvas_height = body.canvas_height;
  if (typeof body.photo_count === "number") updates.photo_count = body.photo_count;
  if (Array.isArray(body.slots)) updates.slots = body.slots;
  if (typeof body.is_active === "boolean") updates.is_active = body.is_active;

  const supabase = createServiceClient();
  const { data: template, error } = await supabase
    .from("game_photobooth_templates")
    .update(updates)
    .eq("id", templateId)
    .select()
    .single();

  if (error || !template) {
    return NextResponse.json(
      { success: false, message: error?.message || "Gagal memperbarui template", data: null },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Template berhasil diperbarui",
    data: { template },
  });
}

/**
 * DELETE /api/admin/photobooth/templates/[id]
 * Hapus template photobooth
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, message: "Forbidden", data: null }, { status: 403 });
  }

  const { id } = await params;
  const templateId = Number(id);
  if (!Number.isInteger(templateId) || templateId <= 0) {
    return NextResponse.json({ success: false, message: "ID template tidak valid", data: null }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("game_photobooth_templates")
    .delete()
    .eq("id", templateId);

  if (error) {
    return NextResponse.json({ success: false, message: error.message, data: null }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: "Template berhasil dihapus",
    data: null,
  });
}
