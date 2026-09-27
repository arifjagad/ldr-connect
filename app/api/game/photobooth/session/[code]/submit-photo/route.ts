import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  imageDataUrlSchema,
  parseBody,
  requirePhotoboothUser,
  runPhotoboothAction,
  slotIndexSchema,
} from "@/lib/games/photobooth/action";

const bodySchema = z.object({
  slot_index: slotIndexSchema,
  image_url:  imageDataUrlSchema,
});

/**
 * POST /api/game/photobooth/session/[code]/submit-photo
 * Menyimpan snapshot webcam pemain untuk slot capture yang sedang aktif.
 * Body: { slot_index: number, image_url: "data:image/...;base64,..." }
 *
 * Host & partner submit hampir bersamaan di setiap slot — merge foto
 * dilakukan atomik di RPC photobooth_action (migration 040) supaya foto
 * salah satu pihak tidak tertimpa.
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
  const result = await runPhotoboothAction(code, auth.userId, "submit_photo", body.data);
  if ("error" in result) return result.error;

  return NextResponse.json({
    success: true,
    message: "Foto berhasil disimpan",
    data: { session: result.session },
  });
}
