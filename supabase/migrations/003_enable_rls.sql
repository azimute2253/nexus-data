-- ============================================================
-- Nexus Data — Migration 003
-- Enables Row Level Security (RLS) on all 8 tables and creates
-- per-table policies scoped to auth.uid() = user_id.
--
-- Story 1.2 — RLS Policies  |  PRD F-008 AC2  |  ADR-007
-- Idempotent: DROP POLICY IF EXISTS before CREATE.
--
-- Notes:
--   • Service role key (used by Edge Functions / cron) bypasses
--     RLS automatically — no extra policy required.
--   • The portfolio_summary VIEW inherits RLS from its base
--     tables, so no separate policy is needed.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. asset_types
-- ────────────────────────────────────────────────────────────
ALTER TABLE asset_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asset_types_select_own" ON asset_types;
CREATE POLICY "asset_types_select_own" ON asset_types
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "asset_types_insert_own" ON asset_types;
CREATE POLICY "asset_types_insert_own" ON asset_types
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "asset_types_update_own" ON asset_types;
CREATE POLICY "asset_types_update_own" ON asset_types
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "asset_types_delete_own" ON asset_types;
CREATE POLICY "asset_types_delete_own" ON asset_types
  FOR DELETE USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 2. asset_groups
-- ────────────────────────────────────────────────────────────
ALTER TABLE asset_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asset_groups_select_own" ON asset_groups;
CREATE POLICY "asset_groups_select_own" ON asset_groups
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "asset_groups_insert_own" ON asset_groups;
CREATE POLICY "asset_groups_insert_own" ON asset_groups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "asset_groups_update_own" ON asset_groups;
CREATE POLICY "asset_groups_update_own" ON asset_groups
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "asset_groups_delete_own" ON asset_groups;
CREATE POLICY "asset_groups_delete_own" ON asset_groups
  FOR DELETE USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 3. assets
-- ────────────────────────────────────────────────────────────
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assets_select_own" ON assets;
CREATE POLICY "assets_select_own" ON assets
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "assets_insert_own" ON assets;
CREATE POLICY "assets_insert_own" ON assets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "assets_update_own" ON assets;
CREATE POLICY "assets_update_own" ON assets
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "assets_delete_own" ON assets;
CREATE POLICY "assets_delete_own" ON assets
  FOR DELETE USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 4. price_cache
--    Service role (Edge Function cron) bypasses RLS for UPSERT.
-- ────────────────────────────────────────────────────────────
ALTER TABLE price_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "price_cache_select_own" ON price_cache;
CREATE POLICY "price_cache_select_own" ON price_cache
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "price_cache_insert_own" ON price_cache;
CREATE POLICY "price_cache_insert_own" ON price_cache
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "price_cache_update_own" ON price_cache;
CREATE POLICY "price_cache_update_own" ON price_cache
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "price_cache_delete_own" ON price_cache;
CREATE POLICY "price_cache_delete_own" ON price_cache
  FOR DELETE USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 5. questionnaires
-- ────────────────────────────────────────────────────────────
ALTER TABLE questionnaires ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "questionnaires_select_own" ON questionnaires;
CREATE POLICY "questionnaires_select_own" ON questionnaires
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "questionnaires_insert_own" ON questionnaires;
CREATE POLICY "questionnaires_insert_own" ON questionnaires
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "questionnaires_update_own" ON questionnaires;
CREATE POLICY "questionnaires_update_own" ON questionnaires
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "questionnaires_delete_own" ON questionnaires;
CREATE POLICY "questionnaires_delete_own" ON questionnaires
  FOR DELETE USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 6. asset_scores
-- ────────────────────────────────────────────────────────────
ALTER TABLE asset_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asset_scores_select_own" ON asset_scores;
CREATE POLICY "asset_scores_select_own" ON asset_scores
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "asset_scores_insert_own" ON asset_scores;
CREATE POLICY "asset_scores_insert_own" ON asset_scores
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "asset_scores_update_own" ON asset_scores;
CREATE POLICY "asset_scores_update_own" ON asset_scores
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "asset_scores_delete_own" ON asset_scores;
CREATE POLICY "asset_scores_delete_own" ON asset_scores
  FOR DELETE USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 7. contributions
-- ────────────────────────────────────────────────────────────
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contributions_select_own" ON contributions;
CREATE POLICY "contributions_select_own" ON contributions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "contributions_insert_own" ON contributions;
CREATE POLICY "contributions_insert_own" ON contributions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "contributions_update_own" ON contributions;
CREATE POLICY "contributions_update_own" ON contributions
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "contributions_delete_own" ON contributions;
CREATE POLICY "contributions_delete_own" ON contributions
  FOR DELETE USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 8. exchange_rates
--    Service role (Edge Function cron) bypasses RLS for UPSERT.
-- ────────────────────────────────────────────────────────────
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exchange_rates_select_own" ON exchange_rates;
CREATE POLICY "exchange_rates_select_own" ON exchange_rates
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "exchange_rates_insert_own" ON exchange_rates;
CREATE POLICY "exchange_rates_insert_own" ON exchange_rates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "exchange_rates_update_own" ON exchange_rates;
CREATE POLICY "exchange_rates_update_own" ON exchange_rates
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "exchange_rates_delete_own" ON exchange_rates;
CREATE POLICY "exchange_rates_delete_own" ON exchange_rates
  FOR DELETE USING (auth.uid() = user_id);
