import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import {
  imageDataUrlSchema,
  parseBody,
  photoboothError,
  requirePhotoboothUser,
  runPhotoboothAction,
  slotIndexSchema,
} from "@/lib/games/photobooth/action";
import {
  capturePath,
  removeCaptures,
  uploadCapture,
  withSignedPhotoUrls,
} from "@/lib/games/photobooth/storage";
import type { PhotoboothGameState } from "@/lib/types";

const bodySchema = z.object({
  slot_index: slotIndexSchema,
  image_url:  imageDataUrlSchema,
});

/**
 * POST /api/game/photobooth/session/[code]/submit-photo
 * Menyimpan snapshot webcam pemain untuk slot capture yang sedang aktif.
 * Body: { slot_index: number, image_url: "data:image/...;base64,..." }
 *
 * Foto di-upload ke bucket privat photobooth-captures dan hanya path-nya
 * yang disimpan di game_state (migration 041) — base64 di game_state membuat
 * row terlalu besar untuk payload Supabase Realtime. Merge foto host &
 * partner (yang submit hampir bersamaan) dilakukan atomik di RPC.
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
  const sessionCode = code.toUpperCase();
  const { slot_index, image_url } = body.data;

  // Pre-check murah sebelum upload, supaya request yang pasti ditolak tidak
  // mengisi Storage. RPC tetap jadi penentu akhir (dengan row lock).
  const { data: current } = await createServiceClient()
    .from("game_sessions")
    .select("host_user_id, partner_user_id, game_state")
    .eq("session_code", sessionCode)
    .eq("game_type", "photobooth")
    .maybeSingle();

  if (!current) return photoboothError("SESSION_NOT_FOUND");
  const role =
    current.host_user_id === auth.userId ? "host"
    : current.partner_user_id === auth.userId ? "partner"
    : null;
  if (!role) return photoboothError("NOT_IN_SESSION");

  const gs = current.game_state as PhotoboothGameState;
  if (!gs?.capture || gs.capture.slot !== slot_index) return photoboothError("CAPTURE_CLOSED");
  if (gs.capture.submitted?.includes(role)) return photoboothError("ALREADY_SUBMITTED");

  const previousPath = gs.photos?.[slot_index]?.[`${role}_image_path`];
  const path = capturePath(sessionCode, slot_index, auth.userId);

  const uploadError = await uploadCapture(path, image_url);
  if (uploadError) {
    console.error("[photobooth] Upload foto gagal:", uploadError);
    return NextResponse.json(
      { success: false, message: "Gagal mengunggah foto", data: null },
      { status: 500 }
    );
  }

  const result = await runPhotoboothAction(sessionCode, auth.userId, "submit_photo", {
    slot_index,
    image_path: path,
  });
  if ("error" in result) {
    await removeCaptures([path]);
    return result.error;
  }

  // Foto lama slot ini (dari sebelum retake) sudah tidak direferensikan.
  if (previousPath && previousPath !== path) {
    await removeCaptures([previousPath]);
  }

  return NextResponse.json({
    success: true,
    message: "Foto berhasil disimpan",
    data: { session: await withSignedPhotoUrls(result.session) },
  });
}
