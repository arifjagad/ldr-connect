-- ============================================================
-- Migration 017: Fix select_dare_derby_minigames
--
-- Bug: LIMIT per kategori mengembalikan lebih sedikit game dari yang
-- diminta jika kategori tersebut tidak punya cukup game unik.
-- Contoh: hanya ada 1 brain game (memory_seq), tapi 5-ronde butuh 2 brain
-- → fungsi lama mengembalikan 4 game, bukan 5.
--
-- Fix: gunakan CROSS JOIN LATERAL + random() per slot sehingga game bisa
-- diulang jika stok dalam kategori tidak mencukupi.
-- ============================================================

CREATE OR REPLACE FUNCTION public.select_dare_derby_minigames(p_total_rounds INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reflex_count INTEGER;
  v_brain_count  INTEGER;
  v_skill_count  INTEGER;
  v_result       JSONB;
BEGIN
  CASE p_total_rounds
    WHEN 5  THEN v_reflex_count := 2; v_brain_count := 2; v_skill_count := 1;
    WHEN 7  THEN v_reflex_count := 3; v_brain_count := 2; v_skill_count := 2;
    WHEN 10 THEN v_reflex_count := 4; v_brain_count := 3; v_skill_count := 3;
    ELSE
      RAISE EXCEPTION 'INVALID_ROUND_COUNT'
        USING DETAIL = 'Jumlah ronde harus 5, 7, atau 10';
  END CASE;

  -- Gunakan CROSS JOIN LATERAL agar setiap slot dipilih secara independen.
  -- Ini memungkinkan game yang sama muncul lebih dari sekali jika stok
  -- dalam kategori tidak mencukupi (e.g., hanya 1 brain game).
  WITH
    reflex_pick AS (
      SELECT b.game_id
      FROM generate_series(1, v_reflex_count) AS gs(n)
      CROSS JOIN LATERAL (
        SELECT game_id FROM public.game_minigame_configs
        WHERE category = 'reflex' AND is_active = true
        ORDER BY random() LIMIT 1
      ) b
    ),
    brain_pick AS (
      SELECT b.game_id
      FROM generate_series(1, v_brain_count) AS gs(n)
      CROSS JOIN LATERAL (
        SELECT game_id FROM public.game_minigame_configs
        WHERE category = 'brain' AND is_active = true
        ORDER BY random() LIMIT 1
      ) b
    ),
    skill_pick AS (
      SELECT b.game_id
      FROM generate_series(1, v_skill_count) AS gs(n)
      CROSS JOIN LATERAL (
        SELECT game_id FROM public.game_minigame_configs
        WHERE category = 'skill' AND is_active = true
        ORDER BY random() LIMIT 1
      ) b
    ),
    all_picks AS (
      SELECT game_id FROM reflex_pick
      UNION ALL SELECT game_id FROM brain_pick
      UNION ALL SELECT game_id FROM skill_pick
    )
  SELECT jsonb_agg(game_id ORDER BY random())
  INTO v_result
  FROM all_picks;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
