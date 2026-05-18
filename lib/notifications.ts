"use client";

/**
 * Utility: Browser Notification
 * Minta permission dan kirim notifikasi native browser.
 * Berguna saat user buka tab/app lain sementara menunggu partner.
 */

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function sendBrowserNotification(
  title: string,
  options?: { body?: string; icon?: string; tag?: string }
) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const n = new Notification(title, {
    body: options?.body,
    icon: options?.icon ?? "/favicon.ico",
    tag: options?.tag,
    silent: false,
  });
  // Auto-close setelah 5 detik
  setTimeout(() => n.close(), 5000);
  // Focus tab saat notif diklik
  n.onclick = () => {
    window.focus();
    n.close();
  };
}
