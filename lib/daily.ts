/**
 * Daily.co server-side helpers
 * Digunakan dari API Routes (server only) — jangan import di client component
 */

const DAILY_API_KEY = process.env.DAILY_API_KEY ?? "";
const DAILY_API_BASE = "https://api.daily.co/v1";

/**
 * Buat room Daily.co untuk satu sesi game.
 * name = session_code (sudah unik, 12 karakter)
 * Jika room sudah ada (misal retry), return URL tanpa error.
 */
export async function createDailyRoom(
  name: string,
  expiresInMinutes: number
): Promise<string | null> {
  if (!DAILY_API_KEY) return null;

  // Expire room 30 menit setelah game session berakhir (buffer)
  const expUnix = Math.floor(Date.now() / 1000) + (expiresInMinutes + 30) * 60;

  try {
    const res = await fetch(`${DAILY_API_BASE}/rooms`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        properties: {
          exp: expUnix,
          max_participants: 2,
          enable_screenshare: false,
          enable_chat: false,
          start_video_off: false,
          start_audio_off: false,
          // Larang siapa pun join setelah session selesai
          nbf: Math.floor(Date.now() / 1000) - 30,
        },
      }),
    });

    // 409 = room sudah ada, rekonstruksi URL dari domain
    if (res.status === 409) {
      const domain = process.env.NEXT_PUBLIC_DAILY_DOMAIN ?? "";
      return domain ? `https://${domain}.daily.co/${name}` : null;
    }

    if (!res.ok) {
      console.error("[daily] createRoom error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    return (data.url as string) ?? null;
  } catch (e) {
    console.error("[daily] createRoom exception:", e);
    return null;
  }
}

/**
 * Hapus room setelah sesi selesai (best effort, tidak throw jika gagal).
 */
export async function deleteDailyRoom(name: string): Promise<void> {
  if (!DAILY_API_KEY) return;
  try {
    await fetch(`${DAILY_API_BASE}/rooms/${name}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
    });
  } catch {
    /* best effort */
  }
}
