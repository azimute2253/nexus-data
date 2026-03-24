-- Migration 019: Add dual weight columns to assets
-- Story 14.1 — Dual Weight Schema & Data Layer
-- ADR-015: weight_mode is TEXT with CHECK (not ENUM)
-- Scale: -10 to +11 (matches original spreadsheet, PRD-v2 F-028)

ALTER TABLE assets
  ADD COLUMN weight_mode TEXT NOT NULL DEFAULT 'questionnaire'
    CHECK (weight_mode IN ('manual', 'questionnaire')),
  ADD COLUMN manual_weight NUMERIC DEFAULT 0
    CHECK (manual_weight >= -10 AND manual_weight <= 11);
