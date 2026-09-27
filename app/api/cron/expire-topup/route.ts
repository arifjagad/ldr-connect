import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { cancelOrCreditPendingTopup } from "@/lib/coin/cancel-topup";

/**
 * GET /api/cron/expire-topup
 * Jalan 1x/hari via Vercel Cron (lihat vercel.json).
 *
 * Membatalkan transaksi topup 'pending' yang sudah berumur > 60 menit — dan,
 * PENTING, menutup akses pembayarannya di Midtrans (Snap session + Core API)
 * SEBELUM menandai gagal di DB kita. Tanpa ini, VA/QRIS/Snap page transaksi
 * yang "di-expire" tetap valid dan bisa dibayar user kapan saja (bug yang
 * sama seperti cancel-topup manual sebelum diperbaiki).
 *
 * Race condition: jika user menyelesaikan pembayaran TEPAT sebelum expire
 * diproses, transaksi akan dikreditkan sebagai sukses (bukan digagalkan) —
 * lihat lib/coin/cancel-topup.ts untuk detail lengkap.
 *
 * ⚠️ CATATAN SKALA: Vercel Hobby plan membatasi cron job maksimal 1x/hari
 * (lihat schedule di vercel.json). Artinya transaksi pending yang seharusnya
 * expire di 60 menit bisa "menggantung" sampai ~24 jam sebelum benar-benar
 * dibatalkan, dan kuota voucher (jika dipakai) baru dikembalikan setelah
 * itu. Ini bukan bug, tapi limitasi platform Hobby — jadwal ini WAJIB
 * dipercepat begitu upgrade ke Vercel Pro atau pindah ke VPS dengan cron
 * sendiri. Lihat panduan lengkap & langkah konkretnya di
 * readme/DEPLOYMENT_CRON.md.
 *
 * Ini adalah SATU-SATUNYA pemicu auto-expire sekarang (sebelumnya menumpang
 * di GET /api/coin/transactions setiap kali user membuka halaman riwayat —
 * sudah dihapus karena tidak reliable: user yang tidak pernah balik ke
 * halaman itu membuat transaksinya tidak pernah ter-expire).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: pendingTxs, error } = await serviceClient
    .from("coin_transactions")
    .select("id, user_id, payment_reference, metadata")
    .eq("type", "topup")
    .eq("payment_status", "pending")
    .lt("created_at", cutoff);

  if (error) {
    console.error("[cron/expire-topup] DB error:", error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  let cancelled = 0;
  let creditedAsPaid = 0;
  let failed = 0;

  for (const tx of pendingTxs ?? []) {
    try {
      const snapToken = (tx.metadata as Record<string, unknown> | null)?.snap_token as string | undefined;
      const result = await cancelOrCreditPendingTopup({
        transactionId: tx.id,
        paymentReference: tx.payment_reference,
        userId: tx.user_id,
        snapToken,
      });

      if (!result.ok) {
        console.error(`[cron/expire-topup] gagal proses tx ${tx.id}:`, result.message);
        failed++;
        continue;
      }
      if (result.outcome === "credited_as_paid") {
        creditedAsPaid++;
        console.log(`[cron/expire-topup] tx ${tx.id} ternyata sudah dibayar — coin dikreditkan (race condition tertangani)`);
      } else {
        cancelled++;
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[cron/expire-topup] exception saat proses tx ${tx.id}:`, message);
      failed++;
    }
  }

  console.log(`[cron/expire-topup] Done. cancelled=${cancelled} creditedAsPaid=${creditedAsPaid} failed=${failed}`);

  return NextResponse.json({
    success: true,
    message: "Expire topup selesai",
    data: { cancelled, creditedAsPaid, failed, total: (pendingTxs ?? []).length },
  });
}
