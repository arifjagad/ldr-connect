import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  title: z.string().trim().min(1, "Judul tidak boleh kosong").max(255, "Judul maksimal 255 karakter").optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD").optional(),
  notes: z.string().trim().max(2000, "Catatan maksimal 2000 karakter").nullable().optional(),
  is_active: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/anniversaries/[id]
 * Edit title/date/notes/is_active. Diri sendiri ATAU partner boleh
 * (konsisten dengan RLS `anniversaries_update_couple`) — kolom `user_id`
 * tidak bisa diubah lewat endpoint ini sama sekali (dan diblokir juga di
 * level DB oleh trigger `protect_anniversary_owner`, migration 037).
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

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.date !== undefined) updates.date = body.date;
  if (body.notes !== undefined) updates.notes = body.notes || null;
  if (body.is_active !== undefined) updates.is_active = body.is_active;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, message: "Tidak ada data yang diubah", data: null }, { status: 422 });
  }

  // Anon client (bukan service role) — RLS `anniversaries_update_couple`
  // yang menentukan apakah baris ini boleh diupdate (diri sendiri/partner).
  // Trigger protect_anniversary_owner di DB menolak jika ada percobaan
  // mengubah user_id (tidak relevan di sini karena kita tidak pernah
  // mengirim user_id di `updates`).
  const { data, error } = await supabase
    .from("anniversaries")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { success: false, message: error?.message || "Momen tidak ditemukan atau tidak memiliki akses", data: null },
      { status: error ? 500 : 404 }
    );
  }

  return NextResponse.json({ success: true, message: "Momen berhasil diperbarui!", data });
}

/**
 * DELETE /api/anniversaries/[id]
 * Hapus momen — HANYA pemilik asli (bukan partner), konsisten dengan
 * RLS `anniversaries_delete_own` (USING (user_id = auth.uid())).
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated", data: null }, { status: 401 });
  }

  // Cek dulu row-nya ada & filter eksplisit by user_id supaya error message
  // ke client jelas ("bukan milikmu") — RLS tetap jadi pertahanan utama.
  const { data: existing } = await supabase
    .from("anniversaries")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ success: false, message: "Momen tidak ditemukan", data: null }, { status: 404 });
  }
  if (existing.user_id !== user.id) {
    return NextResponse.json(
      { success: false, message: "Hanya pemilik yang dapat menghapus momen ini", data: null },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("anniversaries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ success: false, message: error.message, data: null }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Momen berhasil dihapus.", data: null });
}
