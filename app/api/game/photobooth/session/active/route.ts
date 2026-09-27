import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { withSignedPhotoUrls } from "@/lib/games/photobooth/storage";
import type { PhotoboothSession } from "@/lib/types";

/**
 * GET /api/game/photobooth/session/active
 * Cek sesi aktif Photobooth untuk user
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthenticated", data: null },
      { status: 401 }
    );
  }

  const serviceClient = createServiceClient();

  // Auto-expire sesi lama
  await serviceClient
    .from("game_sessions")
    .update({ status: "expired" })
    .or(`host_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .in("status", ["waiting", "playing"])
    .lt("expires_at", new Date().toISOString());

  const { data: session } = await serviceClient
    .from("game_sessions")
    .select("*")
    .eq("game_type", "photobooth")
    .or(`host_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .in("status", ["waiting", "playing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    success: true,
    message: session ? "Sesi aktif ditemukan" : "Tidak ada sesi aktif",
    data: { session: await withSignedPhotoUrls((session ?? null) as PhotoboothSession | null) },
  });
}
