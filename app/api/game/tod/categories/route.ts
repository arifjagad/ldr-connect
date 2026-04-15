import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/game/tod/categories
 * Ambil daftar kategori pertanyaan ToD yang tersedia
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

  // Ambil distinct category dari pertanyaan yang aktif
  const { data, error } = await supabase
    .from("game_tod_questions")
    .select("category")
    .eq("is_active", true);

  if (error) {
    return NextResponse.json(
      { success: false, message: "Gagal memuat kategori", data: null },
      { status: 500 }
    );
  }

  const categories = [...new Set((data ?? []).map((r) => r.category))].sort();

  return NextResponse.json({
    success: true,
    message: "OK",
    data: { categories },
  });
}
