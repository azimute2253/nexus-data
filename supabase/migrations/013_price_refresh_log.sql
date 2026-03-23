-- ============================================================
-- Migration 013: price_refresh_log
-- Tracks last price refresh timestamp for auto-refresh cooldown.
-- Story 3.6: Auto-refresh on portfolio entry.
-- ============================================================

CREATE TABLE IF NOT EXISTS price_refresh_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trigger     TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'auto'
  user_id     UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_price_refresh_log_refreshed_at
  ON price_refresh_log (refreshed_at DESC);

ALTER TABLE price_refresh_log ENABLE ROW LEVEL SECURITY;
