import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/game/session/[code]
 * Ambil game_type dari session berdasarkan code.
 * Menggunakan service client (bypass RLS) agar bisa dibaca sebelum partner join.
 * Dipakai oleh /join/[code] page untuk redirect ke halaman game yang tepat.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated", data: null }, { status: 401 });
  }

  const { code } = await params;
  const serviceClient = await createServiceClient();

  const { data: session } = await serviceClient
    .from("game_sessions")
    .select("session_code, game_type, status")
    .eq("session_code", code.toUpperCase())
    .in("status", ["waiting", "playing"])
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ success: false, message: "Sesi tidak ditemukan atau sudah tidak aktif", data: null }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    message: "ok",
    data: {
      session_code: session.session_code,
      game_type: session.game_type,
      status: session.status,
    },
  });
}
