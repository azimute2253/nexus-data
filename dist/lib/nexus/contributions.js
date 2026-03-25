// ============================================================
// Nexus Data — Contributions CRUD
// Client-side mutations via Supabase SDK (ADR-006).
// All operations use the anon client (respects RLS).
// wallet_id isolation is app-layer (ADR-014).
// ============================================================
import { getAnonClient } from '../supabase.js';
const TABLE = 'contributions';
/**
 * List all contributions for a wallet, ordered by contributed_at descending.
 */
export async function getContributions(walletId) {
    const { data, error } = await getAnonClient()
        .from(TABLE)
        .select('*')
        .eq('wallet_id', walletId)
        .order('contributed_at', { ascending: false });
    if (error)
        throw error;
    return data;
}
/**
 * Get a single contribution by ID.
 * Returns null if not found.
 */
export async function getContribution(id) {
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
 * Create a new contribution.
 * Validates that amount is positive.
 */
export async function createContribution(input) {
    if (input.amount !== null && input.amount !== undefined && input.amount <= 0) {
        throw new Error('Contribution amount must be positive');
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
 * Update an existing contribution.
 * At least one field must be provided.
 */
export async function updateContribution(id, updates) {
    const keys = Object.keys(updates).filter((k) => updates[k] !== undefined);
    if (keys.length === 0) {
        throw new Error('At least one field must be provided for update');
    }
    if ('amount' in updates && updates.amount !== null && updates.amount !== undefined && updates.amount <= 0) {
        throw new Error('Contribution amount must be positive');
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
 * Delete a contribution by ID.
 */
export async function deleteContribution(id) {
    const { error } = await getAnonClient()
        .from(TABLE)
        .delete()
        .eq('id', id);
    if (error)
        throw error;
}
