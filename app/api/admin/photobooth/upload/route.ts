import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const BUCKET = "photobooth";
const MAX_SIZE_MB = 10;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

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
 * POST /api/admin/photobooth/upload
 * Upload gambar frame PNG transparan / thumbnail ke Supabase Storage (bucket: photobooth)
 * Body: FormData { file: File, folder?: "frames" | "thumbnails" }
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const folder = (formData.get("folder") as string) || "frames";

  if (!file) {
    return NextResponse.json({ success: false, message: "File tidak ditemukan" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ success: false, message: "Format file harus PNG, JPG, WebP, atau SVG" }, { status: 400 });
  }

  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return NextResponse.json({ success: false, message: `Ukuran file maksimal ${MAX_SIZE_MB}MB` }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // Konversi file ke buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Generate unique filename: {folder}/{timestamp}-{random}.{ext}
  const ext = file.name.split(".").pop() || "png";
  const cleanExt = ext.toLowerCase().replace("jpeg", "jpg");
  const randomStr = Math.random().toString(36).substring(2, 8);
  const filePath = `${folder}/${Date.now()}-${randomStr}.${cleanExt}`;

  // Upload ke Supabase Storage
  const { error: uploadError } = await serviceClient.storage
    .from(BUCKET)
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("[photobooth-upload] Error:", uploadError.message);
    return NextResponse.json({ success: false, message: `Upload gagal: ${uploadError.message}` }, { status: 500 });
  }

  // Dapatkan URL publik file
  const { data: urlData } = serviceClient.storage
    .from(BUCKET)
    .getPublicUrl(filePath);

  return NextResponse.json({
    success: true,
    message: "File frame berhasil diupload ke Supabase Storage",
    data: {
      url: urlData.publicUrl,
      file_path: filePath,
    },
  });
}
