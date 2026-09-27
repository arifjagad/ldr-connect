import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/game/photobooth/session/[code]
 * Detail sesi Photobooth
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthenticated", data: null },
      { status: 401 }
    );
  }

  const serviceClient = createServiceClient();
  const { data: session, error } = await serviceClient
    .from("game_sessions")
    .select("*")
    .eq("session_code", code)
    .eq("game_type", "photobooth")
    .single();

  if (error || !session) {
    return NextResponse.json(
      { success: false, message: "Sesi photobooth tidak ditemukan", data: null },
      { status: 404 }
    );
  }

  // Pastikan user peserta sesi
  if (session.host_user_id !== user.id && session.partner_user_id !== user.id) {
    return NextResponse.json(
      { success: false, message: "Kamu bukan peserta sesi ini", data: null },
      { status: 403 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Sesi berhasil dimuat",
    data: { session },
  });
}
