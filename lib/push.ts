import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/server";

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

  console.log(`[push] userId=${userId} subs=${subs?.length ?? 0} dbError=${error?.message ?? "none"}`);

  if (error || !subs || subs.length === 0) {
    console.warn("[push] No subscriptions found — aborting");
    return;
  }

  const pushData = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/dashboard",
    tag: payload.tag ?? "ldr-notif",
    icon: payload.icon ?? "/favicon.ico",
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
        console.log("[push] ✓ Sent to:", sub.endpoint.slice(0, 60) + "...");
      } catch (err: any) {
        console.error("[push] ✗ Failed:", err?.statusCode, err?.body ?? err?.message);
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          staleIds.push(sub.id);
        }
      }
    })
  );

  if (staleIds.length > 0) {
    console.log("[push] Cleaning stale subs:", staleIds);
    await serviceClient
      .from("push_subscriptions")
      .delete()
      .in("id", staleIds);
  }
}
