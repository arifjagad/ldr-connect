/**
 * Server-only: kirim invite notification ke partner via Supabase Realtime REST API.
 * Fire-and-forget — tidak memblok response API route jika gagal.
 */
export async function broadcastGameInvite({
  hostUserId,
  partnerId,
  sessionCode,
  gameType,
}: {
  hostUserId: string;
  partnerId: string;
  sessionCode: string;
  gameType: string;
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return;

  // LEAST(hostUserId, partnerId) — sama dengan konvensi couple_id di DB
  const coupleId = [hostUserId, partnerId].sort()[0];

  await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
    method: "POST",
    signal: AbortSignal.timeout(3000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify({
      messages: [
        {
          topic: `couple-invites:${coupleId}`,
          event: "game_invite",
          payload: {
            session_code: sessionCode,
            game_type: gameType,
            host_user_id: hostUserId,
            status: "waiting",
          },
        },
      ],
    }),
  }).catch(() => {});
}
