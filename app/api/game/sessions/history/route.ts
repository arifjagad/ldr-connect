import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/game/sessions/history
 * Ambil riwayat sesi game yang sudah selesai untuk user (sebagai host maupun partner)
 * Returns: { sessions: GameSession[] }
 */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthenticated", data: null },
      { status: 401 }
    );
  }

  const serviceClient = createServiceClient();

  const now = new Date().toISOString();

  // Sertakan sesi yang sudah selesai/dibatalkan, PLUS sesi 'playing' yang expires_at-nya
  // sudah lewat (timer habis tapi status belum sempat diupdate ke 'expired')
  const { data: sessions, error } = await serviceClient
    .from("game_sessions")
    .select(
      "id, session_code, game_type, status, questions, game_state, coin_deducted, partner_joined_at, expires_at, created_at, host_user_id, partner_user_id"
    )
    .or(`host_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .or(`status.in.(completed,expired,cancelled),and(status.eq.playing,expires_at.lt.${now})`)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message, data: null },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Riwayat permainan",
    data: { sessions: sessions ?? [] },
  });
}
