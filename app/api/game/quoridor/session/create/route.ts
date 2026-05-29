import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createDailyRoom } from "@/lib/daily";
import { checkRateLimit } from "@/lib/rate-limit";
import { broadcastGameInvite } from "@/lib/broadcast-invite";
import { sendPushToUser } from "@/lib/push";
import type { QuoridorGameState } from "@/lib/types";

/** State awal: host di baris 0 kolom 4, partner di baris 8 kolom 4 */
const initialGameState: QuoridorGameState = {
  host_pos:     { r: 0, c: 4 },
  partner_pos:  { r: 8, c: 4 },
  walls:        [],
  walls_left:   { host: 10, partner: 10 },
  current_turn: "host",
  winner:       null,
  last_action:  null,
};

/**
 * POST /api/game/quoridor/session/create
 * Buat sesi baru game Quoridor
 */
export async function POST(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthenticated", data: null },
      { status: 401 }
    );
  }

  // Rate limit: 3 create sesi per 15 menit per user
  const rateLimitResponse = await checkRateLimit(user.id, {
    endpoint:      "quoridor:session:create",
    maxRequests:   3,
    windowMinutes: 15,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const { data: profile } = await supabase
    .from("users")
    .select("status, partner_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "linked" || !profile.partner_id) {
    return NextResponse.json(
      { success: false, message: "Kamu belum terhubung dengan partner", data: null },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();

  // Ambil pengaturan game
  const { data: settings } = await serviceClient
    .from("game_settings")
    .select("coin_cost, expires_in_minutes")
    .eq("game_type", "quoridor")
    .single();
  const coinCost           = settings?.coin_cost ?? 3;
  const gameDurationMinutes = (settings as { expires_in_minutes?: number } | null)?.expires_in_minutes ?? 30;

  // Generate session code (12 karakter acak)
  const sessionCode = Array.from({ length: 12 }, () =>
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]
  ).join("");

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 menit menunggu partner

  // Auto-expire sesi lama yang sudah lewat waktunya
  await serviceClient
    .from("game_sessions")
    .update({ status: "expired" })
    .or(`host_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .in("status", ["waiting", "playing"])
    .lt("expires_at", new Date().toISOString());

  // Buat Daily.co room sebelum sesi — sama seperti snake-ladder & dare-derby
  await createDailyRoom(sessionCode, 10 + gameDurationMinutes);

  const { data: rpcData, error: rpcError } = await serviceClient.rpc("create_game_session", {
    p_host_user_id: user.id,
    p_session_code: sessionCode,
    p_game_type:    "quoridor",
    p_questions:    [],
    p_coin_cost:    coinCost,
    p_expires_at:   expiresAt,
    p_board_config: {},
    p_game_state:   initialGameState,
  });

  const session = Array.isArray(rpcData) ? rpcData[0] ?? null : rpcData;

  if (rpcError) {
    const msg = rpcError.message ?? "";
    if (msg.includes("NO_PARTNER"))
      return NextResponse.json(
        { success: false, message: "Kamu belum terhubung dengan partner", data: null },
        { status: 400 }
      );
    if (msg.includes("ACTIVE_SESSION"))
      return NextResponse.json(
        { success: false, message: "Masih ada sesi aktif", data: null },
        { status: 409 }
      );
    if (msg.includes("INSUFFICIENT_COINS"))
      return NextResponse.json(
        { success: false, message: "Saldo coin tidak cukup", data: null },
        { status: 400 }
      );
    return NextResponse.json(
      { success: false, message: msg || "Gagal membuat sesi", data: null },
      { status: 500 }
    );
  }

  // Broadcast invite ke partner via Realtime
  broadcastGameInvite({
    hostUserId:  user.id,
    partnerId:   profile.partner_id,
    sessionCode,
    gameType:    "quoridor",
  });

  // Push notification ke partner (bahkan saat tab ditutup)
  sendPushToUser(profile.partner_id, {
    title: "Kamu diajak main! ♟️",
    body:  "Partner mengajakmu bermain Quoridor. Tap untuk bergabung!",
    url:   `/dashboard/games/quoridor?join=${sessionCode}`,
    tag:   `game-invite-${sessionCode}`,
  }).catch((e) => console.error("[push] quoridor invite failed:", e));

  return NextResponse.json({
    success: true,
    message: "Sesi berhasil dibuat!",
    data:    { session },
  });
}
