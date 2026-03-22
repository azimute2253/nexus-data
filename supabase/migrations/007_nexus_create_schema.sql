-- ============================================================
-- Nexus Data — Schema Migration 001
-- Creates 8 tables + 1 view for the portfolio rebalancing app.
-- Idempotent: safe to re-run (IF NOT EXISTS on all objects).
-- ============================================================

-- 1. asset_types — 10 asset classes with target allocation %
CREATE TABLE IF NOT EXISTS asset_types (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  target_pct NUMERIC(5,2),
  sort_order INTEGER,
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. asset_groups — groups within each asset type
CREATE TABLE IF NOT EXISTS asset_groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id         UUID NOT NULL REFERENCES asset_types(id) ON DELETE CASCADE,
  name            TEXT,
  target_pct      NUMERIC(5,2),
  scoring_method  TEXT DEFAULT 'questionnaire',
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. assets — individual assets (131+)
CREATE TABLE IF NOT EXISTS assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker          TEXT NOT NULL,
  name            TEXT,
  sector          TEXT,
  quantity        NUMERIC(15,6) NOT NULL DEFAULT 0,
  group_id        UUID NOT NULL REFERENCES asset_groups(id) ON DELETE CASCADE,
  price_source    TEXT DEFAULT 'brapi'
                  CHECK (price_source IN ('brapi', 'yahoo', 'manual', 'crypto', 'exchange')),
  is_active       BOOLEAN DEFAULT true,
  manual_override BOOLEAN DEFAULT false,
  whole_shares    BOOLEAN DEFAULT true,
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. price_cache — cached quotes with TTL (UPSERT via ON CONFLICT ticker)
CREATE TABLE IF NOT EXISTS price_cache (
  ticker      TEXT PRIMARY KEY,
  price       NUMERIC(15,4),
  currency    TEXT DEFAULT 'BRL',
  source      TEXT,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id     UUID NOT NULL REFERENCES auth.users(id)
);

-- 5. questionnaires — scoring questionnaires per asset type
CREATE TABLE IF NOT EXISTS questionnaires (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT,
  asset_type_id UUID REFERENCES asset_types(id),
  questions     JSONB NOT NULL DEFAULT '[]'::jsonb,
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. asset_scores — per-asset scoring answers
CREATE TABLE IF NOT EXISTS asset_scores (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id         UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  questionnaire_id UUID NOT NULL REFERENCES questionnaires(id),
  answers          JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_score      INTEGER DEFAULT 0,
  user_id          UUID NOT NULL REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asset_id, questionnaire_id)
);

-- 7. contributions — aporte history (Phase 3)
CREATE TABLE IF NOT EXISTS contributions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contributed_at TIMESTAMPTZ,
  amount         NUMERIC(15,2),
  distribution   JSONB,
  user_id        UUID NOT NULL REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. exchange_rates — cached FX rates (e.g. USD/BRL, BTC/BRL)
CREATE TABLE IF NOT EXISTS exchange_rates (
  pair       TEXT PRIMARY KEY,
  rate       NUMERIC(15,6),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id    UUID NOT NULL REFERENCES auth.users(id)
);

-- 9. portfolio_summary — aggregated value per asset type
--    Regular VIEW (not materialized) — Supabase free tier has no cron for REFRESH.
--    JOINs assets + price_cache + exchange_rates per ADR-005.
CREATE OR REPLACE VIEW portfolio_summary AS
SELECT
  at.id                AS asset_type_id,
  at.name              AS asset_type_name,
  at.target_pct,
  at.user_id,
  COALESCE(SUM(
    a.quantity
    * COALESCE(pc.price, 0)
    * CASE
        WHEN pc.currency = 'BRL' THEN 1
        WHEN er.rate IS NOT NULL  THEN er.rate
        ELSE 1
      END
  ), 0)                AS total_value,
  COUNT(a.id)          AS asset_count
FROM asset_types at
LEFT JOIN asset_groups ag ON ag.type_id = at.id
LEFT JOIN assets a        ON a.group_id = ag.id AND a.is_active = true
LEFT JOIN price_cache pc  ON pc.ticker  = a.ticker
LEFT JOIN exchange_rates er
       ON er.pair = pc.currency || '/BRL'
      AND pc.currency <> 'BRL'
GROUP BY at.id, at.name, at.target_pct, at.user_id;
