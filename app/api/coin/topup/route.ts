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
  let body: { coin_package_id?: number; voucher_code?: string };
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

  const rawVoucherCode = typeof body.voucher_code === "string"
    ? body.voucher_code.trim().toUpperCase()
    : null;

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

  // Terapkan voucher diskon jika ada
  let discountAmount = 0;
  let discountRedemptionId: number | null = null;
  if (rawVoucherCode) {
    const { data: discountData, error: discountError } = await serviceClient.rpc(
      "apply_topup_discount",
      { p_user_id: user.id, p_code: rawVoucherCode, p_purchase_amount: pkg.price }
    );

    if (discountError) {
      console.error("[topup] apply_topup_discount error:", discountError.message);
      return NextResponse.json(
        { success: false, message: "Gagal memproses voucher diskon", data: null },
        { status: 500 }
      );
    }

    const discountResult = discountData as {
      success: boolean;
      message: string;
      discount_amount?: number;
      redemption_id?: number;
    };

    if (!discountResult.success) {
      return NextResponse.json(
        { success: false, message: discountResult.message, data: null },
        { status: 400 }
      );
    }

    discountAmount      = discountResult.discount_amount ?? 0;
    discountRedemptionId = discountResult.redemption_id ?? null;
  }

  const finalPrice = Math.max(pkg.price - discountAmount, 1000); // minimum Rp1.000 (Midtrans limit)

  // Generate order ID pakai CSPRNG — Math.random() tidak aman untuk payment reference
  const orderId = `TOPUP-${Date.now()}-${randomBytes(4).toString("hex").toUpperCase()}`;

  // Insert coin_transaction (pending) dengan service client untuk bypass RLS
  const txMetadata = discountAmount > 0
    ? {
        voucher_code:    rawVoucherCode,
        discount_amount: discountAmount,
        original_price:  pkg.price,
        final_price:     finalPrice,
      }
    : null;

  const { data: tx, error: txError } = await serviceClient
    .from("coin_transactions")
    .insert({
      user_id:           user.id,
      coin_package_id:   pkg.id,
      type:              "topup",
      amount:            pkg.coin_amount,
      payment_status:    "pending",
      payment_reference: orderId,
      metadata:          txMetadata,
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

  // Hubungkan voucher_redemption dengan coin_transaction yang baru dibuat
  if (discountRedemptionId) {
    await serviceClient
      .from("voucher_redemptions")
      .update({ coin_transaction_id: tx.id })
      .eq("id", discountRedemptionId);
  }

  // Buat Midtrans Snap token
  const serverKey = process.env.MIDTRANS_SERVER_KEY!;
  const authHeader = "Basic " + Buffer.from(serverKey + ":").toString("base64");

  const snapBody = {
    transaction_details: {
      order_id:     orderId,
      gross_amount: finalPrice,
    },
    item_details: discountAmount > 0
      ? [
          {
            id:       String(pkg.id),
            price:    pkg.price,
            quantity: 1,
            name:     `${pkg.coin_amount} Coin — ${pkg.name}`,
          },
          {
            id:       `VOUCHER-${rawVoucherCode}`,
            price:    -discountAmount,
            quantity: 1,
            name:     `Diskon Voucher (${rawVoucherCode})`,
          },
        ]
      : [
          {
            id:       String(pkg.id),
            price:    pkg.price,
            quantity: 1,
            name:     `${pkg.coin_amount} Coin — ${pkg.name}`,
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
    } else {
      const errText = await snapRes.text().catch(() => "");
      console.error("[topup] Midtrans Snap API HTTP error:", snapRes.status, errText);
      return NextResponse.json(
        { success: false, message: "Gagal terhubung ke layanan pembayaran Midtrans", data: null },
        { status: 502 }
      );
    }
  } catch (fetchErr) {
    console.error("[topup] Midtrans Snap API fetch exception:", fetchErr);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan jaringan ke layanan pembayaran", data: null },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Transaksi berhasil dibuat. Lanjutkan ke pembayaran.",
    data: {
      payment_url:     paymentUrl,
      snap_token:      snapToken,
      discount_amount: discountAmount > 0 ? discountAmount : null,
      final_price:     finalPrice,
      transaction: {
        id:                tx.id,
        type:              tx.type,
        amount:            tx.amount,
        payment_status:    tx.payment_status,
        payment_reference: tx.payment_reference,
        coin_package:      pkg,
        metadata:          tx.metadata,
        paid_at:           tx.paid_at,
        created_at:        tx.created_at,
      },
    },
  });
}
