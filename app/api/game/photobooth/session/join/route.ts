import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/game/photobooth/session/join
 * Partner bergabung ke sesi Photobooth
 * Body: { session_code: string }
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

  const rateLimitResponse = await checkRateLimit(user.id, {
    endpoint: "photobooth:session:join",
    maxRequests: 10,
    windowMinutes: 5,
  });
  if (rateLimitResponse) return rateLimitResponse;

  let body: { session_code?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Request body tidak valid", data: null },
      { status: 400 }
    );
  }

  const { session_code } = body;
  if (!session_code) {
    return NextResponse.json(
      { success: false, message: "session_code wajib diisi", data: null },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();

  const { data: session, error: sessionError } = await serviceClient
    .from("game_sessions")
    .select("*")
    .eq("session_code", session_code)
    .eq("game_type", "photobooth")
    .single();

  if (sessionError || !session) {
    return NextResponse.json(
      { success: false, message: "Sesi photobooth tidak ditemukan", data: null },
      { status: 404 }
    );
  }

  // Jika partner sudah bergabung sebelumnya
  if (session.partner_user_id === user.id) {
    return NextResponse.json({
      success: true,
      message: "Kamu sudah terhubung ke sesi ini",
      data: { session },
    });
  }

  if (session.host_user_id === user.id) {
    return NextResponse.json({
      success: true,
      message: "Kamu adalah host sesi ini",
      data: { session },
    });
  }

  if (session.status !== "waiting") {
    return NextResponse.json(
      { success: false, message: "Sesi ini sudah tidak dalam status menunggu", data: null },
      { status: 400 }
    );
  }

  // Verifikasi partner
  const { data: hostProfile } = await serviceClient
    .from("users")
    .select("partner_id")
    .eq("id", session.host_user_id)
    .single();

  if (hostProfile?.partner_id !== user.id) {
    return NextResponse.json(
      { success: false, message: "Kamu bukan pasangan dari host sesi ini", data: null },
      { status: 403 }
    );
  }

  const newExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 menit durasi foto

  const { data: updatedSession, error: updateError } = await serviceClient
    .from("game_sessions")
    .update({
      partner_user_id: user.id,
      partner_joined_at: new Date().toISOString(),
      status: "playing",
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .select()
    .single();

  if (updateError || !updatedSession) {
    return NextResponse.json(
      { success: false, message: updateError?.message || "Gagal bergabung ke sesi", data: null },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Berhasil bergabung ke sesi Photobooth!",
    data: { session: updatedSession },
  });
}
