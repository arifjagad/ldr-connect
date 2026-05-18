import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/game/couple-stats
 * Statistik game untuk pasangan yang sedang login.
 * Returns statistik per user, per game type, streak, dll.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, message: "Unauthenticated" }, { status: 401 });
  }

  const serviceClient = createServiceClient();

  // Ambil profile user + partner_id
  const { data: profile } = await serviceClient
    .from("users")
    .select("id, name, partner_id")
    .eq("id", user.id)
    .single();

  const partnerId = profile?.partner_id ?? null;

  // Ambil semua completed sessions milik couple ini
  let sessionQuery = serviceClient
    .from("game_sessions")
    .select("id, game_type, status, game_state, questions, created_at, host_user_id, partner_user_id")
    .or(`host_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .eq("status", "completed")
    .order("created_at", { ascending: true });

  const { data: sessions } = await sessionQuery;
  const allSessions = sessions ?? [];

  // Nama partner
  let partnerName = "Partner";
  if (partnerId) {
    const { data: partnerProfile } = await serviceClient
      .from("users")
      .select("name")
      .eq("id", partnerId)
      .single();
    partnerName = partnerProfile?.name ?? "Partner";
  }

  // ── Hitung stats ─────────────────────────────────────────────────────────────

  const GAME_TYPES = ["tod", "snake_ladder", "dare_derby"];

  // Per-game win counts: { userId: count }
  const winCounts: Record<string, Record<string, number>> = {
    tod: { [user.id]: 0, [partnerId ?? "_"]: 0 },
    snake_ladder: { [user.id]: 0, [partnerId ?? "_"]: 0 },
    dare_derby: { [user.id]: 0, [partnerId ?? "_"]: 0 },
    draw: { total: 0 },
  };

  const gameTypeCounts: Record<string, number> = { tod: 0, snake_ladder: 0, dare_derby: 0 };
  const playedDays = new Set<string>();

  for (const s of allSessions) {
    const gameType = s.game_type as string;
    if (GAME_TYPES.includes(gameType)) {
      gameTypeCounts[gameType] = (gameTypeCounts[gameType] ?? 0) + 1;
    }

    // Hari dimainkan untuk streak
    const day = s.created_at.slice(0, 10);
    playedDays.add(day);

    // Tentukan winner
    const hostId = s.host_user_id;
    const partId = s.partner_user_id;

    if (gameType === "snake_ladder") {
      const winner = s.game_state?.winner; // "host" | "partner"
      if (winner === "host" && hostId) {
        winCounts.snake_ladder[hostId] = (winCounts.snake_ladder[hostId] ?? 0) + 1;
      } else if (winner === "partner" && partId) {
        winCounts.snake_ladder[partId] = (winCounts.snake_ladder[partId] ?? 0) + 1;
      }
    }

    if (gameType === "dare_derby") {
      const gs = s.game_state;
      if (gs) {
        const hostDares: number = gs.dare_counts?.host ?? 0;
        const partnerDares: number = gs.dare_counts?.partner ?? 0;
        let winnerId: string | null = null;
        if (gs.forfeit_by === "host") winnerId = partId;
        else if (gs.forfeit_by === "partner") winnerId = hostId;
        else if (hostDares < partnerDares) winnerId = hostId;
        else if (partnerDares < hostDares) winnerId = partId;

        if (winnerId) {
          winCounts.dare_derby[winnerId] = (winCounts.dare_derby[winnerId] ?? 0) + 1;
        } else {
          winCounts.draw.total = (winCounts.draw.total ?? 0) + 1;
        }
      }
    }
  }

  // Streak: hitung consecutive days dari hari ini ke belakang
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().slice(0, 10);
    if (playedDays.has(dayStr)) {
      streak++;
    } else if (i > 0) {
      break; // Streak putus
    }
  }

  // Game favorit (paling sering dimainkan)
  const favoriteGame = Object.entries(gameTypeCounts).sort((a, b) => b[1] - a[1])[0];

  // Total wins per user (semua game)
  const myTotalWins =
    (winCounts.snake_ladder[user.id] ?? 0) +
    (winCounts.dare_derby[user.id] ?? 0);
  const partnerTotalWins = partnerId
    ? (winCounts.snake_ladder[partnerId] ?? 0) + (winCounts.dare_derby[partnerId] ?? 0)
    : 0;

  return NextResponse.json({
    success: true,
    data: {
      myId: user.id,
      myName: profile?.name ?? "Kamu",
      partnerId,
      partnerName,
      totalGames: allSessions.length,
      streak,
      favoriteGame: favoriteGame?.[0] ?? null,
      favoriteGameCount: favoriteGame?.[1] ?? 0,
      gameTypeCounts,
      myTotalWins,
      partnerTotalWins,
      leaderboard: {
        snake_ladder: {
          myWins: winCounts.snake_ladder[user.id] ?? 0,
          partnerWins: partnerId ? (winCounts.snake_ladder[partnerId] ?? 0) : 0,
        },
        dare_derby: {
          myWins: winCounts.dare_derby[user.id] ?? 0,
          partnerWins: partnerId ? (winCounts.dare_derby[partnerId] ?? 0) : 0,
        },
      },
    },
  });
}
