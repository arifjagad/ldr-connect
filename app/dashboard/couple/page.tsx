"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthUser } from "@/lib/types";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#9B93B0] transition hover:border-[#FF3D7F]/40 hover:bg-[#FF3D7F]/10 hover:text-[#FF6B9D]"
    >
      {copied ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy Code
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
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setInitialLoading(true);
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
      } finally {
        setInitialLoading(false);
      }
    }
    load();
  }, []);

  async function handleLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    setLoading(true); setError(null); setStatus(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("link_couple", {
      p_user_id: userId,
      p_couple_code: inputCode.trim().toUpperCase(),
    });

    if (rpcError) {
      setError(rpcError.message.includes("INVALID_CODE")
        ? "Couple code tidak ditemukan"
        : rpcError.message.includes("ALREADY_LINKED")
        ? "Kamu sudah terhubung dengan partner"
        : rpcError.message.includes("PARTNER_ALREADY_LINKED")
        ? "Kode ini sudah dipakai oleh orang lain"
        : rpcError.message);
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

    setStatus("Berhasil terhubung dengan partner!");
    setInputCode("");
    setLoading(false);
  }

  async function handleUnlink() {
    if (!userId) return;
    setLoading(true); setError(null); setStatus(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("unlink_couple", {
      p_user_id: userId,
    });

    if (rpcError) { setError(rpcError.message); setLoading(false); return; }

    setPartner(null);
    setConfirmUnlink(false);
    setStatus("Partner berhasil dilepas.");

    // Update store
    const meRes = await fetch("/api/auth/me");
    if (meRes.ok) { const j = await meRes.json(); setUser(j.data); }

    setLoading(false);
  }

  const isLinked = !!partner;

  return (
    <main className="relative mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full blur-[120px]"
        style={{ background: "radial-gradient(ellipse, rgba(129,140,248,0.10) 0%, transparent 70%)" }}
      />

      {/* Header */}
      <div className="mb-10">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#5C5470]">Dashboard / Couple</p>
        <h1 className="mt-2 text-2xl sm:text-4xl font-bold tracking-tight text-[#FFF5F8]">
          Couple{" "}
          <span style={{ backgroundImage: "linear-gradient(90deg, #818CF8, #A78BFA)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Connection
          </span>
        </h1>
        <p className="mt-2 text-sm text-[#5C5470]">Hubungkan akun kamu ke partner menggunakan couple code.</p>
      </div>

      {/* Your code card */}
      <div className="mb-4 overflow-hidden rounded-2xl border border-[#818CF8]/20 bg-linear-to-br from-[#818CF8]/10 to-transparent p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-[#5C5470]">Couple Code Kamu</p>
            {initialLoading ? (
              <div className="mt-3 h-10 w-44 animate-pulse rounded-xl bg-white/10" />
            ) : (
              <p className="mt-3 font-mono text-3xl md:text-4xl font-bold tracking-[0.15em] text-[#A78BFA]">
                {myCode || "——————"}
              </p>
            )}
            <p className="mt-2 text-xs text-[#5C5470]">Bagikan ke partner agar bisa terhubung denganmu.</p>
          </div>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#818CF8]/15">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="1.8">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" strokeLinecap="round" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" strokeLinecap="round" />
            </svg>
          </div>
        </div>
        {!initialLoading && myCode ? (
          <div className="mt-4">
            <CopyButton text={myCode} />
          </div>
        ) : null}
      </div>

      {/* Partner card */}
      <div className="mb-4 rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
        <p className="text-xs font-medium uppercase tracking-widest text-[#5C5470]">Partner Saat Ini</p>

        {initialLoading ? (
          <div className="mt-4 flex items-center gap-4 animate-pulse">
            <div className="h-14 w-14 rounded-2xl bg-white/10" />
            <div className="space-y-2">
              <div className="h-5 w-36 rounded bg-white/10" />
              <div className="h-3 w-48 rounded bg-white/5" />
            </div>
          </div>
        ) : isLinked && partner ? (
          <div className="mt-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-[#FF3D7F]/30 to-[#818CF8]/30 text-2xl font-bold text-[#FFF5F8]">
                {partner.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-lg font-semibold text-[#FFF5F8]">{partner.name}</p>
                <p className="text-sm text-[#5C5470]">{partner.email}</p>
                <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-[#34D399]/25 bg-[#34D399]/10 px-2.5 py-0.5 text-xs font-medium text-[#34D399]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#34D399] shadow-[0_0_6px_#34D399]" />
                  Terhubung
                </span>
              </div>
            </div>

            <div className="mt-6 border-t border-white/6 pt-5">
              {!confirmUnlink ? (
                <button
                  type="button"
                  onClick={() => setConfirmUnlink(true)}
                  className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-400 transition hover:border-red-500/40 hover:bg-red-500/20"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                  Putuskan Partner
                </button>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <p className="text-sm text-[#9B93B0]">Yakin ingin memutuskan hubungan dengan <strong className="text-[#FFF5F8]">{partner.name}</strong>?</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleUnlink}
                      disabled={loading}
                      className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-60"
                    >
                      {loading ? "Memutuskan..." : "Ya, Putuskan"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmUnlink(false)}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#9B93B0] transition hover:bg-white/10"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/3 text-[#5C5470]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-[#9B93B0]">Belum ada partner</p>
              <p className="text-sm text-[#5C5470]">Masukkan couple code partner di bawah</p>
            </div>
          </div>
        )}
      </div>

      {/* Link form */}
      {!isLinked && (
        <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
          <p className="text-xs font-medium uppercase tracking-widest text-[#5C5470]">Hubungkan Partner</p>
          <p className="mt-1 text-sm text-[#5C5470]">Minta couple code dari pasanganmu, lalu masukkan di sini.</p>

          <form className="mt-5 space-y-4" onSubmit={handleLink}>
            <div>
              <label className="block text-xs font-medium text-[#9B93B0]" htmlFor="couple-code-input">
                Couple Code Partner
              </label>
              <div className="mt-2 flex gap-3">
                <input
                  id="couple-code-input"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  className="flex-1 rounded-xl border border-white/10 bg-[#18181C] px-4 py-3 font-mono text-sm tracking-widest text-[#FFF5F8] outline-none placeholder:text-[#5C5470] focus:border-[#818CF8]/50 focus:ring-1 focus:ring-[#818CF8]/30 transition"
                  placeholder="EXAMPLECODE"
                  maxLength={10}
                  required
                />
                <button
                  type="submit"
                  disabled={loading || inputCode.trim().length < 6}
                  className="flex items-center gap-2 rounded-xl bg-[#818CF8] px-5 py-3 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(129,140,248,0.3)] transition hover:bg-[#A78BFA] disabled:cursor-not-allowed disabled:opacity-50"
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
                  {loading ? "Menghubungkan..." : "Link"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Feedback */}
      {status ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#34D399]/20 bg-[#34D399]/10 px-4 py-3 text-sm text-[#34D399]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {status}
        </div>
      ) : null}
      {error ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      ) : null}
    </main>
  );
}
