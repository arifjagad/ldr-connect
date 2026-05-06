import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { DareDerbyGameState } from "@/lib/types";

/**
 * POST /api/game/dare-derby/session/[code]/dare/skip
 * Loser skip dare (dengan konsekuensi) — delegasi ke RPC skip_dare_derby_dare
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
  const serviceClient = createServiceClient();

  const { data: newState, error: rpcError } = await serviceClient.rpc("skip_dare_derby_dare", {
    p_session_code: code.toUpperCase(),
    p_user_id: user.id,
  });

  if (rpcError) {
    const msg = rpcError.message ?? "";
    if (msg.includes("SESSION_EXPIRED"))
      return NextResponse.json({ success: false, message: "Waktu sesi sudah habis", data: null }, { status: 410 });
    if (msg.includes("SESSION_NOT_FOUND"))
      return NextResponse.json({ success: false, message: "Sesi tidak ditemukan", data: null }, { status: 404 });
    if (msg.includes("WRONG_PHASE"))
      return NextResponse.json({ success: false, message: "Bukan fase dare saat ini", data: null }, { status: 400 });
    if (msg.includes("NOT_THE_LOSER"))
      return NextResponse.json({ success: false, message: "Hanya yang kalah yang bisa skip dare", data: null }, { status: 403 });
    if (msg.includes("DARE_NOT_SKIPPABLE"))
      return NextResponse.json({ success: false, message: "Dare tidak bisa di-skip", data: null }, { status: 400 });
    if (msg.includes("NOT_IN_SESSION"))
      return NextResponse.json({ success: false, message: "Kamu bukan peserta sesi ini", data: null }, { status: 403 });
    return NextResponse.json({ success: false, message: "Gagal skip dare", data: null }, { status: 500 });
  }

  const gs = newState as DareDerbyGameState;
  const skipCount = gs.skip_counts?.[gs.forfeit_by === "host" ? "host" : "partner"] ?? 0;
  const message = gs.phase === "game_over" ? "Game berakhir karena forfeit!" : `Dare di-skip (${skipCount}x)`;
  return NextResponse.json({ success: true, message, data: { game_state: gs } });
}
