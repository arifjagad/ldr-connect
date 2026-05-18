import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

/**
 * POST /api/game/snake-ladder/session/join
 * Partner bergabung ke sesi snake_ladder di game_sessions
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated", data: null }, { status: 401 });
  }

  let body: { code?: string } = {};
  try { body = await request.json(); } catch { /* ok */ }

  const code = (body.code ?? "").toUpperCase().trim();
  if (!code) {
    return NextResponse.json({ success: false, message: "Kode sesi diperlukan", data: null }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  const { data: settings } = await serviceClient
    .from("game_settings")
    .select("expires_in_minutes")
    .eq("game_type", "snake_ladder")
    .single();
  const gameDurationMinutes = (settings as { expires_in_minutes?: number } | null)?.expires_in_minutes ?? 20;
  const expiresAt = new Date(Date.now() + gameDurationMinutes * 60 * 1000).toISOString();

  // Pakai join_game_session RPC yang sudah ada (beroperasi di game_sessions)
  const { data: rpcData, error: rpcError } = await serviceClient.rpc("join_game_session", {
    p_partner_user_id: user.id,
    p_session_code: code,
  });

  const session = Array.isArray(rpcData) ? rpcData[0] ?? null : rpcData;

  if (rpcError || !session) {
    const msg = rpcError?.message ?? "";
    if (msg.includes("SESSION_NOT_FOUND") || msg.includes("NOT_FOUND"))
      return NextResponse.json({ success: false, message: "Kode tidak valid atau sesi sudah tidak tersedia", data: null }, { status: 404 });
    if (msg.includes("CANNOT_JOIN_OWN"))
      return NextResponse.json({ success: false, message: "Kamu tidak bisa join sesimu sendiri", data: null }, { status: 400 });
    if (msg.includes("INSUFFICIENT_COINS"))
      return NextResponse.json({ success: false, message: "Saldo coin tidak cukup untuk bergabung", data: null }, { status: 400 });
    return NextResponse.json({ success: false, message: msg || "Gagal bergabung", data: null }, { status: 500 });
  }

  // Verifikasi ini memang sesi snake_ladder
  if (session.game_type && session.game_type !== "snake_ladder") {
    return NextResponse.json({ success: false, message: "Kode ini bukan untuk game Ular Tangga", data: null }, { status: 400 });
  }

  // Update expires_at secara manual karena join_game_session sudah set dari game_settings tod
  await serviceClient
    .from("game_sessions")
    .update({ expires_at: expiresAt, updated_at: new Date().toISOString() })
    .eq("session_code", code);

  const { data: updatedSession } = await serviceClient
    .from("game_sessions")
    .select("*")
    .eq("session_code", code)
    .single();

  // Kirim push notification ke host
  const hostId = (updatedSession ?? session)?.host_user_id;
  if (hostId) {
    sendPushToUser(hostId, {
      title: "Partner sudah bergabung! 🎲",
      body: "Ular Tangga siap dimulai. Tap untuk main!",
      url: "/dashboard/games/snake-ladder",
      tag: `game-join-${code}`,
    }).catch((e) => console.error("[push] snake-ladder join failed:", e));
  }

  return NextResponse.json({ success: true, message: "Berhasil bergabung!", data: { session: updatedSession ?? session } });
}

