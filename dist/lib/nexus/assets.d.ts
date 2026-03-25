import type { Asset, AssetInsert, AssetUpdate } from './types.js';
/**
 * List all assets for a wallet, optionally filtered by group_id.
 */
export declare function getAssets(walletId: string, groupId?: string): Promise<Asset[]>;
/**
 * Get a single asset by ID.
 * Returns null if not found.
 */
export declare function getAsset(id: string): Promise<Asset | null>;
/**
 * Create a new asset.
 * Validates ticker, quantity, group_id, and price_source.
 */
export declare function createAsset(input: AssetInsert): Promise<Asset>;
/**
 * Update an existing asset.
 * At least one field must be provided.
 */
export declare function updateAsset(id: string, updates: AssetUpdate): Promise<Asset>;
/**
 * Delete an asset by ID.
 */
export declare function deleteAsset(id: string): Promise<void>;
//# sourceMappingURL=assets.d.ts.map