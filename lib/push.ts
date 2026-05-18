import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/server";

// Konfigurasi VAPID sekali saja — dipanggil per request karena Next.js edge
function setupVapid() {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
};

/**
 * Kirim push notification ke semua subscription aktif milik satu user.
 * Subscription yang expired/invalid otomatis dihapus dari DB.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<void> {
  if (
    !process.env.VAPID_PUBLIC_KEY ||
    !process.env.VAPID_PRIVATE_KEY ||
    !process.env.VAPID_EMAIL
  ) {
    console.warn("[push] VAPID env vars not set — skipping push");
    return;
  }

  setupVapid();

  const serviceClient = createServiceClient();

  const { data: subs, error } = await serviceClient
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error || !subs || subs.length === 0) return;

  const pushData = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/dashboard",
    tag: payload.tag ?? "ldr-notif",
    icon: payload.icon ?? "/icon-192.png",
  });

  const staleIds: number[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          pushData
        );
      } catch (err: any) {
        // 404/410 = subscription expired, hapus dari DB
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          staleIds.push(sub.id);
        } else {
          console.error("[push] send error:", err?.statusCode, err?.body);
        }
      }
    })
  );

  if (staleIds.length > 0) {
    await serviceClient
      .from("push_subscriptions")
      .delete()
      .in("id", staleIds);
  }
}
