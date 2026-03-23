// ============================================================
// Nexus Data — Assets CRUD
// Client-side mutations via Supabase SDK (ADR-006).
// All operations use the anon client (respects RLS).
// ============================================================

import { getAnonClient } from '../supabase.js';
import type { Asset, AssetInsert, AssetUpdate, PriceSource } from './types.js';

const TABLE = 'assets';

const VALID_PRICE_SOURCES: readonly PriceSource[] = [
  'brapi', 'yahoo', 'manual', 'crypto', 'exchange',
];

/**
 * List all assets, optionally filtered by group_id.
 */
export async function getAssets(groupId?: string): Promise<Asset[]> {
  let query = getAnonClient().from(TABLE).select('*');

  if (groupId) {
    query = query.eq('group_id', groupId);
  }

  const { data, error } = await query.order('ticker', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Get a single asset by ID.
 * Returns null if not found.
 */
export async function getAsset(id: string): Promise<Asset | null> {
  const { data, error } = await getAnonClient()
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Create a new asset.
 * Validates ticker, quantity, group_id, and price_source.
 */
export async function createAsset(
  input: AssetInsert,
): Promise<Asset> {
  if (!input.ticker?.trim()) {
    throw new Error('Ticker is required');
  }
  if (!input.group_id) {
    throw new Error('group_id is required');
  }
  if (input.quantity < 0) {
    throw new Error('Quantity must be >= 0');
  }
  if (
    input.price_source &&
    !VALID_PRICE_SOURCES.includes(input.price_source)
  ) {
    throw new Error(
      `Invalid price_source: must be one of ${VALID_PRICE_SOURCES.join(', ')}`,
    );
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
 * Update an existing asset.
 * At least one field must be provided.
 */
export async function updateAsset(
  id: string,
  updates: AssetUpdate,
): Promise<Asset> {
  const keys = Object.keys(updates).filter(
    (k) => updates[k as keyof AssetUpdate] !== undefined,
  );
  if (keys.length === 0) {
    throw new Error('At least one field must be provided for update');
  }

  if ('ticker' in updates && !updates.ticker?.trim()) {
    throw new Error('Ticker cannot be empty');
  }
  if ('quantity' in updates && updates.quantity !== undefined && updates.quantity < 0) {
    throw new Error('Quantity must be >= 0');
  }
  if (
    'price_source' in updates &&
    updates.price_source &&
    !VALID_PRICE_SOURCES.includes(updates.price_source)
  ) {
    throw new Error(
      `Invalid price_source: must be one of ${VALID_PRICE_SOURCES.join(', ')}`,
    );
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
 * Delete an asset by ID.
 */
export async function deleteAsset(id: string): Promise<void> {
  const { error } = await getAnonClient()
    .from(TABLE)
    .delete()
    .eq('id', id);

  if (error) throw error;
}
