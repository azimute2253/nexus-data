-- ============================================================
-- Nexus Data — Migration 015
-- Creates the `wallets` table with RLS policies for multi-wallet
-- architecture (V2).
--
-- Story 11.1 — Create wallets Table with RLS
-- Epic 11 — Multi-Wallet Foundation | PRD F-022 | ADR-010
-- Idempotent: IF NOT EXISTS on table, drop-before-create on policies
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Create table
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  name       TEXT NOT NULL
             CONSTRAINT wallets_name_length
             CHECK (length(trim(name)) >= 1 AND length(name) <= 50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 2. Enable RLS
-- ────────────────────────────────────────────────────────────
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- 3. RLS policies (auth.uid() = user_id)
-- ────────────────────────────────────────────────────────────
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
