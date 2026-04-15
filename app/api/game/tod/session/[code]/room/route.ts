import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createDailyRoom } from "@/lib/daily";

/**
 * GET /api/game/tod/session/[code]/room
 * Ambil URL Daily.co room untuk sesi ini.
 * Jika room belum ada, buat baru (idempotent).
 * Returns: { room_url: string }
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthenticated", data: null },
      { status: 401 }
    );
  }

  const { code } = await params;
  const sessionCode = code.toUpperCase();

  // Pastikan user adalah bagian dari sesi ini
  const serviceClient = createServiceClient();
  const { data: session, error: sessError } = await serviceClient
    .from("game_sessions")
    .select("session_code, status, host_user_id, partner_user_id, expires_at")
    .eq("session_code", sessionCode)
    .single();

  if (sessError || !session) {
    return NextResponse.json(
      { success: false, message: "Sesi tidak ditemukan", data: null },
      { status: 404 }
    );
  }

  if (session.host_user_id !== user.id && session.partner_user_id !== user.id) {
    return NextResponse.json(
      { success: false, message: "Kamu tidak memiliki akses ke sesi ini", data: null },
      { status: 403 }
    );
  }

  if (!["waiting", "playing"].includes(session.status)) {
    return NextResponse.json(
      { success: false, message: "Sesi sudah berakhir", data: null },
      { status: 410 }
    );
  }

  const domain = process.env.NEXT_PUBLIC_DAILY_DOMAIN ?? "";
  if (!domain) {
    return NextResponse.json(
      { success: false, message: "Video call belum dikonfigurasi", data: null },
      { status: 503 }
    );
  }

  // Hitung sisa menit dari sekarang hingga expires_at (minimum 5 menit)
  const expiresAt = session.expires_at ? new Date(session.expires_at) : new Date(Date.now() + 30 * 60 * 1000);
  const remainingMinutes = Math.max(5, Math.ceil((expiresAt.getTime() - Date.now()) / 60000));

  // Coba buat room (jika sudah ada, createDailyRoom return URL dari 409)
  const roomUrl = await createDailyRoom(sessionCode, remainingMinutes);

  if (!roomUrl) {
    // Fallback: construct URL tanpa verify (mungkin DAILY_API_KEY belum diset)
    const fallback = `https://${domain}.daily.co/${sessionCode}`;
    return NextResponse.json({
      success: true,
      message: "Room URL (fallback)",
      data: { room_url: fallback },
    });
  }

  return NextResponse.json({
    success: true,
    message: "Room URL siap",
    data: { room_url: roomUrl },
  });
}
