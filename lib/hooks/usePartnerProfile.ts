import { useEffect, useState } from "react";

interface PartnerProfiles {
  my:      { name: string; avatar_url: string | null };
  partner: { name: string; avatar_url: string | null } | null;
}

/**
 * Hook untuk mengambil profil diri sendiri + partner.
 * Dipakai di layar game selesai untuk mengisi ShareResult card.
 *
 * @param enabled - set true saat game sudah selesai (phase==="finished")
 *                  agar fetch tidak berjalan saat masih bermain.
 */
export function usePartnerProfile(enabled: boolean = true) {
  const [profiles, setProfiles] = useState<PartnerProfiles | null>(null);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (!enabled || profiles) return; // sudah ada atau belum waktunya
    let cancelled = false;

    async function fetch_() {
      setLoading(true);
      try {
        const res  = await fetch("/api/user/partner-profile");
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json.success) setProfiles(json.data);
      } catch {
        // non-critical — share image masih bisa dengan inisial
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch_();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { profiles, loading };
}
