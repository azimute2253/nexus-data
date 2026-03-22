-- ============================================================
-- Nexus Data — Migration 010
-- Unique constraint: one ticker per user within the assets table.
-- Prevents duplicate tickers for the same user.
-- ============================================================

ALTER TABLE assets ADD CONSTRAINT assets_ticker_user_unique UNIQUE (ticker, user_id);
