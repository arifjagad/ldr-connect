import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  parseBody,
  requirePhotoboothUser,
  runPhotoboothAction,
  slotIndexSchema,
} from "@/lib/games/photobooth/action";

const bodySchema = z.object({ slot_index: slotIndexSchema });

/**
 * POST /api/game/photobooth/session/[code]/retake
 * Mengambil ulang foto untuk slot tertentu (maksimal 3x kuota per sesi).
 * Body: { slot_index: number }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const auth = await requirePhotoboothUser();
  if ("error" in auth) return auth.error;

  const body = await parseBody(request, bodySchema);
  if ("error" in body) return body.error;

  const { code } = await params;
  const result = await runPhotoboothAction(code, auth.userId, "retake", body.data);
  if ("error" in result) return result.error;

  return NextResponse.json({
    success: true,
    message: "Retake siap dimulai",
    data: { session: result.session },
  });
}
