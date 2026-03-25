// ============================================================
// Nexus Data — Wallets CRUD
// Client-side mutations via Supabase SDK (ADR-006).
// All operations use the anon client (respects RLS).
// wallet_id isolation is app-layer (ADR-014).
// ============================================================
import { getAnonClient } from '../supabase.js';
const TABLE = 'wallets';
// ── Validation ──────────────────────────────────────────────
function validateWalletName(name) {
    const trimmed = name.trim();
    if (trimmed.length < 1) {
        throw new Error('Wallet name is required');
    }
    if (name.length > 50) {
        throw new Error('Wallet name must be 50 characters or less');
    }
}
// ── Ownership helper ────────────────────────────────────────
/**
 * Check if a wallet belongs to the current user.
 * Relies on RLS — if the wallet is not the user's, Supabase returns null.
 */
export async function isWalletOwner(walletId) {
    const wallet = await getWallet(walletId);
    return wallet !== null;
}
// ── CRUD operations ─────────────────────────────────────────
/**
 * List all wallets for a specific user, ordered by creation date.
 */
export async function getWallets(userId) {
    const { data, error } = await getAnonClient()
        .from(TABLE)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
    if (error)
        throw error;
    return data;
}
/**
 * Get a single wallet by ID.
 * Returns null if not found (or not owned by current user due to RLS).
 */
export async function getWallet(id) {
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
 * Create a new wallet.
 * Validates that name is 1-50 chars.
 */
export async function createWallet(input) {
    validateWalletName(input.name);
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
 * Update a wallet name.
 * Validates that the new name is 1-50 chars.
 */
export async function updateWallet(id, updates) {
    const keys = Object.keys(updates).filter((k) => updates[k] !== undefined);
    if (keys.length === 0) {
        throw new Error('At least one field must be provided for update');
    }
    if ('name' in updates && updates.name !== undefined) {
        validateWalletName(updates.name);
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
 * Delete a wallet by ID.
 * Cascade deletes all child data (6 tables: asset_types, asset_groups,
 * assets, questionnaires, asset_scores, contributions) via DB FK CASCADE.
 */
export async function deleteWallet(id) {
    const { error } = await getAnonClient()
        .from(TABLE)
        .delete()
        .eq('id', id);
    if (error)
        throw error;
}
