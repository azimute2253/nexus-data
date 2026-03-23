-- ============================================================
-- Nexus Data — Migration 014: Asset bought/sold flags
-- Story 6.4: Add boolean flags for bought/sold status tracking.
-- Constraint: bought and sold cannot both be true.
-- ============================================================

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS bought BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sold   BOOLEAN DEFAULT false;

-- Prevent an asset from being both bought AND sold simultaneously
ALTER TABLE assets
  ADD CONSTRAINT chk_bought_sold_exclusive
  CHECK (NOT (bought = true AND sold = true));
