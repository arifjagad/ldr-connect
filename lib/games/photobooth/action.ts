import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { PhotoboothSession } from "@/lib/types";

// Snapshot webcam 1280x720 JPEG q0.9 umumnya 150-400 KB base64 — 1 juta
// karakter (~730 KB biner) memberi ruang cukup tanpa membiarkan kolom
// game_state JSONB diisi string raksasa.
export const MAX_IMAGE_DATA_URL_LENGTH = 1_000_000;

export const slotIndexSchema = z.number().int().min(1).max(20);

export const imageDataUrlSchema = z
  .string()
  .max(MAX_IMAGE_DATA_URL_LENGTH, "Ukuran foto terlalu besar")
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/, "Format foto tidak valid");

export type PhotoboothAction =
  | "select_template"
  | "trigger_countdown"
  | "submit_photo"
  | "retake"
  | "complete";

const ERRORS: Record<string, { status: number; message: string }> = {
  SESSION_NOT_FOUND:  { status: 404, message: "Sesi photobooth tidak ditemukan" },
  NOT_IN_SESSION:     { status: 403, message: "Kamu bukan peserta sesi ini" },
  SESSION_NOT_ACTIVE: { status: 400, message: "Sesi tidak aktif" },
  SESSION_EXPIRED:    { status: 410, message: "Waktu sesi sudah habis" },
  TEMPLATE_NOT_FOUND: { status: 404, message: "Template tidak ditemukan" },
  CAPTURE_CLOSED:     { status: 409, message: "Tidak ada sesi foto aktif untuk slot ini" },
  ALREADY_SUBMITTED:  { status: 409, message: "Foto kamu untuk slot ini sudah terkirim" },
  NO_RETAKES_LEFT:    { status: 400, message: "Kuota retake foto sudah habis (maks 3x)" },
  INVALID_SLOT:       { status: 400, message: "Slot foto tidak valid" },
  WRONG_PHASE:        { status: 409, message: "Aksi tidak bisa dilakukan di tahap ini" },
  INVALID_ACTION:     { status: 400, message: "Jenis aksi tidak dikenali" },
};

export async function parseBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): Promise<{ data: z.infer<T> } | { error: NextResponse }> {
  const raw = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: NextResponse.json(
        { success: false, message: parsed.error.issues[0].message, data: null },
        { status: 422 }
      ),
    };
  }
  return { data: parsed.data };
}

export async function requirePhotoboothUser(): Promise<{ userId: string } | { error: NextResponse }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      error: NextResponse.json(
        { success: false, message: "Unauthenticated", data: null },
        { status: 401 }
      ),
    };
  }
  return { userId: user.id };
}

/**
 * Panggil RPC photobooth_action (atomic, SELECT ... FOR UPDATE — migration
 * 040). Semua validasi fase/slot/kuota/partisipan ada di RPC.
 */
export async function runPhotoboothAction(
  code: string,
  userId: string,
  action: PhotoboothAction,
  payload: Record<string, unknown> = {}
): Promise<{ session: PhotoboothSession } | { error: NextResponse }> {
  const { data, error } = await createServiceClient().rpc("photobooth_action", {
    p_session_code: code.toUpperCase(),
    p_user_id:      userId,
    p_action:       action,
    p_payload:      payload,
  });

  if (error) {
    const msg = error.message ?? "";
    const known = Object.keys(ERRORS).find((key) => msg.includes(key));
    const { status, message } = known
      ? ERRORS[known]
      : { status: 500, message: "Gagal memproses aksi photobooth" };
    return {
      error: NextResponse.json({ success: false, message, data: null }, { status }),
    };
  }

  return { session: data as PhotoboothSession };
}
