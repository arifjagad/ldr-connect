import { NextRequest, NextResponse } from "next/server";
import { requirePhotoboothUser, runPhotoboothAction } from "@/lib/games/photobooth/action";

/**
 * POST /api/game/photobooth/session/[code]/trigger-countdown
 * Memulai countdown 5 detik untuk slot aktif (game_state.current_slot di
 * server — slot_index dari body diabaikan).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const auth = await requirePhotoboothUser();
  if ("error" in auth) return auth.error;

  const { code } = await params;
  const result = await runPhotoboothAction(code, auth.userId, "trigger_countdown");
  if ("error" in result) return result.error;

  return NextResponse.json({
    success: true,
    message: "Countdown dimulai",
    data: { session: result.session },
  });
}
