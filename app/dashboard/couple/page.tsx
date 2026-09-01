"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/components/ui/Toast";
import { dialog } from "@/components/ui/Dialog";
import type { AuthUser } from "@/lib/types";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Tersalin!", "Couple code berhasil disalin ke clipboard.");
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-2 rounded-xl border border-[#E7E5E4] bg-white px-4 py-2 text-xs font-semibold text-[#1F1D1B] transition hover:border-[#C84B31] hover:text-[#C84B31] shadow-xs cursor-pointer"
    >
      {copied ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Tersalin!
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Salin Kode
        </>
      )}
    </button>
  );
}

export default function CouplePage() {
  const { setUser } = useAuthStore();

  const [userId, setUserId] = useState<string | null>(null);
  const [myCode, setMyCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [partner, setPartner] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("users")
        .select("couple_code, partner_id")
        .eq("id", user.id)
        .single();

      if (!profile) return;
      setMyCode(profile.couple_code ?? "");

      if (profile.partner_id) {
        const { data: partnerData } = await supabase
          .from("users")
          .select("*, wallets(balance)")
          .eq("id", profile.partner_id)
          .single();

        if (partnerData) {
          const pw = partnerData.wallets as { balance: number } | null;
          setPartner({
            id: partnerData.id,
            name: partnerData.name,
            email: partnerData.email,
            couple_code: partnerData.couple_code,
            partner_id: partnerData.partner_id,
            status: partnerData.status,
            is_admin: partnerData.is_admin ?? false,
            wallet_balance: pw?.balance ?? 0,
            created_at: partnerData.created_at,
            avatar_url: partnerData.avatar_url ?? null,
          });
        }
      }
    }
    load();
  }, []);

  async function handleLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    setLoading(true);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("link_couple", {
      p_user_id: userId,
      p_couple_code: inputCode.trim().toUpperCase(),
    });

    if (rpcError) {
      const msg = rpcError.message.includes("INVALID_CODE")
        ? "Couple code tidak ditemukan"
        : rpcError.message.includes("ALREADY_LINKED")
        ? "Kamu sudah terhubung dengan partner"
        : rpcError.message.includes("PARTNER_ALREADY_LINKED")
        ? "Kode ini sudah dipakai oleh orang lain"
        : rpcError.message;
      toast.error("Gagal Terhubung", msg);
      setLoading(false);
      return;
    }

    // Reload partner info
    const { data: partnerData } = await supabase
      .from("users")
      .select("*, wallets(balance)")
      .neq("id", userId)
      .eq("couple_code", inputCode.trim().toUpperCase())
      .single();

    if (partnerData) {
      const pw = partnerData.wallets as { balance: number } | null;
      setPartner({
        id: partnerData.id, name: partnerData.name, email: partnerData.email,
        couple_code: partnerData.couple_code, partner_id: partnerData.partner_id,
        status: partnerData.status, is_admin: partnerData.is_admin ?? false,
        wallet_balance: pw?.balance ?? 0, created_at: partnerData.created_at,
        avatar_url: partnerData.avatar_url ?? null,
      });
    }

    // Update store
    const meRes = await fetch("/api/auth/me");
    if (meRes.ok) { const j = await meRes.json(); setUser(j.data); }

    toast.success("Berhasil Terhubung!", "Akun kalian sekarang saling tersambung.");
    setInputCode("");
    setLoading(false);
  }

  async function handleUnlink() {
    if (!userId || !partner) return;

    const confirmed = await dialog.confirm({
      title: "Putuskan Hubungan?",
      description: `Apakah kamu yakin ingin memutuskan hubungan dengan ${partner.name}? Data sesi dan sinkronisasi bersama akan terputus.`,
      confirmText: "Ya, Putuskan",
      cancelText: "Batal",
      isDanger: true,
    });

    if (!confirmed) return;

    setLoading(true);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("unlink_couple", {
      p_user_id: userId,
    });

    if (rpcError) {
      toast.error("Gagal Memutuskan", rpcError.message);
      setLoading(false);
      return;
    }

    setPartner(null);
    toast.info("Hubungan Diputus", "Akun partner berhasil dilepas.");

    // Update store
    const meRes = await fetch("/api/auth/me");
    if (meRes.ok) { const j = await meRes.json(); setUser(j.data); }

    setLoading(false);
  }

  const isLinked = !!partner;

  return (
    <main className="relative mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#E7E5E4] bg-[#FDF4F2] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#C84B31]">
          <span>♥</span>
          <span>Koneksi Pasangan</span>
        </div>
        <h1 className="mt-3 font-serif text-3xl sm:text-4xl text-[#1F1D1B] tracking-tight">
          Couple Connection
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-[#78716C]">
          Hubungkan akun kamu ke partner menggunakan kode unik pasangan untuk sinkronisasi permainan, koin, dan wishlist.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Your code card */}
        <div className="rounded-2xl border border-[#E7E5E4] bg-white p-6 sm:p-8 shadow-xl shadow-black/[0.02] flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#78716C]">Couple Code Kamu</p>
                <p className="mt-4 font-mono text-3xl sm:text-4xl font-bold tracking-[0.2em] text-[#C84B31]">
                  {myCode || "——————"}
                </p>
              </div>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FDF4F2] text-[#C84B31] border border-[#E7E5E4]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" strokeLinecap="round" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" strokeLinecap="round" />
                </svg>
              </div>
            </div>
            <p className="mt-3 text-xs text-[#78716C]">
              Bagikan kode unik ini ke pasanganmu agar akun kalian saling terhubung.
            </p>
          </div>

          {myCode ? (
            <div className="mt-6 pt-6 border-t border-[#F5F5F4]">
              <CopyButton text={myCode} />
            </div>
          ) : null}
        </div>

        {/* Partner card */}
        <div className="rounded-2xl border border-[#E7E5E4] bg-white p-6 sm:p-8 shadow-xl shadow-black/[0.02] flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#78716C]">Status Partner</p>

            {isLinked && partner ? (
              <div className="mt-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FDF4F2] border border-[#E7E5E4] text-xl font-serif font-bold text-[#C84B31]">
                    {partner.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-base font-bold text-[#1F1D1B]">{partner.name}</p>
                    <p className="text-xs text-[#78716C]">{partner.email}</p>
                    <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#10B981]/20 bg-[#EBF9EB] px-2.5 py-0.5 text-[10px] font-semibold text-[#10B981]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                      Terhubung Aktif
                    </span>
                  </div>
                </div>

                <div className="mt-6 border-t border-[#F5F5F4] pt-5">
                  <button
                    type="button"
                    onClick={handleUnlink}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50/50 px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100/50 cursor-pointer disabled:opacity-50"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                    {loading ? "Memproses..." : "Putuskan Hubungan"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-dashed border-[#E7E5E4] bg-[#FCFBF7] text-[#A8A29E]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#1F1D1B]">Belum Terhubung</p>
                  <p className="text-xs text-[#78716C] mt-0.5">Masukkan couple code partner untuk mulai tersambung.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Link form */}
      {!isLinked && (
        <div className="mt-6 rounded-2xl border border-[#E7E5E4] bg-white p-6 sm:p-8 shadow-xl shadow-black/[0.02]">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#78716C]">Hubungkan Partner Baru</h2>
          <p className="mt-1 text-xs text-[#78716C]">Masukkan couple code 6–10 digit yang didapat dari akun pasanganmu.</p>

          <form className="mt-5 max-w-xl space-y-4" onSubmit={handleLink}>
            <div>
              <label className="block text-xs font-semibold text-[#1F1D1B]" htmlFor="couple-code-input">
                Couple Code Pasangan
              </label>
              <div className="mt-2 flex gap-3">
                <input
                  id="couple-code-input"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  className="flex-1 rounded-xl border border-[#E7E5E4] bg-[#FCFBF7] px-4 py-2.5 font-mono text-xs font-bold tracking-widest text-[#1F1D1B] outline-none placeholder:text-[#A8A29E] focus:border-[#C84B31] focus:bg-white transition"
                  placeholder="KODE PASANGAN"
                  maxLength={10}
                  required
                />
                <button
                  type="submit"
                  disabled={loading || inputCode.trim().length < 6}
                  className="flex items-center gap-2 rounded-xl bg-[#C84B31] px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#B33E26] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                  )}
                  {loading ? "Menghubungkan..." : "Hubungkan"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
