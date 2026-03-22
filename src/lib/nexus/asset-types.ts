// ============================================================
// Nexus Data — Asset Types CRUD
// Client-side mutations via Supabase SDK (ADR-006).
// All operations use the anon client (respects RLS).
// ============================================================

import { getAnonClient } from '../supabase.js';
import type { AssetType, AssetTypeInsert, AssetTypeUpdate } from './types.js';

const TABLE = 'asset_types';

/**
 * List all asset types for the current user, ordered by sort_order.
 */
export async function getAssetTypes(): Promise<AssetType[]> {
  const { data, error } = await getAnonClient()
    .from(TABLE)
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Get a single asset type by ID.
 * Returns null if not found.
 */
export async function getAssetType(id: string): Promise<AssetType | null> {
  const { data, error } = await getAnonClient()
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Create a new asset type.
 * Validates that name is non-empty.
 */
export async function createAssetType(
  input: AssetTypeInsert,
): Promise<AssetType> {
  if (!input.name?.trim()) {
    throw new Error('Asset type name is required');
  }

  const { data, error } = await getAnonClient()
    .from(TABLE)
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an existing asset type.
 * At least one field must be provided.
 */
export async function updateAssetType(
  id: string,
  updates: AssetTypeUpdate,
): Promise<AssetType> {
  const keys = Object.keys(updates).filter(
    (k) => updates[k as keyof AssetTypeUpdate] !== undefined,
  );
  if (keys.length === 0) {
    throw new Error('At least one field must be provided for update');
  }

  if ('name' in updates && !updates.name?.trim()) {
    throw new Error('Asset type name cannot be empty');
  }

  const { data, error } = await getAnonClient()
    .from(TABLE)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete an asset type by ID.
 */
export async function deleteAssetType(id: string): Promise<void> {
  const { error } = await getAnonClient()
    .from(TABLE)
    .delete()
    .eq('id', id);

  if (error) throw error;
}
