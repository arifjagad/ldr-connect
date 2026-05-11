import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createDailyRoom } from "@/lib/daily";
import { checkRateLimit } from "@/lib/rate-limit";
import { broadcastGameInvite } from "@/lib/broadcast-invite";

const bodySchema = z.object({
  categories:     z.array(z.string().min(1).max(50)).max(10).default([]),
  question_count: z.number().int().min(5).max(20).default(10),
});

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
    endpoint:      "tod:session:create",
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

  const { question_count: questionCount, categories: selectedCategories } = body;

  // Cek user sudah linked dengan partner
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

  const serviceClient = await createServiceClient();
  const { data: settings } = await serviceClient
    .from("game_settings")
    .select("coin_cost, expires_in_minutes")
    .eq("game_type", "tod")
    .single();

  const coinCost = settings?.coin_cost ?? 5;

  // Ambil pertanyaan dari pool
  let questionsQuery = serviceClient
    .from("game_tod_questions")
    .select("id, type, question, category, source")
    .eq("is_active", true)
    .or(`couple_id.is.null,couple_id.eq.${user.id}`);

  if (selectedCategories.length > 0) {
    questionsQuery = questionsQuery.in("category", selectedCategories);
  }

  const { data: allQuestions, error: qError } = await questionsQuery;

  if (qError || !allQuestions || allQuestions.length === 0) {
    return NextResponse.json(
      { success: false, message: "Tidak ada pertanyaan tersedia untuk kategori yang dipilih", data: null },
      { status: 400 }
    );
  }

  const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, questionCount);

  const questions = selected.map((q, i) => ({
    order:        i + 1,
    type:         q.type,
    question:     q.question,
    category:     q.category,
    source:       q.source,
    answered_by:  null,
    is_completed: false,
  }));

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

  const gameDurationMinutes = (settings as { expires_in_minutes?: number } | null)?.expires_in_minutes ?? 10;
  await createDailyRoom(sessionCode, 10 + gameDurationMinutes);

  const { data: rpcData, error: rpcError } = await serviceClient.rpc("create_game_session", {
    p_host_user_id: user.id,
    p_session_code: sessionCode,
    p_game_type:    "tod",
    p_questions:    questions,
    p_coin_cost:    coinCost,
    p_expires_at:   expiresAt,
  });

  const raw = Array.isArray(rpcData) ? rpcData[0] ?? null : rpcData;
  const session = raw?.id ? raw : null;

  if (rpcError) {
    const msg = rpcError.message ?? "";
    if (msg.includes("NO_PARTNER")) {
      return NextResponse.json(
        { success: false, message: "Kamu belum terhubung dengan partner", data: null },
        { status: 400 }
      );
    }
    if (msg.includes("ACTIVE_SESSION")) {
      return NextResponse.json(
        { success: false, message: "Kamu atau partner masih punya sesi yang aktif", data: null },
        { status: 409 }
      );
    }
    if (msg.includes("INSUFFICIENT_COINS")) {
      return NextResponse.json(
        { success: false, message: "Saldo coin tidak cukup untuk membuat sesi", data: null },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: msg || "Gagal membuat sesi", data: null },
      { status: 500 }
    );
  }

  if (!session) {
    return NextResponse.json(
      { success: false, message: "Gagal membuat sesi: data tidak tersedia", data: null },
      { status: 500 }
    );
  }

  broadcastGameInvite({
    hostUserId: user.id,
    partnerId: profile.partner_id,
    sessionCode,
    gameType: "tod",
  });

  return NextResponse.json({
    success: true,
    message: "Sesi berhasil dibuat! Bagikan kode ke partner.",
    data: { session },
  });
}
