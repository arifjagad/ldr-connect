import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const MIDTRANS_API_URL = process.env.MIDTRANS_IS_PRODUCTION === "true"
  ? "https://app.midtrans.com/snap/v1/transactions"
  : "https://app.sandbox.midtrans.com/snap/v1/transactions";

/**
 * POST /api/coin/topup
 * Buat transaksi topup coin + dapatkan Midtrans Snap URL
 *
 * Body: { coin_package_id: number }
 * Returns: { payment_url, transaction }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Validate session
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthenticated", data: null },
      { status: 401 }
    );
  }

  // Parse body
  let body: { coin_package_id?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Request body tidak valid", data: null },
      { status: 400 }
    );
  }

  const { coin_package_id } = body;
  if (!coin_package_id || typeof coin_package_id !== "number") {
    return NextResponse.json(
      { success: false, message: "coin_package_id wajib diisi", data: null },
      { status: 422 }
    );
  }

  // Ambil paket yang dipilih
  const { data: pkg, error: pkgError } = await supabase
    .from("coin_packages")
    .select("id, name, coin_amount, price, is_active")
    .eq("id", coin_package_id)
    .eq("is_active", true)
    .single();

  if (pkgError || !pkg) {
    return NextResponse.json(
      { success: false, message: "Paket coin tidak ditemukan", data: null },
      { status: 404 }
    );
  }

  // Rate limiting: maks 3 pending topup dalam 15 menit (via RPC)
  const serviceClient = await createServiceClient();
  const { data: pendingCount } = await serviceClient.rpc("get_pending_topup_count", {
    p_user_id: user.id,
  });
  if ((pendingCount ?? 0) >= 3) {
    return NextResponse.json(
      { success: false, message: "Terlalu banyak transaksi pending. Selesaikan atau tunggu 15 menit.", data: null },
      { status: 429 }
    );
  }

  // Ambil profil user untuk keperluan Midtrans
  const { data: profile } = await supabase
    .from("users")
    .select("name, email")
    .eq("id", user.id)
    .single();

  // Generate order ID pakai CSPRNG — Math.random() tidak aman untuk payment reference
  const orderId = `TOPUP-${Date.now()}-${randomBytes(4).toString("hex").toUpperCase()}`;

  // Insert coin_transaction (pending) dengan service client untuk bypass RLS
  const { data: tx, error: txError } = await serviceClient
    .from("coin_transactions")
    .insert({
      user_id: user.id,
      coin_package_id: pkg.id,
      type: "topup",
      amount: pkg.coin_amount,
      payment_status: "pending",
      payment_reference: orderId,
    })
    .select()
    .single();

  if (txError || !tx) {
    console.error("[topup] insert coin_transactions error:", txError?.message, txError?.code, txError?.details);
    return NextResponse.json(
      { success: false, message: "Gagal membuat transaksi", data: null },
      { status: 500 }
    );
  }

  // Buat Midtrans Snap token
  const serverKey = process.env.MIDTRANS_SERVER_KEY!;
  const authHeader = "Basic " + Buffer.from(serverKey + ":").toString("base64");

  const snapBody = {
    transaction_details: {
      order_id: orderId,
      gross_amount: pkg.price,
    },
    item_details: [
      {
        id: String(pkg.id),
        price: pkg.price,
        quantity: 1,
        name: `${pkg.coin_amount} Coin — ${pkg.name}`,
      },
    ],
    customer_details: {
      first_name: profile?.name ?? "User",
      email: profile?.email ?? user.email,
    },
    callbacks: {
      finish: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/topup/success`,
      error: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/topup/success`,
      pending: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/topup/success`,
    },
  };

  let paymentUrl: string | null = null;
  let snapToken: string | null = null;

  try {
    const snapRes = await fetch(MIDTRANS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(snapBody),
    });

    if (snapRes.ok) {
      const snapJson = await snapRes.json();
      paymentUrl = snapJson.redirect_url ?? null;
      snapToken = snapJson.token ?? null;

      // Update metadata dengan url dan token
      await serviceClient
        .from("coin_transactions")
        .update({
          metadata: { snap_token: snapToken, payment_url: paymentUrl }
        })
        .eq("id", tx.id);
    }
  } catch {
    // Midtrans error — transaksi tetap dibuat (user bisa retry via verify)
  }

  return NextResponse.json({
    success: true,
    message: "Transaksi berhasil dibuat. Lanjutkan ke pembayaran.",
    data: {
      payment_url: paymentUrl,
      snap_token: snapToken,
      transaction: {
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        payment_status: tx.payment_status,
        payment_reference: tx.payment_reference,
        coin_package: pkg,
        metadata: tx.metadata,
        paid_at: tx.paid_at,
        created_at: tx.created_at,
      },
    },
  });
}
