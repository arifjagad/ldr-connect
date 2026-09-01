import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/coin/transactions
 * Ambil riwayat transaksi coin user yang sedang login
 * Sekaligus jalankan auto-expire untuk transaksi pending yang sudah > 60 menit
 */
export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthenticated", data: null },
      { status: 401 }
    );
  }

  // Jalankan auto-expire untuk transaksi pending yang berumur > 60 menit
  try {
    const serviceClient = createServiceClient();
    await serviceClient.rpc("expire_old_pending_topups");
  } catch (expireErr) {
    console.warn("[transactions] auto-expire warning:", expireErr);
  }

  const { data: transactions, error } = await supabase
    .from("coin_transactions")
    .select(`
      id,
      type,
      amount,
      payment_status,
      payment_reference,
      metadata,
      paid_at,
      created_at,
      coin_packages (id, name, coin_amount, price)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { success: false, message: "Gagal memuat riwayat transaksi", data: null },
      { status: 500 }
    );
  }

  // Flatten coin_packages field
  const mapped = (transactions ?? []).map((tx) => {
    const pkg = tx.coin_packages as unknown as { id: number; name: string; coin_amount: number; price: number } | null;
    return {
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      payment_status: tx.payment_status,
      payment_reference: tx.payment_reference,
      metadata: tx.metadata,
      paid_at: tx.paid_at,
      created_at: tx.created_at,
      coin_package: pkg ?? null,
    };
  });

  return NextResponse.json({
    success: true,
    message: "OK",
    data: { transactions: mapped },
  });
}
