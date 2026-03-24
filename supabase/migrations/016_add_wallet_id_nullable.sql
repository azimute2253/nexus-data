-- ============================================================
-- Nexus Data — Migration 016: Add wallet_id FK (nullable)
-- Story 11.2 — Add wallet_id FK to All Data Tables (Step 1/3)
-- Epic 11 — Multi-Wallet Foundation | PRD F-022 | ADR-011
--
-- Safe migration step 1: Add nullable wallet_id + indexes.
-- Reversible: DROP COLUMN wallet_id on each table.
-- ============================================================

-- ── 1. asset_types ──────────────────────────────────────────
ALTER TABLE asset_types
  ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE;

-- ── 2. asset_groups ─────────────────────────────────────────
ALTER TABLE asset_groups
  ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE;

-- ── 3. assets ───────────────────────────────────────────────
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE;

-- ── 4. questionnaires ───────────────────────────────────────
ALTER TABLE questionnaires
  ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE;

-- ── 5. asset_scores ─────────────────────────────────────────
ALTER TABLE asset_scores
  ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE;

-- ── 6. contributions ────────────────────────────────────────
ALTER TABLE contributions
  ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE;

-- ── Composite indexes on (user_id, wallet_id) ───────────────
CREATE INDEX IF NOT EXISTS idx_asset_types_user_wallet     ON asset_types(user_id, wallet_id);
CREATE INDEX IF NOT EXISTS idx_asset_groups_user_wallet    ON asset_groups(user_id, wallet_id);
CREATE INDEX IF NOT EXISTS idx_assets_user_wallet          ON assets(user_id, wallet_id);
CREATE INDEX IF NOT EXISTS idx_questionnaires_user_wallet  ON questionnaires(user_id, wallet_id);
CREATE INDEX IF NOT EXISTS idx_asset_scores_user_wallet    ON asset_scores(user_id, wallet_id);
CREATE INDEX IF NOT EXISTS idx_contributions_user_wallet   ON contributions(user_id, wallet_id);
