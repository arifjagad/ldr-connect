import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { SnakeGameState } from "@/lib/types";

/**
 * POST /api/game/snake-ladder/session/[code]/surrender
 * Pemain menyerah — lawan dinyatakan menang.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthenticated", data: null },
      { status: 401 }
    );
  }

  const { code } = await params;
  const upperCode = code.toUpperCase();
  const serviceClient = createServiceClient();

  const { data: session, error: sessError } = await serviceClient
    .from("game_sessions")
    .select("id, session_code, status, host_user_id, partner_user_id, game_state")
    .eq("session_code", upperCode)
    .eq("game_type", "snake_ladder")
    .single();

  if (sessError || !session) {
    return NextResponse.json(
      { success: false, message: "Sesi tidak ditemukan", data: null },
      { status: 404 }
    );
  }

  if (session.host_user_id !== user.id && session.partner_user_id !== user.id) {
    return NextResponse.json(
      { success: false, message: "Kamu bukan peserta sesi ini", data: null },
      { status: 403 }
    );
  }

  if (session.status !== "playing") {
    return NextResponse.json(
      { success: false, message: "Sesi tidak sedang berlangsung", data: null },
      { status: 400 }
    );
  }

  const myRole = session.host_user_id === user.id ? "host" : "partner";
  const winner = myRole === "host" ? "partner" : "host";

  const currentGs = (session.game_state ?? {}) as SnakeGameState;
  const newGameState: SnakeGameState = {
    ...currentGs,
    winner,
    current_turn: myRole,
  };

  const { error: updateError } = await serviceClient
    .from("game_sessions")
    .update({
      status: "completed",
      game_state: newGameState,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .eq("status", "playing");

  if (updateError) {
    return NextResponse.json(
      { success: false, message: "Gagal menyerah, coba lagi", data: null },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Kamu menyerah. Partner dinyatakan menang.",
    data: { game_state: newGameState },
  });
}
