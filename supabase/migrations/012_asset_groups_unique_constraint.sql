-- ============================================================
-- Nexus Data — Migration 012
-- Unique constraint: one group name per type per user.
-- Prevents duplicate group names within the same asset type
-- for the same user (QA issue from Story 6.2).
-- ============================================================

ALTER TABLE asset_groups
ADD CONSTRAINT asset_groups_name_type_user_unique
UNIQUE (type_id, name, user_id);
