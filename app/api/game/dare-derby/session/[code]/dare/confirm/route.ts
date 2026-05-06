import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { DareDerbyGameState } from "@/lib/types";

/**
 * POST /api/game/dare-derby/session/[code]/dare/confirm
 * Winner konfirmasi dare — delegasi ke RPC confirm_dare_derby_dare (atomic)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated", data: null }, { status: 401 });
  }

  let body: { confirmed?: boolean } = {};
  try { body = await request.json(); } catch { /* ok */ }

  if (typeof body.confirmed !== "boolean") {
    return NextResponse.json({ success: false, message: "Field 'confirmed' (boolean) diperlukan", data: null }, { status: 400 });
  }

  const { code } = await params;
  const serviceClient = createServiceClient();

  const { data: newState, error: rpcError } = await serviceClient.rpc("confirm_dare_derby_dare", {
    p_session_code: code.toUpperCase(),
    p_user_id:      user.id,
    p_confirmed:    body.confirmed,
  });

  if (rpcError) {
    const msg = rpcError.message ?? "";
    if (msg.includes("SESSION_EXPIRED"))
      return NextResponse.json({ success: false, message: "Waktu sesi sudah habis", data: null }, { status: 410 });
    if (msg.includes("SESSION_NOT_FOUND"))
      return NextResponse.json({ success: false, message: "Sesi tidak ditemukan", data: null }, { status: 404 });
    if (msg.includes("WRONG_PHASE"))
      return NextResponse.json({ success: false, message: "Bukan fase konfirmasi dare", data: null }, { status: 400 });
    if (msg.includes("DARE_NOT_AWAITING"))
      return NextResponse.json({ success: false, message: "Dare belum ditandai selesai oleh yang kalah", data: null }, { status: 400 });
    if (msg.includes("CANNOT_CONFIRM_OWN"))
      return NextResponse.json({ success: false, message: "Kamu tidak bisa konfirmasi dare milikmu sendiri", data: null }, { status: 403 });
    if (msg.includes("NOT_IN_SESSION"))
      return NextResponse.json({ success: false, message: "Kamu bukan peserta sesi ini", data: null }, { status: 403 });
    return NextResponse.json({ success: false, message: "Gagal update state", data: null }, { status: 500 });
  }

  const gs = newState as DareDerbyGameState;
  const message = gs.phase === "game_over" ? "Game selesai!" : body.confirmed ? "Dare dikonfirmasi!" : "Dare dikembalikan";
  return NextResponse.json({ success: true, message, data: { game_state: gs } });
}
