import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { cancelOrCreditPendingTopup } from "@/lib/coin/cancel-topup";
import { checkRateLimit } from "@/lib/rate-limit";

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

  // Rate limit: defense-in-depth untuk panggilan Midtrans Snap API di bawah
  const rateLimitResponse = await checkRateLimit(user.id, {
    endpoint: "coin/topup",
    maxRequests: 10,
    windowMinutes: 15,
  });
  if (rateLimitResponse) return rateLimitResponse;

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

  // Generate order ID pakai CSPRNG — Math.random() tidak aman untuk payment reference
  const orderId = `TOPUP-${Date.now()}-${randomBytes(4).toString("hex").toUpperCase()}`;

  // Buat transaksi pending + apply voucher diskon (jika ada) secara ATOMIK
  // dalam satu RPC — mencegah voucher hangus permanen jika insert transaksi
  // gagal di tengah jalan (lihat migration 035_atomic_topup_creation.sql).
  const { data: createData, error: createError } = await serviceClient.rpc("create_pending_topup", {
    p_user_id:             user.id,
    p_coin_package_id:     pkg.id,
    p_package_price:       pkg.price,
    p_package_coin_amount: pkg.coin_amount,
    p_payment_reference:   orderId,
    p_voucher_code:        rawVoucherCode,
  });

  if (createError) {
    console.error("[topup] create_pending_topup RPC error:", createError.message);
    return NextResponse.json(
      { success: false, message: "Gagal membuat transaksi", data: null },
      { status: 500 }
    );
  }

  const createResult = createData as {
    success: boolean;
    message?: string;
    transaction?: Record<string, unknown>;
    discount_amount?: number;
    final_price?: number;
  };

  if (!createResult.success) {
    return NextResponse.json(
      { success: false, message: createResult.message ?? "Gagal memproses voucher diskon", data: null },
      { status: 400 }
    );
  }

  const tx = createResult.transaction as {
    id: number; type: string; amount: number; payment_status: string;
    payment_reference: string; metadata: Record<string, unknown> | null;
    paid_at: string | null; created_at: string;
  };
  const discountAmount = createResult.discount_amount ?? 0;
  const finalPrice = createResult.final_price ?? pkg.price;

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
      // Snap API gagal SETELAH tx pending & voucher redemption sudah dibuat
      // (create_pending_topup di atas). Rollback sekarang juga — jangan
      // biarkan user menunggu cron/expire-topup (bisa sampai ~24 jam di
      // Vercel Hobby) untuk mendapatkan kembali kuota vouchernya.
      await rollbackFailedTopup(tx.id, orderId, user.id, request);
      return NextResponse.json(
        { success: false, message: "Gagal terhubung ke layanan pembayaran Midtrans", data: null },
        { status: 502 }
      );
    }
  } catch (fetchErr) {
    console.error("[topup] Midtrans Snap API fetch exception:", fetchErr);
    await rollbackFailedTopup(tx.id, orderId, user.id, request);
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

/**
 * Rollback transaksi topup yang gagal dibuatkan Snap token oleh Midtrans
 * (Window B — lihat migration 035_atomic_topup_creation.sql untuk Window A).
 * Transaksi & voucher redemption sudah terbuat di DB kita (create_pending_topup
 * di atas sukses), tapi belum ada payment_reference yang valid di Midtrans
 * (belum pernah sampai ke Snap API), sehingga aman langsung dibatalkan tanpa
 * perlu cek status Midtrans — panggil cancelOrCreditPendingTopup dengan
 * paymentReference null supaya langsung ke finalisasi RPC (skip Midtrans call).
 * Gagal rollback di sini TIDAK mem-block response error ke user — cron
 * expire-topup tetap jadi jaring pengaman terakhir.
 */
async function rollbackFailedTopup(transactionId: number, orderId: string, userId: string, req: NextRequest) {
  try {
    const result = await cancelOrCreditPendingTopup({
      transactionId,
      paymentReference: null, // belum pernah sampai ke Midtrans, tidak perlu dicek/dibatalkan di sana
      userId,
      req,
    });
    if (!result.ok) {
      console.error(`[topup] rollback gagal untuk tx ${transactionId} (${orderId}):`, result.message);
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[topup] rollback exception untuk tx ${transactionId} (${orderId}):`, message);
  }
}
