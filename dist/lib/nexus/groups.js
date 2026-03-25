// ============================================================
// Nexus Data — Asset Groups CRUD
// Client-side mutations via Supabase SDK (ADR-006).
// All operations use the anon client (respects RLS).
// wallet_id isolation is app-layer (ADR-014).
// ============================================================
import { getAnonClient } from '../supabase.js';
const TABLE = 'asset_groups';
/**
 * List all asset groups for a wallet, optionally filtered by type_id.
 */
export async function getGroups(walletId, typeId) {
    let query = getAnonClient()
        .from(TABLE)
        .select('*')
        .eq('wallet_id', walletId);
    if (typeId) {
        query = query.eq('type_id', typeId);
    }
    const { data, error } = await query.order('name', { ascending: true });
    if (error)
        throw error;
    return data;
}
/**
 * Get a single asset group by ID.
 * Returns null if not found.
 */
export async function getGroup(id) {
    const { data, error } = await getAnonClient()
        .from(TABLE)
        .select('*')
        .eq('id', id)
        .maybeSingle();
    if (error)
        throw error;
    return data;
}
/**
 * Create a new asset group.
 * Validates that name is non-empty and type_id is provided.
 */
export async function createGroup(input) {
    if (!input.name?.trim()) {
        throw new Error('Group name is required');
    }
    if (!input.type_id) {
        throw new Error('type_id is required');
    }
    const { data, error } = await getAnonClient()
        .from(TABLE)
        .insert(input)
        .select()
        .single();
    if (error)
        throw error;
    return data;
}
/**
 * Update an existing asset group.
 * At least one field must be provided.
 */
export async function updateGroup(id, updates) {
    const keys = Object.keys(updates).filter((k) => updates[k] !== undefined);
    if (keys.length === 0) {
        throw new Error('At least one field must be provided for update');
    }
    if ('name' in updates && !updates.name?.trim()) {
        throw new Error('Group name cannot be empty');
    }
    const { data, error } = await getAnonClient()
        .from(TABLE)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error)
        throw error;
    return data;
}
/**
 * Delete an asset group by ID.
 */
export async function deleteGroup(id) {
    const { error } = await getAnonClient()
        .from(TABLE)
        .delete()
        .eq('id', id);
    if (error)
        throw error;
}
