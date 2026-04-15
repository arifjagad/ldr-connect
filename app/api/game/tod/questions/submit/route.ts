import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/game/tod/questions/submit
 * User mengajukan pertanyaan kustom untuk pasangan mereka.
 * source = 'user', is_active = false (butuh approval admin)
 *
 * Body: { type: "truth"|"dare", category: string, question: string }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthenticated", data: null },
      { status: 401 }
    );
  }

  // Parse body
  let body: { type?: string; category?: string; question?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Request body tidak valid", data: null },
      { status: 400 }
    );
  }

  const { type, category, question } = body;

  if (!type || !["truth", "dare"].includes(type)) {
    return NextResponse.json(
      { success: false, message: "type harus 'truth' atau 'dare'", data: null },
      { status: 422 }
    );
  }
  if (!category?.trim()) {
    return NextResponse.json(
      { success: false, message: "category wajib diisi", data: null },
      { status: 422 }
    );
  }
  if (!question?.trim() || question.trim().length < 10) {
    return NextResponse.json(
      { success: false, message: "Pertanyaan minimal 10 karakter", data: null },
      { status: 422 }
    );
  }

  // Pastikan user sudah linked
  const { data: profile } = await supabase
    .from("users")
    .select("partner_id, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "linked" || !profile.partner_id) {
    return NextResponse.json(
      { success: false, message: "Kamu belum terhubung dengan partner", data: null },
      { status: 400 }
    );
  }

  const coupleId = user.id < profile.partner_id ? user.id : profile.partner_id;

  // Insert via service client (RLS insert policy hanya untuk user client dengan couple_id, tapi
  // kita pakai service client untuk konsistensi dan agar bisa bypass jika ada edge case)
  const serviceClient = createServiceClient();
  const { data: inserted, error } = await serviceClient
    .from("game_tod_questions")
    .insert({
      couple_id: coupleId,
      type,
      category: category.trim(),
      question: question.trim(),
      source: "user",
      is_active: false,  // menunggu approval admin
      created_by: user.id,
    })
    .select("id, type, category, question, source, is_active, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message, data: null },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Pertanyaan berhasil dikirim! Menunggu review admin.",
    data: { question: inserted },
  });
}
