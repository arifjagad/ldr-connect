import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createDailyRoom } from "@/lib/daily";

/**
 * POST /api/game/tod/session/create
 * Buat sesi Truth or Dare baru
 * - Potong coin dari wallet host (atomic via RPC)
 * - Generate pertanyaan dari pool
 *
 * Body: { categories?: string[], question_count?: number }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Validate session
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthenticated", data: null },
      { status: 401 }
    );
  }

  // Parse body
  let body: { categories?: string[]; question_count?: number } = {};
  try {
    body = await request.json();
  } catch {
    // body optional — pakai default
  }

  const questionCount = Math.min(Math.max(body.question_count ?? 10, 5), 20);
  const selectedCategories: string[] = body.categories ?? [];

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

  // Ambil game settings untuk ToD (coin_cost)
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

  // Shuffle + ambil sejumlah questionCount
  const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, questionCount);

  // Build questions JSONB array
  const questions = selected.map((q, i) => ({
    order: i + 1,
    type: q.type,
    question: q.question,
    category: q.category,
    source: q.source,
    answered_by: null,
    is_completed: false,
  }));

  // Generate session code (12 char alphanumeric)
  const sessionCode = Array.from({ length: 12 }, () =>
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]
  ).join("");

  // expires_at = 10 menit dari sekarang (waiting lobby)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Cleanup: hapus sesi stale (status playing/waiting tapi expires_at sudah lewat)
  // Ini agar create_game_session RPC tidak gagal karena ada sesi lama yang tidak di-expire
  await serviceClient
    .from("game_sessions")
    .update({ status: "expired" })
    .or(`host_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .in("status", ["waiting", "playing"])
    .lt("expires_at", new Date().toISOString());

  // Buat Daily.co room (best effort — jika gagal, game tetap jalan tanpa video)
  const gameDurationMinutes = (settings as { expires_in_minutes?: number } | null)?.expires_in_minutes ?? 10;
  await createDailyRoom(sessionCode, 10 + gameDurationMinutes); // 10 menit waiting + durasi game

  // Buat sesi + potong coin (atomic via RPC)
  const { data: rpcData, error: rpcError } = await serviceClient.rpc("create_game_session", {
    p_host_user_id: user.id,
    p_session_code: sessionCode,
    p_game_type: "tod",
    p_questions: questions,
    p_coin_cost: coinCost,
    p_expires_at: expiresAt,
  });

  // supabase-js v2 wraps composite-type RPC results in an array
  // PostgreSQL RETURNS composite mengembalikan object kosong (semua null) saat tidak ada data
  // — cek .id untuk memastikan sesi valid
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

  // Guard: jika RPC sukses tapi session null (tidak terduga)
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Gagal membuat sesi: data tidak tersedia", data: null },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Sesi berhasil dibuat! Bagikan kode ke partner.",
    data: { session },
  });
}
