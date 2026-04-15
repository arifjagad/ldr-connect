import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/game/tod/session/[code]
 * Ambil detail sesi berdasarkan session_code
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const supabase = await createClient();

  // Validate session
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthenticated", data: null },
      { status: 401 }
    );
  }

  const { code } = await params;

  const { data: session, error } = await supabase
    .from("game_sessions")
    .select("*")
    .eq("session_code", code.toUpperCase())
    .single();

  if (error || !session) {
    return NextResponse.json(
      { success: false, message: "Sesi tidak ditemukan", data: null },
      { status: 404 }
    );
  }

  // Pastikan user adalah bagian dari sesi
  if (session.host_user_id !== user.id && session.partner_user_id !== user.id) {
    return NextResponse.json(
      { success: false, message: "Kamu tidak memiliki akses ke sesi ini", data: null },
      { status: 403 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "OK",
    data: { session },
  });
}
