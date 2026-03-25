// ============================================================
// Nexus Data — Feature Flags Client
// CRUD + helper for the feature_flags table.
// Story 9.3
// ============================================================
import { getAnonClient } from '../supabase.js';
// --------------- queries ---------------
/**
 * Returns all feature flags, ordered by name.
 */
export async function getFeatureFlags() {
    const client = getAnonClient();
    const { data, error } = await client
        .from('feature_flags')
        .select('*')
        .order('name', { ascending: true });
    if (error)
        throw error;
    return data;
}
/**
 * Returns a single feature flag by name, or null if not found.
 */
export async function getFeatureFlag(name) {
    const client = getAnonClient();
    const { data, error } = await client
        .from('feature_flags')
        .select('*')
        .eq('name', name)
        .maybeSingle();
    if (error)
        throw error;
    return data;
}
/**
 * Checks whether a feature flag is enabled.
 * Returns `false` if the flag doesn't exist.
 */
export async function isFeatureEnabled(name) {
    const flag = await getFeatureFlag(name);
    return flag?.enabled ?? false;
}
// --------------- mutations ---------------
/**
 * Sets a feature flag's enabled state.
 * Creates the flag if it doesn't exist (upsert).
 */
export async function setFeatureFlag(name, enabled, description) {
    if (!name.trim()) {
        throw new Error('Feature flag name is required');
    }
    const client = getAnonClient();
    const row = {
        name: name.trim(),
        enabled,
        description: description ?? null,
    };
    const { data, error } = await client
        .from('feature_flags')
        .upsert(row, { onConflict: 'name' })
        .select()
        .single();
    if (error)
        throw error;
    return data;
}
/**
 * Toggles a feature flag's enabled state.
 * Throws if the flag doesn't exist.
 */
export async function toggleFeatureFlag(name) {
    const flag = await getFeatureFlag(name);
    if (!flag) {
        throw new Error(`Feature flag not found: ${name}`);
    }
    const client = getAnonClient();
    const { data, error } = await client
        .from('feature_flags')
        .update({ enabled: !flag.enabled })
        .eq('name', name)
        .select()
        .single();
    if (error)
        throw error;
    return data;
}
/**
 * Deletes a feature flag by name.
 */
export async function deleteFeatureFlag(name) {
    const client = getAnonClient();
    const { error } = await client
        .from('feature_flags')
        .delete()
        .eq('name', name);
    if (error)
        throw error;
}
