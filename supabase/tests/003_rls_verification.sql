-- ============================================================
-- Nexus Data — RLS Verification Tests
-- Story 1.2 — Validates RLS policies on all 8 tables.
--
-- Run against Supabase SQL Editor or via supabase db test.
-- These queries verify the RLS configuration is correct.
-- ============================================================

-- ─── T1.2.0: Verify RLS is enabled on all 8 tables ─────────
-- Expected: 8 rows, all with rowsecurity = true
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'asset_types', 'asset_groups', 'assets', 'price_cache',
    'questionnaires', 'asset_scores', 'contributions', 'exchange_rates'
  )
ORDER BY tablename;

-- ─── T1.2.0b: Verify all 32 policies exist (4 per table) ──
-- Expected: 32 rows
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'asset_types', 'asset_groups', 'assets', 'price_cache',
    'questionnaires', 'asset_scores', 'contributions', 'exchange_rates'
  )
ORDER BY tablename, cmd;

-- ─── T1.2.1: Anon key query returns empty (no session) ─────
-- Run this as anon role (no auth.uid() set).
-- Expected: 0 rows from every table.
-- NOTE: Execute via Supabase client with anon key (no session).
--
-- Pseudocode (JS client):
--   const { data } = await supabase.from('asset_types').select('*')
--   assert(data.length === 0)

-- ─── T1.2.2: Authenticated user sees only own rows ─────────
-- Set role to authenticated and set auth.uid() to test user.
-- Expected: Only rows with matching user_id.
--
-- SET LOCAL role TO authenticated;
-- SET LOCAL request.jwt.claims TO '{"sub": "<test-user-uuid>"}';
-- SELECT * FROM assets;  -- should return only that user's assets

-- ─── T1.2.3: INSERT with mismatched user_id is rejected ────
-- Expected: RLS violation error (42501)
--
-- SET LOCAL role TO authenticated;
-- SET LOCAL request.jwt.claims TO '{"sub": "user-a-uuid"}';
-- INSERT INTO assets (ticker, name, group_id, user_id)
--   VALUES ('TEST', 'Test', '<valid-group-id>', 'user-b-uuid');
-- ERROR: new row violates row-level security policy

-- ─── T1.2.4: Service role bypasses RLS ─────────────────────
-- Execute via Supabase client with service_role key.
-- Expected: UPSERT succeeds regardless of user_id match.
--
-- Pseudocode (JS client with service role):
--   const { data, error } = await supabaseAdmin
--     .from('price_cache')
--     .upsert({ ticker: 'TEST', price: 100, user_id: '<any-uuid>' })
--   assert(error === null)

-- ─── T1.2.5: Policy audit — all policies use auth.uid() ────
-- Expected: All qual/with_check expressions reference auth.uid()
SELECT
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'asset_types', 'asset_groups', 'assets', 'price_cache',
    'questionnaires', 'asset_scores', 'contributions', 'exchange_rates'
  )
ORDER BY tablename, policyname;
