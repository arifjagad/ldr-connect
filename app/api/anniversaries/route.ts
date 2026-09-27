import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

const postSchema = z.object({
  title: z.string().trim().min(1, "Judul tidak boleh kosong").max(255, "Judul maksimal 255 karakter"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  notes: z.string().trim().max(2000, "Catatan maksimal 2000 karakter").nullable().optional(),
});

/**
 * GET /api/anniversaries
 * Ambil semua anniversary milik couple (diri sendiri + partner).
 * RLS `anniversaries_select_couple` sudah membatasi baris yang boleh dibaca,
 * di sini pakai anon client (bukan service role) agar RLS tetap berlaku
 * sebagai defense-in-depth.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated", data: null }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("anniversaries")
    .select("*")
    .order("date", { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, message: error.message, data: null }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "OK", data: data ?? [] });
}

/**
 * POST /api/anniversaries
 * Buat anniversary baru milik diri sendiri.
 * Body: { title: string, date: "YYYY-MM-DD", notes?: string | null }
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated", data: null }, { status: 401 });
  }

  // Rate limiting: maks 20 anniversary per 10 menit per user — mencegah
  // spam entry (tiap create tidak trigger push, tapi tetap cegah flood tabel).
  const rateLimitResult = await checkRateLimit(user.id, {
    endpoint: "anniversaries/create",
    maxRequests: 20,
    windowMinutes: 10,
  });
  if (rateLimitResult) return rateLimitResult;

  let body: z.infer<typeof postSchema>;
  try {
    const raw = await req.json().catch(() => ({}));
    body = postSchema.parse(raw);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ success: false, message: e.issues[0].message, data: null }, { status: 422 });
    }
    return NextResponse.json({ success: false, message: "Request tidak valid", data: null }, { status: 400 });
  }

  const { title, date, notes } = body;

  // Insert via anon client (bukan service role) — RLS `anniversaries_insert_own`
  // sudah memastikan user_id = auth.uid(), jadi tidak perlu bypass RLS di sini.
  const { data, error } = await supabase
    .from("anniversaries")
    .insert({ user_id: user.id, title, date, notes: notes || null, is_active: true })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, message: error.message, data: null }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Momen berhasil disimpan!", data });
}
