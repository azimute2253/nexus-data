-- ============================================================
-- Nexus Data — Migration 017: Backfill wallet_id
-- Story 11.2 — Add wallet_id FK to All Data Tables (Step 2/3)
-- Epic 11 — Multi-Wallet Foundation | PRD F-022 | ADR-011
--
-- Safe migration step 2: Create default wallet per user_id,
-- then populate wallet_id on all 6 tables.
-- Reversible: SET wallet_id = NULL on all tables + delete default wallets.
-- ============================================================

-- ── 1. Create default wallet "Minha Carteira" per distinct user_id ──
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

-- ── 2. Backfill wallet_id on all 6 tables ───────────────────
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
