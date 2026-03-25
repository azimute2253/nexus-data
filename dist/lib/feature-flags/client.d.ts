import type { FeatureFlag } from '../nexus/types.js';
/**
 * Returns all feature flags, ordered by name.
 */
export declare function getFeatureFlags(): Promise<FeatureFlag[]>;
/**
 * Returns a single feature flag by name, or null if not found.
 */
export declare function getFeatureFlag(name: string): Promise<FeatureFlag | null>;
/**
 * Checks whether a feature flag is enabled.
 * Returns `false` if the flag doesn't exist.
 */
export declare function isFeatureEnabled(name: string): Promise<boolean>;
/**
 * Sets a feature flag's enabled state.
 * Creates the flag if it doesn't exist (upsert).
 */
export declare function setFeatureFlag(name: string, enabled: boolean, description?: string): Promise<FeatureFlag>;
/**
 * Toggles a feature flag's enabled state.
 * Throws if the flag doesn't exist.
 */
export declare function toggleFeatureFlag(name: string): Promise<FeatureFlag>;
/**
 * Deletes a feature flag by name.
 */
export declare function deleteFeatureFlag(name: string): Promise<void>;
//# sourceMappingURL=client.d.ts.map