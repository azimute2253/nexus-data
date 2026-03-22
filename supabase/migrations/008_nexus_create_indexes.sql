-- ============================================================
-- Nexus Data — Schema Migration 002
-- Creates performance indexes for common query patterns.
-- Idempotent: IF NOT EXISTS on all indexes.
-- ============================================================

-- assets
CREATE INDEX IF NOT EXISTS idx_assets_user_id  ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_group_id ON assets(group_id);
CREATE INDEX IF NOT EXISTS idx_assets_ticker   ON assets(ticker);

-- asset_groups
CREATE INDEX IF NOT EXISTS idx_asset_groups_type_id ON asset_groups(type_id);
CREATE INDEX IF NOT EXISTS idx_asset_groups_user_id ON asset_groups(user_id);

-- asset_types
CREATE INDEX IF NOT EXISTS idx_asset_types_user_id ON asset_types(user_id);

-- asset_scores
CREATE INDEX IF NOT EXISTS idx_asset_scores_asset_id         ON asset_scores(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_scores_questionnaire_id ON asset_scores(questionnaire_id);

-- price_cache — fetched_at for TTL queries
CREATE INDEX IF NOT EXISTS idx_price_cache_fetched_at ON price_cache(fetched_at);
