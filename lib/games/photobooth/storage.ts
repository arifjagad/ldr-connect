import { createServiceClient } from "@/lib/supabase/server";
import type { PhotoboothPhoto, PhotoboothSession } from "@/lib/types";

// Bucket privat (migration 041) — tanpa policy anon/authenticated, jadi hanya
// service role yang bisa baca/tulis. Client melihat foto lewat signed URL.
export const CAPTURE_BUCKET = "photobooth-captures";

// Cukup panjang untuk durasi sesi + review + download hasil akhir.
const SIGNED_URL_TTL_SECONDS = 2 * 60 * 60;

export function capturePath(sessionCode: string, slot: number, userId: string): string {
  const rand = crypto.randomUUID().slice(0, 8);
  return `${sessionCode}/${slot}-${userId}-${rand}.jpg`;
}

export function decodeDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) throw new Error("Format foto tidak valid");
  return { contentType: match[1], buffer: Buffer.from(match[2], "base64") };
}

export async function uploadCapture(path: string, dataUrl: string): Promise<string | null> {
  const { buffer, contentType } = decodeDataUrl(dataUrl);
  const { error } = await createServiceClient()
    .storage.from(CAPTURE_BUCKET)
    .upload(path, buffer, { contentType, upsert: false });
  return error ? error.message : null;
}

export async function removeCaptures(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await createServiceClient().storage.from(CAPTURE_BUCKET).remove(paths);
  if (error) console.error("[photobooth] Gagal hapus foto:", error.message);
}

/**
 * Tambahkan signed URL ke host_image_url / partner_image_url untuk setiap
 * foto yang disimpan sebagai path. Foto lama (base64 di *_image_url, sebelum
 * migration 041) dibiarkan apa adanya.
 */
export async function withSignedPhotoUrls<T extends PhotoboothSession | null>(session: T): Promise<T> {
  const photos = session?.game_state?.photos;
  if (!session || !photos) return session;

  const paths = Object.values(photos).flatMap((p: PhotoboothPhoto) =>
    [p.host_image_path, p.partner_image_path].filter((x): x is string => !!x)
  );
  if (paths.length === 0) return session;

  const { data, error } = await createServiceClient()
    .storage.from(CAPTURE_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    console.error("[photobooth] Gagal membuat signed URL:", error?.message);
    return session;
  }

  const urlByPath = new Map(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
  const signed: Record<number, PhotoboothPhoto> = {};
  for (const [slot, photo] of Object.entries(photos)) {
    signed[Number(slot)] = {
      ...photo,
      ...(photo.host_image_path && urlByPath.has(photo.host_image_path)
        ? { host_image_url: urlByPath.get(photo.host_image_path) }
        : {}),
      ...(photo.partner_image_path && urlByPath.has(photo.partner_image_path)
        ? { partner_image_url: urlByPath.get(photo.partner_image_path) }
        : {}),
    };
  }

  return { ...session, game_state: { ...session.game_state, photos: signed } };
}

// Foto hanya dibutuhkan selama sesi + unduh hasil akhir; tidak ada halaman
// riwayat yang menampilkannya lagi.
export const CAPTURE_RETENTION_DAYS = 7;

/**
 * Hapus foto sesi photobooth yang sudah berakhir > CAPTURE_RETENTION_DAYS
 * hari, lalu tandai game_state.photos_purged_at supaya tidak diproses ulang.
 * Dibatasi per run agar cron tetap cepat; sisanya diproses run berikutnya.
 */
export async function purgeOldCaptures(limit = 100): Promise<{ sessions: number; files: number }> {
  const serviceClient = createServiceClient();
  const cutoff = new Date(Date.now() - CAPTURE_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: sessions, error } = await serviceClient
    .from("game_sessions")
    .select("id, session_code, game_state")
    .eq("game_type", "photobooth")
    .in("status", ["completed", "expired", "cancelled"])
    .lt("updated_at", cutoff)
    .is("game_state->photos_purged_at", null)
    .limit(limit);

  if (error) {
    console.error("[photobooth] Query purge gagal:", error.message);
    return { sessions: 0, files: 0 };
  }

  let files = 0;
  for (const s of sessions ?? []) {
    const { data: objects } = await serviceClient.storage
      .from(CAPTURE_BUCKET)
      .list(s.session_code, { limit: 1000 });
    const paths = (objects ?? []).map((o) => `${s.session_code}/${o.name}`);
    if (paths.length > 0) {
      const { error: removeError } = await serviceClient.storage.from(CAPTURE_BUCKET).remove(paths);
      if (removeError) {
        console.error(`[photobooth] Gagal hapus foto sesi ${s.session_code}:`, removeError.message);
        continue;
      }
      files += paths.length;
    }

    await serviceClient
      .from("game_sessions")
      .update({ game_state: { ...(s.game_state ?? {}), photos_purged_at: new Date().toISOString() } })
      .eq("id", s.id);
  }

  return { sessions: (sessions ?? []).length, files };
}
