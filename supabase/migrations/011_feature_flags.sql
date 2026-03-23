-- ============================================================
-- Migration 011: Feature Flags
-- Story 9.3 — Feature flag system for gating features
-- ============================================================

CREATE TABLE IF NOT EXISTS feature_flags (
  name        TEXT PRIMARY KEY,
  enabled     BOOLEAN NOT NULL DEFAULT false,
  description TEXT
);

-- Seed example flags
INSERT INTO feature_flags (name, enabled, description) VALUES
  ('portfolio_dashboard', false, 'Show/hide portfolio dashboard page'),
  ('rebalancing_calculator', false, 'Enable/disable rebalancing calculator'),
  ('price_refresh_manual', false, 'Enable/disable manual price refresh button')
ON CONFLICT (name) DO NOTHING;
