import type { AssetType, AssetTypeInsert, AssetTypeUpdate } from './types.js';
/**
 * List all asset types for a wallet, ordered by sort_order.
 */
export declare function getAssetTypes(walletId: string): Promise<AssetType[]>;
/**
 * Get a single asset type by ID.
 * Returns null if not found.
 */
export declare function getAssetType(id: string): Promise<AssetType | null>;
/**
 * Create a new asset type.
 * Validates that name is non-empty.
 */
export declare function createAssetType(input: AssetTypeInsert): Promise<AssetType>;
/**
 * Update an existing asset type.
 * At least one field must be provided.
 */
export declare function updateAssetType(id: string, updates: AssetTypeUpdate): Promise<AssetType>;
/**
 * Delete an asset type by ID.
 */
export declare function deleteAssetType(id: string): Promise<void>;
//# sourceMappingURL=asset-types.d.ts.map