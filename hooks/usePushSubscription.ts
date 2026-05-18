"use client";

import { useEffect, useRef, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  // Gunakan ArrayBuffer eksplisit agar kompatibel dengan Uint8Array<ArrayBuffer>
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    arr[i] = rawData.charCodeAt(i);
  }
  return arr;
}

type SubscriptionStatus = "idle" | "unsupported" | "denied" | "subscribed" | "error";

export function usePushSubscription() {
  const [status, setStatus] = useState<SubscriptionStatus>("idle");
  const [loading, setLoading] = useState(false);
  const didInit = useRef(false);

  // Register service worker saat hook dipasang
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(async (reg) => {
        // Cek apakah sudah ada subscription aktif
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          setStatus("subscribed");
        } else if (Notification.permission === "denied") {
          setStatus("denied");
        }
      })
      .catch((err) => {
        console.error("[SW] registration failed:", err);
        setStatus("error");
      });
  }, []);

  async function subscribe(): Promise<boolean> {
    if (!("serviceWorker" in navigator) || !VAPID_PUBLIC_KEY) return false;

    setLoading(true);
    try {
      // Minta permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return false;
      }

      const reg = await navigator.serviceWorker.ready;

      // Unsubscribe dulu kalau ada yang lama (bisa outdated)
      const old = await reg.pushManager.getSubscription();
      if (old) await old.unsubscribe();

      // Subscribe baru
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
      });

      const { endpoint, keys } = subscription.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      // Simpan ke server
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint, p256dh: keys.p256dh, auth: keys.auth }),
      });

      if (!res.ok) throw new Error("Failed to save subscription");

      setStatus("subscribed");
      return true;
    } catch (err) {
      console.error("[push] subscribe error:", err);
      setStatus("error");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe(): Promise<void> {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("idle");
    } catch (err) {
      console.error("[push] unsubscribe error:", err);
    } finally {
      setLoading(false);
    }
  }

  return { status, loading, subscribe, unsubscribe };
}
