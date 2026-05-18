// Service Worker — LDR-Connect Push Notifications
// File ini di /public/sw.js (bukan di app dir)

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// ── Push event: tampilkan notifikasi ─────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "LDR-Connect", body: event.data?.text() || "" };
  }

  const title = data.title || "LDR-Connect 💕";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    data: { url: data.url || "/dashboard" },
    tag: data.tag || "ldr-notif",
    renotify: true,
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click: fokus/buka tab ───────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Coba fokus tab yang sudah ada
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Buka tab baru jika tidak ada
        return clients.openWindow(targetUrl);
      })
  );
});
