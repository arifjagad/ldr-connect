import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { SnakeGameState, SnakeBoardConfig, LastRoll, PendingChallenge } from "@/lib/types";

/**
 * POST /api/game/snake/session/[code]/roll
 * Lempar dadu — update game_state di game_sessions
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
    return NextResponse.json({ success: false, message: "Sesi tidak ditemukan atau tidak aktif", data: null }, { status: 404 });
  }

  const gs = session.game_state as SnakeGameState;
  const bc = session.board_config as SnakeBoardConfig;

  const isHost = session.host_user_id === user.id;
  const isPartner = session.partner_user_id === user.id;
  if (!isHost && !isPartner) {
    return NextResponse.json({ success: false, message: "Kamu bukan peserta sesi ini", data: null }, { status: 403 });
  }

  const myRole: "host" | "partner" = isHost ? "host" : "partner";

  if (gs.current_turn !== myRole) {
    return NextResponse.json({ success: false, message: "Bukan giliranmu", data: null }, { status: 400 });
  }
  if (gs.pending_challenge) {
    return NextResponse.json({ success: false, message: "Selesaikan tantangan dulu", data: null }, { status: 400 });
  }

  const dice = Math.floor(Math.random() * 6) + 1;
  const currentPos = myRole === "host" ? gs.host_position : gs.partner_position;

  let landed = currentPos + dice;
  let bounced = false;
  if (landed > 100) {
    landed = 100 - (landed - 100);
    bounced = true;
  }

  const snake = bc.snakes.find((s) => s.from === landed);
  const ladder = bc.ladders.find((l) => l.from === landed);

  let finalPos = landed;
  let snakeFrom: number | null = null;
  let ladderFrom: number | null = null;

  if (snake) {
    finalPos = snake.to;
    snakeFrom = snake.from;
  } else if (ladder) {
    finalPos = ladder.to;
    ladderFrom = ladder.from;
  }

  const lastRoll: LastRoll = {
    player: myRole,
    dice,
    from: currentPos,
    landed,
    final: finalPos,
    snake_from: snakeFrom,
    ladder_from: ladderFrom,
    bounced,
  };

  const newState: SnakeGameState = { ...gs, last_roll: lastRoll };
  if (myRole === "host") newState.host_position = finalPos;
  else newState.partner_position = finalPos;

  // Menang: tepat 100
  if (finalPos === 100) {
    newState.winner = myRole;
    newState.current_turn = myRole;

    await serviceClient
      .from("game_sessions")
      .update({ game_state: newState, status: "completed", updated_at: new Date().toISOString() })
      .eq("session_code", code.toUpperCase());

    return NextResponse.json({ success: true, message: "Menang!", data: { game_state: newState } });
  }

  // Challenge di posisi akhir
  const challengeAtFinal = bc.challenges.find((c) => c.square === finalPos);

  if (challengeAtFinal) {
    const pending: PendingChallenge = {
      player: myRole,
      square: finalPos,
      type: challengeAtFinal.type,
      question: challengeAtFinal.question,
      category: challengeAtFinal.category,
      roll_again: dice === 6 && !bounced,
    };
    newState.pending_challenge = pending;
  } else if (dice === 6 && !bounced) {
    newState.current_turn = myRole;
    newState.pending_challenge = null;
  } else {
    newState.current_turn = myRole === "host" ? "partner" : "host";
    newState.pending_challenge = null;
  }

  const { error: updateError } = await serviceClient
    .from("game_sessions")
    .update({ game_state: newState, updated_at: new Date().toISOString() })
    .eq("session_code", code.toUpperCase());

  if (updateError) {
    return NextResponse.json({ success: false, message: "Gagal update state", data: null }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "ok", data: { game_state: newState } });
}
