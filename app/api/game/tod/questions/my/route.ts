import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/game/tod/questions/my
 * Ambil pertanyaan kustom milik pasangan ini (aktif + pending).
 * Menggunakan service client agar bisa baca is_active = false (pending).
 */
export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthenticated", data: null },
      { status: 401 }
    );
  }

  // Ambil partner_id untuk hitung couple_id
  const { data: profile } = await supabase
    .from("users")
    .select("partner_id, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "linked" || !profile.partner_id) {
    return NextResponse.json({
      success: true,
      message: "Belum linked dengan partner",
      data: { questions: [] },
    });
  }

  // couple_id = LEAST(uid, partner_id) — UUID lexicographic comparison, sama seperti SQL
  const resolvedCoupleId = user.id < profile.partner_id ? user.id : profile.partner_id;

  const serviceClient = createServiceClient();
  const { data: questions, error } = await serviceClient
    .from("game_tod_questions")
    .select("id, couple_id, type, category, question, source, is_active, created_by, created_at")
    .eq("couple_id", resolvedCoupleId)
    .in("source", ["user", "ai"])
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message, data: null },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "OK",
    data: { questions: questions ?? [] },
  });
}
