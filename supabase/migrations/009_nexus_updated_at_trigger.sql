-- ============================================================
-- Nexus Data — Migration 009
-- Auto-update updated_at on row modification.
-- Uses moddatetime extension (available on Supabase).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS moddatetime;

-- asset_types
CREATE OR REPLACE TRIGGER set_updated_at_asset_types
  BEFORE UPDATE ON asset_types
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- asset_groups
CREATE OR REPLACE TRIGGER set_updated_at_asset_groups
  BEFORE UPDATE ON asset_groups
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- assets
CREATE OR REPLACE TRIGGER set_updated_at_assets
  BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- questionnaires
CREATE OR REPLACE TRIGGER set_updated_at_questionnaires
  BEFORE UPDATE ON questionnaires
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- asset_scores
CREATE OR REPLACE TRIGGER set_updated_at_asset_scores
  BEFORE UPDATE ON asset_scores
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
