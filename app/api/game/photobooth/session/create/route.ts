import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createDailyRoom } from "@/lib/daily";
import { checkRateLimit } from "@/lib/rate-limit";
import { broadcastGameInvite } from "@/lib/broadcast-invite";
import { sendPushToUser } from "@/lib/push";
import type { PhotoboothGameState, PhotoboothTemplate } from "@/lib/types";
import { generateSessionCode } from "@/lib/crypto-utils";

/**
 * POST /api/game/photobooth/session/create
 * Buat sesi baru game Photobooth (3 coin)
 * Body: { template_id?: number } (opsional, bisa dipilih di awal atau di room)
 */
export async function POST(request: NextRequest) {
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
    endpoint: "photobooth:session:create",
    maxRequests: 3,
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

  let body: { template_id?: number } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const serviceClient = createServiceClient();

  // Ambil pengaturan game
  const { data: settings } = await serviceClient
    .from("game_settings")
    .select("coin_cost, expires_in_minutes")
    .eq("game_type", "photobooth")
    .single();
  const coinCost = settings?.coin_cost ?? 3;
  const gameDurationMinutes = (settings as { expires_in_minutes?: number } | null)?.expires_in_minutes ?? 30;

  // Cari template jika diberikan template_id atau ambil default template pertama
  let selectedTemplate: PhotoboothTemplate | null = null;
  if (body.template_id) {
    const { data: tmpl } = await serviceClient
      .from("game_photobooth_templates")
      .select("*")
      .eq("id", body.template_id)
      .eq("is_active", true)
      .single();
    if (tmpl) selectedTemplate = tmpl;
  }

  if (!selectedTemplate) {
    const { data: tmpl } = await serviceClient
      .from("game_photobooth_templates")
      .select("*")
      .eq("is_active", true)
      .order("id", { ascending: true })
      .limit(1)
      .single();
    if (tmpl) selectedTemplate = tmpl;
  }

  const initialGameState: PhotoboothGameState = {
    template_id: selectedTemplate?.id ?? null,
    phase: selectedTemplate ? "ready" : "selecting_template",
    current_slot: 1,
    countdown_started_at: null,
    photos: {},
    retakes_left: 3,
  };

  const sessionCode = generateSessionCode(12);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 menit menunggu partner

  // Catatan: auto-expire sesi lama milik couple ini sekarang ditangani DI
  // DALAM RPC create_game_session (dengan advisory lock + refund yang benar
  // untuk sesi 'waiting' — lihat migration 038). Jangan tambahkan UPDATE
  // manual di sini lagi karena akan melewati refund dan race dengan lock RPC.

  // Buat Daily.co room
  await createDailyRoom(sessionCode, 10 + gameDurationMinutes);

  const { data: rpcData, error: rpcError } = await serviceClient.rpc("create_game_session", {
    p_host_user_id: user.id,
    p_session_code: sessionCode,
    p_game_type: "photobooth",
    p_questions: [],
    p_coin_cost: coinCost,
    p_expires_at: expiresAt,
    p_board_config: selectedTemplate ? { template: selectedTemplate } : {},
    p_game_state: initialGameState,
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
        { success: false, message: "Masih ada sesi game aktif yang sedang berjalan", data: null },
        { status: 409 }
      );
    if (msg.includes("INSUFFICIENT_COINS"))
      return NextResponse.json(
        { success: false, message: "Saldo coin tidak cukup", data: null },
        { status: 400 }
      );
    return NextResponse.json(
      { success: false, message: msg || "Gagal membuat sesi photobooth", data: null },
      { status: 500 }
    );
  }

  // Broadcast invite ke partner via Realtime
  broadcastGameInvite({
    hostUserId: user.id,
    partnerId: profile.partner_id,
    sessionCode,
    gameType: "photobooth",
  });

  // Push notification ke partner
  sendPushToUser(profile.partner_id, {
    title: "Ayo Foto Bareng! 📸",
    body: "Partner mengajakmu ke Virtual Photobooth. Tap untuk foto bersama!",
    url: `/dashboard/games/photobooth?join=${sessionCode}`,
    tag: `game-invite-${sessionCode}`,
  }).catch((e) => console.error("[push] photobooth invite failed:", e));

  return NextResponse.json({
    success: true,
    message: "Sesi Photobooth berhasil dibuat!",
    data: { session },
  });
}
