import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { TodQuestion } from "@/lib/types";

/**
 * POST /api/game/tod/session/[code]/next
 * Ambil pertanyaan berikutnya yang belum selesai dari sesi aktif
 * Tidak mengubah state — hanya baca
 */
export async function POST(
  _request: NextRequest,
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

  const { code } = await params;

  const { data: session, error } = await supabase
    .from("game_sessions")
    .select("*")
    .eq("session_code", code.toUpperCase())
    .single();

  if (error || !session) {
    return NextResponse.json(
      { success: false, message: "Sesi tidak ditemukan", data: null },
      { status: 404 }
    );
  }

  // Validasi user dalam sesi
  if (session.host_user_id !== user.id && session.partner_user_id !== user.id) {
    return NextResponse.json(
      { success: false, message: "Kamu tidak memiliki akses ke sesi ini", data: null },
      { status: 403 }
    );
  }

  if (session.status !== "playing") {
    return NextResponse.json(
      { success: false, message: "Sesi tidak dalam status bermain", data: null },
      { status: 409 }
    );
  }

  const questions = (session.questions ?? []) as TodQuestion[];
  const nextQuestion = questions.find((q) => !q.is_completed) ?? null;
  const isFinished = nextQuestion === null;

  return NextResponse.json({
    success: true,
    message: isFinished ? "Semua pertanyaan selesai!" : "OK",
    data: {
      next_question: nextQuestion,
      is_finished: isFinished,
    },
  });
}
