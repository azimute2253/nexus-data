-- ============================================================
-- Nexus Data V2 — Deploy Script: Layer 0-1 (Stories 10.1, 11.1, 11.2)
-- Execute this script in Supabase SQL Editor
-- ============================================================
-- IMPORTANT: Run this as a single transaction.
-- If any step fails, entire migration rolls back.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- Migration 015: Create wallets table (Story 11.1)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wallets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  name       TEXT NOT NULL
             CONSTRAINT wallets_name_length
             CHECK (length(trim(name)) >= 1 AND length(name) <= 50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallets_select_own" ON wallets;
CREATE POLICY "wallets_select_own" ON wallets
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "wallets_insert_own" ON wallets;
CREATE POLICY "wallets_insert_own" ON wallets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "wallets_update_own" ON wallets;
CREATE POLICY "wallets_update_own" ON wallets
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "wallets_delete_own" ON wallets;
CREATE POLICY "wallets_delete_own" ON wallets
  FOR DELETE USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- Migration 016: Add wallet_id FK (nullable) + indexes (Story 11.2 Step 1/3)
-- ────────────────────────────────────────────────────────────

ALTER TABLE asset_types
  ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE;

ALTER TABLE asset_groups
  ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE;

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE;

ALTER TABLE questionnaires
  ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE;

ALTER TABLE asset_scores
  ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE;

ALTER TABLE contributions
  ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_asset_types_user_wallet     ON asset_types(user_id, wallet_id);
CREATE INDEX IF NOT EXISTS idx_asset_groups_user_wallet    ON asset_groups(user_id, wallet_id);
CREATE INDEX IF NOT EXISTS idx_assets_user_wallet          ON assets(user_id, wallet_id);
CREATE INDEX IF NOT EXISTS idx_questionnaires_user_wallet  ON questionnaires(user_id, wallet_id);
CREATE INDEX IF NOT EXISTS idx_asset_scores_user_wallet    ON asset_scores(user_id, wallet_id);
CREATE INDEX IF NOT EXISTS idx_contributions_user_wallet   ON contributions(user_id, wallet_id);

-- ────────────────────────────────────────────────────────────
-- Migration 017: Backfill wallet_id (Story 11.2 Step 2/3)
-- ────────────────────────────────────────────────────────────

-- Create default wallet "Minha Carteira" per distinct user_id
INSERT INTO wallets (user_id, name)
SELECT DISTINCT user_id, 'Minha Carteira'
FROM asset_types
WHERE user_id NOT IN (SELECT user_id FROM wallets)
UNION
SELECT DISTINCT user_id, 'Minha Carteira'
FROM asset_groups
WHERE user_id NOT IN (SELECT user_id FROM wallets)
UNION
SELECT DISTINCT user_id, 'Minha Carteira'
FROM assets
WHERE user_id NOT IN (SELECT user_id FROM wallets)
UNION
SELECT DISTINCT user_id, 'Minha Carteira'
FROM questionnaires
WHERE user_id NOT IN (SELECT user_id FROM wallets)
UNION
SELECT DISTINCT user_id, 'Minha Carteira'
FROM asset_scores
WHERE user_id NOT IN (SELECT user_id FROM wallets)
UNION
SELECT DISTINCT user_id, 'Minha Carteira'
FROM contributions
WHERE user_id NOT IN (SELECT user_id FROM wallets)
ON CONFLICT DO NOTHING;

-- Backfill wallet_id on all 6 tables
UPDATE asset_types
SET wallet_id = w.id
FROM wallets w
WHERE asset_types.user_id = w.user_id
  AND w.name = 'Minha Carteira'
  AND asset_types.wallet_id IS NULL;

UPDATE asset_groups
SET wallet_id = w.id
FROM wallets w
WHERE asset_groups.user_id = w.user_id
  AND w.name = 'Minha Carteira'
  AND asset_groups.wallet_id IS NULL;

UPDATE assets
SET wallet_id = w.id
FROM wallets w
WHERE assets.user_id = w.user_id
  AND w.name = 'Minha Carteira'
  AND assets.wallet_id IS NULL;

UPDATE questionnaires
SET wallet_id = w.id
FROM wallets w
WHERE questionnaires.user_id = w.user_id
  AND w.name = 'Minha Carteira'
  AND questionnaires.wallet_id IS NULL;

UPDATE asset_scores
SET wallet_id = w.id
FROM wallets w
WHERE asset_scores.user_id = w.user_id
  AND w.name = 'Minha Carteira'
  AND asset_scores.wallet_id IS NULL;

UPDATE contributions
SET wallet_id = w.id
FROM wallets w
WHERE contributions.user_id = w.user_id
  AND w.name = 'Minha Carteira'
  AND contributions.wallet_id IS NULL;

-- ────────────────────────────────────────────────────────────
-- Migration 018: Make wallet_id NOT NULL + update UNIQUE (Story 11.2 Step 3/3)
-- ────────────────────────────────────────────────────────────

ALTER TABLE asset_types      ALTER COLUMN wallet_id SET NOT NULL;
ALTER TABLE asset_groups     ALTER COLUMN wallet_id SET NOT NULL;
ALTER TABLE assets           ALTER COLUMN wallet_id SET NOT NULL;
ALTER TABLE questionnaires   ALTER COLUMN wallet_id SET NOT NULL;
ALTER TABLE asset_scores     ALTER COLUMN wallet_id SET NOT NULL;
ALTER TABLE contributions    ALTER COLUMN wallet_id SET NOT NULL;

-- Drop old UNIQUE constraints
ALTER TABLE asset_groups
  DROP CONSTRAINT IF EXISTS asset_groups_name_type_user_unique;

ALTER TABLE assets
  DROP CONSTRAINT IF EXISTS assets_ticker_user_unique;

ALTER TABLE asset_scores
  DROP CONSTRAINT IF EXISTS asset_scores_asset_id_questionnaire_id_key;

-- Create new UNIQUE constraints including wallet_id
ALTER TABLE asset_types
  ADD CONSTRAINT asset_types_user_wallet_name_unique
  UNIQUE (user_id, wallet_id, name);

ALTER TABLE asset_groups
  ADD CONSTRAINT asset_groups_type_wallet_name_unique
  UNIQUE (type_id, wallet_id, name, user_id);

ALTER TABLE assets
  ADD CONSTRAINT assets_ticker_user_wallet_unique
  UNIQUE (ticker, user_id, wallet_id);

ALTER TABLE asset_scores
  ADD CONSTRAINT asset_scores_asset_questionnaire_wallet_unique
  UNIQUE (asset_id, questionnaire_id, wallet_id);

COMMIT;

-- ────────────────────────────────────────────────────────────
-- Validation queries (run AFTER commit)
-- ────────────────────────────────────────────────────────────

-- Check wallets table exists
-- SELECT COUNT(*) FROM wallets;

-- Check wallet_id exists on all 6 tables
-- SELECT COUNT(*) FROM asset_types WHERE wallet_id IS NULL;
-- SELECT COUNT(*) FROM asset_groups WHERE wallet_id IS NULL;
-- SELECT COUNT(*) FROM assets WHERE wallet_id IS NULL;
-- SELECT COUNT(*) FROM questionnaires WHERE wallet_id IS NULL;
-- SELECT COUNT(*) FROM asset_scores WHERE wallet_id IS NULL;
-- SELECT COUNT(*) FROM contributions WHERE wallet_id IS NULL;
-- All should return 0

-- Check default wallets created
-- SELECT user_id, name, created_at FROM wallets ORDER BY created_at;
