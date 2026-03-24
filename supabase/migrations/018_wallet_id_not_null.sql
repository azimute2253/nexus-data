-- ============================================================
-- Nexus Data — Migration 018: wallet_id NOT NULL + UNIQUE updates
-- Story 11.2 — Add wallet_id FK to All Data Tables (Step 3/3)
-- Epic 11 — Multi-Wallet Foundation | PRD F-022 | ADR-011
--
-- Safe migration step 3: Make wallet_id NOT NULL, update UNIQUE
-- constraints to include wallet_id for multi-wallet isolation.
-- Reversible: ALTER COLUMN DROP NOT NULL + restore old constraints.
-- ============================================================

-- ── 1. Make wallet_id NOT NULL on all 6 tables ──────────────
ALTER TABLE asset_types      ALTER COLUMN wallet_id SET NOT NULL;
ALTER TABLE asset_groups     ALTER COLUMN wallet_id SET NOT NULL;
ALTER TABLE assets           ALTER COLUMN wallet_id SET NOT NULL;
ALTER TABLE questionnaires   ALTER COLUMN wallet_id SET NOT NULL;
ALTER TABLE asset_scores     ALTER COLUMN wallet_id SET NOT NULL;
ALTER TABLE contributions    ALTER COLUMN wallet_id SET NOT NULL;

-- ── 2. Drop old UNIQUE constraints ──────────────────────────
-- asset_types: no explicit unique constraint existed (only PK)
-- asset_groups: unique on (type_id, name, user_id) from migration 012
ALTER TABLE asset_groups
  DROP CONSTRAINT IF EXISTS asset_groups_name_type_user_unique;

-- assets: unique on (ticker, user_id) from migration 010
ALTER TABLE assets
  DROP CONSTRAINT IF EXISTS assets_ticker_user_unique;

-- asset_scores: unique on (asset_id, questionnaire_id) from migration 007
ALTER TABLE asset_scores
  DROP CONSTRAINT IF EXISTS asset_scores_asset_id_questionnaire_id_key;

-- ── 3. Create new UNIQUE constraints including wallet_id ────
-- asset_types: unique name per user per wallet
ALTER TABLE asset_types
  ADD CONSTRAINT asset_types_user_wallet_name_unique
  UNIQUE (user_id, wallet_id, name);

-- asset_groups: unique group name per type per user per wallet
ALTER TABLE asset_groups
  ADD CONSTRAINT asset_groups_type_wallet_name_unique
  UNIQUE (type_id, wallet_id, name, user_id);

-- assets: unique ticker per user per wallet
ALTER TABLE assets
  ADD CONSTRAINT assets_ticker_user_wallet_unique
  UNIQUE (ticker, user_id, wallet_id);

-- asset_scores: unique score per asset per questionnaire per wallet
ALTER TABLE asset_scores
  ADD CONSTRAINT asset_scores_asset_questionnaire_wallet_unique
  UNIQUE (asset_id, questionnaire_id, wallet_id);
