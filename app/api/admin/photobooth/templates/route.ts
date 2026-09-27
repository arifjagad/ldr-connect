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
 * GET /api/admin/photobooth/templates
 * Ambil semua template photobooth (termasuk yang non-aktif) + setting game
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, message: "Forbidden", data: null }, { status: 403 });
  }

  const supabase = createServiceClient();

  const [templatesRes, settingRes] = await Promise.all([
    supabase
      .from("game_photobooth_templates")
      .select("*")
      .order("id", { ascending: true }),
    supabase
      .from("game_settings")
      .select("*")
      .eq("game_type", "photobooth")
      .maybeSingle(),
  ]);

  if (templatesRes.error) {
    return NextResponse.json(
      { success: false, message: templatesRes.error.message, data: null },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "OK",
    data: {
      templates: templatesRes.data ?? [],
      setting: settingRes.data ?? null,
    },
  });
}

/**
 * POST /api/admin/photobooth/templates
 * Tambah template photobooth baru
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, message: "Forbidden", data: null }, { status: 403 });
  }

  let body: {
    name?: string;
    description?: string;
    image_url?: string;
    thumbnail_url?: string;
    aspect_ratio?: string;
    canvas_width?: number;
    canvas_height?: number;
    photo_count?: number;
    slots?: unknown;
    is_active?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Body tidak valid", data: null }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ success: false, message: "Nama template wajib diisi", data: null }, { status: 400 });
  }

  const imageUrl = (body.image_url ?? "").trim();
  if (!imageUrl) {
    return NextResponse.json({ success: false, message: "URL Frame PNG wajib diisi", data: null }, { status: 400 });
  }

  const photoCount = Number(body.photo_count ?? 3);
  if (!Number.isInteger(photoCount) || photoCount <= 0) {
    return NextResponse.json({ success: false, message: "Jumlah foto harus angka positif", data: null }, { status: 400 });
  }

  const canvasWidth = Number(body.canvas_width ?? 600);
  const canvasHeight = Number(body.canvas_height ?? 1800);

  const slots = Array.isArray(body.slots) ? body.slots : [];

  const supabase = createServiceClient();
  const { data: template, error } = await supabase
    .from("game_photobooth_templates")
    .insert({
      name,
      description: body.description?.trim() || null,
      image_url: imageUrl,
      thumbnail_url: body.thumbnail_url?.trim() || null,
      aspect_ratio: body.aspect_ratio?.trim() || "2:6",
      canvas_width: canvasWidth,
      canvas_height: canvasHeight,
      photo_count: photoCount,
      slots,
      is_active: body.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, message: error.message, data: null }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: "Template photobooth berhasil dibuat",
    data: { template },
  });
}
