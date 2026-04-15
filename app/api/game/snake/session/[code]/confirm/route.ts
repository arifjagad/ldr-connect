import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { SnakeGameState } from "@/lib/types";

/**
 * POST /api/game/snake/session/[code]/confirm
 * Partner konfirmasi tantangan selesai — update game_state di game_sessions
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated", data: null }, { status: 401 });
  }

  const { code } = await params;
  const serviceClient = await createServiceClient();

  const { data: session, error: sessionError } = await serviceClient
    .from("game_sessions")
    .select("*")
    .eq("session_code", code.toUpperCase())
    .eq("game_type", "snake_ladder")
    .eq("status", "playing")
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ success: false, message: "Sesi tidak ditemukan", data: null }, { status: 404 });
  }

  const gs = session.game_state as SnakeGameState;

  if (!gs.pending_challenge) {
    return NextResponse.json({ success: false, message: "Tidak ada tantangan yang perlu dikonfirmasi", data: null }, { status: 400 });
  }

  const challenger = gs.pending_challenge.player;
  const challengerUserId = challenger === "host" ? session.host_user_id : session.partner_user_id;
  if (user.id === challengerUserId) {
    return NextResponse.json({ success: false, message: "Kamu tidak bisa mengkonfirmasi tantanganmu sendiri", data: null }, { status: 403 });
  }

  const rollAgain = gs.pending_challenge.roll_again;
  const nextTurn: "host" | "partner" = rollAgain
    ? challenger
    : challenger === "host" ? "partner" : "host";

  const newState: SnakeGameState = { ...gs, pending_challenge: null, current_turn: nextTurn };

  const { error: updateError } = await serviceClient
    .from("game_sessions")
    .update({ game_state: newState, updated_at: new Date().toISOString() })
    .eq("session_code", code.toUpperCase());

  if (updateError) {
    return NextResponse.json({ success: false, message: "Gagal update state", data: null }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Tantangan dikonfirmasi!", data: { game_state: newState } });
}
