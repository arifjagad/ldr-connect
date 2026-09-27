import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { deleteDailyRoom } from "@/lib/daily";
import type { TodQuestion } from "@/lib/types";

/**
 * POST /api/game/tod/session/[code]/next
 * Lewati (skip) pertanyaan yang sedang aktif — PERSIST ke DB via RPC
 * answer_tod_question(p_skip=true) supaya progres tidak desync antar-partner
 * dan sesi bisa transisi ke status 'completed' kalau semua kartu di-skip.
 *
 * Body: { question_order: number } — order kartu yang di-skip (current card)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const supabase = await createClient();

  // Validate session
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthenticated", data: null },
      { status: 401 }
    );
  }

  let body: { question_order?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Request body tidak valid", data: null },
      { status: 400 }
    );
  }

  const { question_order } = body;
  if (typeof question_order !== "number" || question_order < 1) {
    return NextResponse.json(
      { success: false, message: "question_order wajib diisi dan harus angka positif", data: null },
      { status: 422 }
    );
  }

  const { code } = await params;
  const sessionCode = code.toUpperCase();
  const serviceClient = await createServiceClient();

  const { data: result, error: rpcError } = await serviceClient.rpc("answer_tod_question", {
    p_user_id: user.id,
    p_session_code: sessionCode,
    p_question_order: question_order,
    p_skip: true,
  });

  if (rpcError) {
    const msg = rpcError.message ?? "";
    if (msg.includes("SESSION_NOT_FOUND")) {
      return NextResponse.json(
        { success: false, message: "Sesi tidak ditemukan", data: null },
        { status: 404 }
      );
    }
    if (msg.includes("SESSION_NOT_PLAYING")) {
      return NextResponse.json(
        { success: false, message: "Sesi tidak dalam status bermain", data: null },
        { status: 409 }
      );
    }
    if (msg.includes("NOT_IN_SESSION")) {
      return NextResponse.json(
        { success: false, message: "Kamu tidak memiliki akses ke sesi ini", data: null },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { success: false, message: msg || "Gagal melewati pertanyaan", data: null },
      { status: 500 }
    );
  }

  // Hapus Daily.co room jika semua pertanyaan selesai/di-skip (best effort)
  if (result?.is_finished) {
    deleteDailyRoom(sessionCode);
  }

  const nextQuestion = (result?.next_question ?? null) as TodQuestion | null;
  const isFinished = !!result?.is_finished;

  return NextResponse.json({
    success: true,
    message: isFinished ? "Semua pertanyaan selesai!" : "OK",
    data: {
      next_question: nextQuestion,
      is_finished: isFinished,
    },
  });
}
