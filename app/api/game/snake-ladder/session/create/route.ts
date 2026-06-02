import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createDailyRoom } from "@/lib/daily";
import { checkRateLimit } from "@/lib/rate-limit";
import { broadcastGameInvite } from "@/lib/broadcast-invite";
import { sendPushToUser } from "@/lib/push";
import type { SnakeBoardConfig, ChallengeCell, SnakeGameState } from "@/lib/types";
import { generateSessionCode, cryptoShuffle, cryptoRandInt } from "@/lib/crypto-utils";

const customQuestionSchema = z.object({
  type:     z.enum(["truth", "dare"]),
  question: z.string().min(5).max(500),
  category: z.string().min(1).max(50),
});

const bodySchema = z.object({
  custom_questions: z.array(customQuestionSchema).length(15).optional(),
});

/** Generate board: 8 ular, 8 tangga, 15 kotak tantangan — semua random, tidak overlap */
function generateBoard(
  questions: Array<{ type: string; question: string; category: string }>
): SnakeBoardConfig {
  const occupied = new Set<number>([1, 100]);
  const rnd = (min: number, max: number) => cryptoRandInt(min, max);

  const snakes: SnakeBoardConfig["snakes"] = [];
  let tries = 0;
  while (snakes.length < 8 && tries < 2000) {
    tries++;
    const from = rnd(12, 99);
    const to = rnd(2, from - 3);
    if (!occupied.has(from) && !occupied.has(to)) {
      snakes.push({ from, to });
      occupied.add(from);
      occupied.add(to);
    }
  }

  const ladders: SnakeBoardConfig["ladders"] = [];
  tries = 0;
  while (ladders.length < 8 && tries < 2000) {
    tries++;
    const from = rnd(2, 88);
    const to = rnd(from + 3, Math.min(99, from + 40));
    if (!occupied.has(from) && !occupied.has(to)) {
      ladders.push({ from, to });
      occupied.add(from);
      occupied.add(to);
    }
  }

  const available: number[] = [];
  for (let i = 2; i <= 99; i++) {
    if (!occupied.has(i)) available.push(i);
  }
  const shuffledSquares = cryptoShuffle(available).slice(0, 15);
  const shuffledQs = cryptoShuffle(questions);

  const challenges: ChallengeCell[] = shuffledSquares.map((square, i) => ({
    square,
    type:     shuffledQs[i % shuffledQs.length].type as "truth" | "dare",
    question: shuffledQs[i % shuffledQs.length].question,
    category: shuffledQs[i % shuffledQs.length].category,
  }));

  return { snakes, ladders, challenges };
}

const initialGameState: SnakeGameState = {
  host_position:    0,
  partner_position: 0,
  current_turn:     "host",
  pending_challenge: null,
  last_roll:        null,
  winner:           null,
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated", data: null }, { status: 401 });
  }

  // Rate limit: 3 create sesi per 15 menit per user
  const rateLimitResponse = await checkRateLimit(user.id, {
    endpoint:      "snake:session:create",
    maxRequests:   3,
    windowMinutes: 15,
  });
  if (rateLimitResponse) return rateLimitResponse;

  // Validasi input dengan Zod
  let body: z.infer<typeof bodySchema>;
  try {
    const raw = await request.json().catch(() => ({}));
    body = bodySchema.parse(raw);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: e.issues[0].message, data: null },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Request tidak valid", data: null },
      { status: 400 }
    );
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

  const { data: settings } = await serviceClient
    .from("game_settings")
    .select("coin_cost, expires_in_minutes")
    .eq("game_type", "snake_ladder")
    .single();
  const coinCost = settings?.coin_cost ?? 5;
  const gameDurationMinutes = (settings as { expires_in_minutes?: number } | null)?.expires_in_minutes ?? 20;

  // Pilih pertanyaan
  let questions: Array<{ type: string; question: string; category: string }>;
  if (body.custom_questions && body.custom_questions.length >= 15) {
    questions = body.custom_questions.slice(0, 15);
  } else {
    const { data: pool } = await serviceClient
      .from("game_snake_questions")
      .select("type, question, category")
      .eq("is_active", true);
    if (!pool || pool.length === 0) {
      return NextResponse.json({ success: false, message: "Pool pertanyaan kosong", data: null }, { status: 400 });
    }
    questions = cryptoShuffle(pool).slice(0, 15);
  }

  const boardConfig = generateBoard(questions);

  const sessionCode = generateSessionCode(12);

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
    p_game_type:    "snake_ladder",
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
    gameType: "snake_ladder",
  });

  // Push notification ke partner — bahkan saat tab ditutup
  sendPushToUser(profile.partner_id, {
    title: "Kamu diajak main! 🎲",
    body: "Partner mengajakmu bermain Ular Tangga. Tap untuk bergabung!",
    url: `/dashboard/games/snake-ladder?join=${sessionCode}`,
    tag: `game-invite-${sessionCode}`,
  }).catch((e) => console.error("[push] snake-ladder invite failed:", e));

  return NextResponse.json({ success: true, message: "Sesi berhasil dibuat!", data: { session } });
}
