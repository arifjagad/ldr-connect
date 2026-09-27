import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/game/photobooth/templates
 * Mengambil daftar template frame photobooth aktif
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

  const { data: templates, error } = await supabase
    .from("game_photobooth_templates")
    .select("*")
    .eq("is_active", true)
    .order("id", { ascending: true });

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message || "Gagal memuat template", data: null },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Daftar template berhasil dimuat",
    data: { templates: templates ?? [] },
  });
}
