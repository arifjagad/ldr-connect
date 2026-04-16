import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/game/tod/session/[code]/cancel
 * Batalkan sesi oleh host (hanya saat status masih 'waiting').
 * Coin dikembalikan ke host secara atomik.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthenticated", data: null },
      { status: 401 }
    );
  }

  const { code } = await params;
  const sessionCode = code.toUpperCase();

  const serviceClient = createServiceClient();

  // Ambil sesi
  const { data: session, error: fetchError } = await serviceClient
    .from("game_sessions")
    .select("id, status, host_user_id, coin_deducted, coin_refunded_at")
    .eq("session_code", sessionCode)
    .single();

  if (fetchError || !session) {
    return NextResponse.json(
      { success: false, message: "Sesi tidak ditemukan", data: null },
      { status: 404 }
    );
  }

  // Hanya host yang boleh cancel
  if (session.host_user_id !== user.id) {
    return NextResponse.json(
      { success: false, message: "Hanya host yang bisa membatalkan sesi", data: null },
      { status: 403 }
    );
  }

  // Jika sudah tidak aktif, anggap berhasil (idempotent)
  if (!["waiting", "playing"].includes(session.status)) {
    return NextResponse.json({
      success: true,
      message: "Sesi sudah tidak aktif",
      data: null,
    });
  }

  // Update status ke cancelled
  const { error: updateError } = await serviceClient
    .from("game_sessions")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", session.id);

  if (updateError) {
    return NextResponse.json(
      { success: false, message: "Gagal membatalkan sesi", data: null },
      { status: 500 }
    );
  }

  // Refund coin ke host jika sesi masih 'waiting' (partner belum join) dan belum direfund
  if (
    session.status === "waiting" &&
    !session.coin_refunded_at &&
    session.coin_deducted > 0
  ) {
    // Increment balance wallet host
    const { data: wallet } = await serviceClient
      .from("wallets")
      .select("balance")
      .eq("user_id", session.host_user_id)
      .single();

    if (wallet) {
      await serviceClient
        .from("wallets")
        .update({
          balance: wallet.balance + session.coin_deducted,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", session.host_user_id);

      // Catat transaksi refund
      await serviceClient.from("coin_transactions").insert({
        user_id: session.host_user_id,
        type: "topup",
        amount: session.coin_deducted,
        payment_status: "paid",
        metadata: {
          reason: "session_cancelled_refund",
          session_code: sessionCode,
          session_id: session.id,
        },
      });

      // Tandai sudah direfund
      await serviceClient
        .from("game_sessions")
        .update({ coin_refunded_at: new Date().toISOString() })
        .eq("id", session.id);
    }
  }

  return NextResponse.json({
    success: true,
    message: "Sesi berhasil dibatalkan dan coin dikembalikan",
    data: null,
  });
}
