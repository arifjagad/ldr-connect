import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/game/tod/session/[code]/expire
 * Tandai sesi sebagai expired saat timer frontend habis.
 * Dipanggil client-side ketika countdown mencapai 0.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthenticated", data: null },
      { status: 401 }
    );
  }

  const { code } = await params;
  const sessionCode = code.toUpperCase();

  const serviceClient = createServiceClient();

  // Update ke expired — hanya jika masih playing dan user adalah bagian dari sesi
  const { data, error } = await serviceClient
    .from("game_sessions")
    .update({ status: "expired" })
    .eq("session_code", sessionCode)
    .eq("status", "playing")
    .or(`host_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .select("session_code, status")
    .single();

  if (error || !data) {
    // Jika tidak ada row yang di-update (sudah expired/completed), itu OK
    return NextResponse.json({
      success: true,
      message: "Sesi tidak perlu diupdate",
      data: null,
    });
  }

  return NextResponse.json({
    success: true,
    message: "Sesi ditandai expired",
    data: { session_code: data.session_code },
  });
}
