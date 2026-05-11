import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  score:      z.number().int().min(0),
  time_taken: z.number().int().min(0),
  metadata:   z.record(z.string(), z.unknown()).optional().default({}),
});

/**
 * POST /api/game/dare-derby/session/[code]/submit
 * Kirim skor mini-game — delegasi ke RPC submit_dare_derby_round (atomic)
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

  const { code } = await params;
  const serviceClient = createServiceClient();

  const { data: result, error: rpcError } = await serviceClient.rpc("submit_dare_derby_round", {
    p_session_code: code.toUpperCase(),
    p_user_id:      user.id,
    p_score:        body.score,
    p_time_taken:   body.time_taken,
    p_metadata:     body.metadata,
  });

  if (rpcError) {
    const msg = rpcError.message ?? "";
    if (msg.includes("SESSION_EXPIRED"))
      return NextResponse.json({ success: false, message: "Waktu sesi sudah habis", data: null }, { status: 410 });
    if (msg.includes("SESSION_NOT_FOUND"))
      return NextResponse.json({ success: false, message: "Sesi tidak ditemukan", data: null }, { status: 404 });
    if (msg.includes("SESSION_NOT_ACTIVE"))
      return NextResponse.json({ success: false, message: "Sesi tidak aktif", data: null }, { status: 400 });
    if (msg.includes("WRONG_PHASE"))
      return NextResponse.json({ success: false, message: "Bukan fase mini-game saat ini", data: null }, { status: 400 });
    if (msg.includes("NOT_IN_SESSION"))
      return NextResponse.json({ success: false, message: "Kamu bukan peserta sesi ini", data: null }, { status: 403 });
    if (msg.includes("ALREADY_SUBMITTED"))
      return NextResponse.json({ success: false, message: "Kamu sudah mengirim skor untuk ronde ini", data: null }, { status: 409 });
    return NextResponse.json({ success: false, message: "Gagal submit skor", data: null }, { status: 500 });
  }

  const data = result as {
    waiting_for_partner: boolean;
    round_result?: unknown;
    game_state: unknown;
  };

  return NextResponse.json({
    success: true,
    message: data.waiting_for_partner ? "Menunggu partner..." : "Ronde selesai!",
    data,
  });
}
