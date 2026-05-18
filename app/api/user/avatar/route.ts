import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const BUCKET = "avatars";
const MAX_SIZE_MB = 3;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * POST /api/user/avatar
 * Upload foto profil ke Supabase Storage (bucket: avatars)
 * Body: FormData { file: File }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ success: false, message: "File tidak ditemukan" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ success: false, message: "Format file harus JPG, PNG, WebP, atau GIF" }, { status: 400 });
  }

  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return NextResponse.json({ success: false, message: `Ukuran file maksimal ${MAX_SIZE_MB}MB` }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // Konversi file ke buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Path: avatars/{user_id}.{ext}  — overwrite file lama
  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const filePath = `${user.id}.${ext}`;

  // Upload ke Supabase Storage (upsert = overwrite)
  const { error: uploadError } = await serviceClient.storage
    .from(BUCKET)
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("[avatar] upload error:", uploadError.message);
    return NextResponse.json({ success: false, message: `Upload gagal: ${uploadError.message}` }, { status: 500 });
  }

  // Ambil public URL
  const { data: urlData } = serviceClient.storage
    .from(BUCKET)
    .getPublicUrl(filePath);

  const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`; // cache bust

  // Simpan URL ke tabel users
  const { error: updateError } = await serviceClient
    .from("users")
    .update({ avatar_url: urlData.publicUrl })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ success: false, message: `Gagal simpan URL: ${updateError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Avatar berhasil diupload", data: { avatar_url: avatarUrl } });
}

/**
 * DELETE /api/user/avatar
 * Hapus foto profil, reset ke inisial
 */
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated" }, { status: 401 });
  }

  const serviceClient = createServiceClient();

  // Hapus semua file avatar user (semua extension)
  const extensions = ["jpg", "png", "webp", "gif"];
  const filesToRemove = extensions.map((ext) => `${user.id}.${ext}`);
  await serviceClient.storage.from("avatars").remove(filesToRemove);

  // Reset avatar_url di DB
  await serviceClient.from("users").update({ avatar_url: null }).eq("id", user.id);

  return NextResponse.json({ success: true, message: "Avatar dihapus" });
}
