import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createDailyRoom } from "@/lib/daily";
import { checkRateLimit } from "@/lib/rate-limit";
import { broadcastGameInvite } from "@/lib/broadcast-invite";
import { sendPushToUser } from "@/lib/push";
import type { DareDerbyBoardConfig, DareDerbyGameState } from "@/lib/types";

const bodySchema = z.object({
  total_rounds: z.union([z.literal(5), z.literal(7), z.literal(10)]),
  dare_level: z.enum(["sweet_only", "mixed", "full_chaos"]).default("mixed"),
  custom_dares: z.array(z.string().min(5).max(300)).max(20).optional(),
});

const COIN_COSTS: Record<number, number> = { 5: 3, 7: 4, 10: 6 };

/**
 * 🛠 DEBUG — Paksa semua ronde memakai satu mini-game tertentu.
 * Isi dengan ID game ("true_false", "tap_timing", dll.) untuk testing.
 * Kosongkan ("") untuk kembali ke urutan acak normal.
 */
const DEBUG_FORCE_MINIGAME = "number_order";

/**
 * POST /api/game/dare-derby/session/create
 * Host membuat sesi Dare Derby baru
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated", data: null }, { status: 401 });
  }

  const rateLimitResponse = await checkRateLimit(user.id, {
    endpoint: "dare_derby:session:create",
    maxRequests: 3,
    windowMinutes: 15,
  });
  if (rateLimitResponse) return rateLimitResponse;

  let body: z.infer<typeof bodySchema>;
  try {
    const raw = await request.json().catch(() => ({}));
    body = bodySchema.parse(raw);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ success: false, message: e.issues[0].message, data: null }, { status: 422 });
    }
    return NextResponse.json({ success: false, message: "Request tidak valid", data: null }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("status, partner_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "linked" || !profile.partner_id) {
    return NextResponse.json({ success: false, message: "Kamu belum terhubung dengan partner", data: null }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  const coinCost = COIN_COSTS[body.total_rounds] ?? 3;
  const gameDurationMinutes = 60;

  const { data: minigameSeq, error: seqError } = await serviceClient.rpc(
    "select_dare_derby_minigames",
    { p_total_rounds: body.total_rounds }
  );

  if (seqError || !minigameSeq) {
    return NextResponse.json({ success: false, message: "Gagal generate urutan mini-game", data: null }, { status: 500 });
  }

  // Pad sequence if RPC returned fewer games than rounds (happens when a category
  // has fewer unique games than the requested count — e.g. only 1 brain game).
  let sequence = minigameSeq as string[];
  if (sequence.length < body.total_rounds && sequence.length > 0) {
    const pool = [...sequence];
    while (sequence.length < body.total_rounds) {
      sequence.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    sequence = sequence.sort(() => Math.random() - 0.5);
  }

  // 🛠 DEBUG: override sequence jika DEBUG_FORCE_MINIGAME diisi
  if (DEBUG_FORCE_MINIGAME) {
    sequence = Array(body.total_rounds).fill(DEBUG_FORCE_MINIGAME);
  }

  const boardConfig: DareDerbyBoardConfig = {
    total_rounds: body.total_rounds,
    dare_level: body.dare_level,
    custom_dares: body.custom_dares ?? [],
    minigame_sequence: sequence,
  };

  const initialGameState: DareDerbyGameState = {
    phase: "lobby",
    current_round: 1,
    ready: { host: false, partner: false },
    round_submissions: { host: null, partner: null },
    skip_counts: { host: 0, partner: 0 },
    dare_counts: { host: 0, partner: 0 },
    is_replay_round: false,
    pending_bonus_for: null,
    last_round_result: null,
  };

  const sessionCode = Array.from({ length: 12 }, () =>
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]
  ).join("");

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await serviceClient
    .from("game_sessions")
    .update({ status: "expired" })
    .or(`host_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .in("status", ["waiting", "playing"])
    .lt("expires_at", new Date().toISOString());

  await createDailyRoom(sessionCode, 10 + gameDurationMinutes);

  const { data: rpcData, error: rpcError } = await serviceClient.rpc("create_game_session", {
    p_host_user_id: user.id,
    p_session_code: sessionCode,
    p_game_type:    "dare_derby",
    p_questions:    [],
    p_coin_cost:    coinCost,
    p_expires_at:   expiresAt,
    p_board_config: boardConfig,
    p_game_state:   initialGameState,
  });

  const session = Array.isArray(rpcData) ? rpcData[0] ?? null : rpcData;

  if (rpcError) {
    const msg = rpcError.message ?? "";
    if (msg.includes("NO_PARTNER"))
      return NextResponse.json({ success: false, message: "Kamu belum terhubung dengan partner", data: null }, { status: 400 });
    if (msg.includes("ACTIVE_SESSION"))
      return NextResponse.json({ success: false, message: "Masih ada sesi aktif", data: null }, { status: 409 });
    if (msg.includes("INSUFFICIENT_COINS"))
      return NextResponse.json({ success: false, message: "Saldo coin tidak cukup", data: null }, { status: 400 });
    return NextResponse.json({ success: false, message: msg || "Gagal membuat sesi", data: null }, { status: 500 });
  }

  broadcastGameInvite({
    hostUserId: user.id,
    partnerId: profile.partner_id,
    sessionCode,
    gameType: "dare_derby",
  });

  // Push notification ke partner — bahkan saat tab ditutup
  sendPushToUser(profile.partner_id, {
    title: "Kamu diajak main! 🏁",
    body: "Partner mengajakmu bermain Dare Derby. Tap untuk bergabung!",
    url: `/dashboard/games/dare-derby?join=${sessionCode}`,
    tag: `game-invite-${sessionCode}`,
  }).catch((e) => console.error("[push] dare-derby invite failed:", e));

  return NextResponse.json({ success: true, message: "Sesi berhasil dibuat!", data: { session } });
}
