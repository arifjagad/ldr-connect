import { NextRequest, NextResponse } from "next/server";
import { deleteDailyRoom } from "@/lib/daily";
import { requirePhotoboothUser, runPhotoboothAction } from "@/lib/games/photobooth/action";

/**
 * POST /api/game/photobooth/session/[code]/complete
 * Menyelesaikan sesi photobooth (hanya dari fase review_retake) dan
 * mengubah status sesi menjadi 'completed'.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const auth = await requirePhotoboothUser();
  if ("error" in auth) return auth.error;

  const { code } = await params;
  const result = await runPhotoboothAction(code, auth.userId, "complete");
  if ("error" in result) return result.error;

  // Game selesai — hapus Daily.co room (best effort)
  deleteDailyRoom(code.toUpperCase());

  return NextResponse.json({
    success: true,
    message: "Sesi photobooth selesai!",
    data: { session: result.session },
  });
}
