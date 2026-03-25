import type { AssetGroup, AssetGroupInsert, AssetGroupUpdate } from './types.js';
/**
 * List all asset groups for a wallet, optionally filtered by type_id.
 */
export declare function getGroups(walletId: string, typeId?: string): Promise<AssetGroup[]>;
/**
 * Get a single asset group by ID.
 * Returns null if not found.
 */
export declare function getGroup(id: string): Promise<AssetGroup | null>;
/**
 * Create a new asset group.
 * Validates that name is non-empty and type_id is provided.
 */
export declare function createGroup(input: AssetGroupInsert): Promise<AssetGroup>;
/**
 * Update an existing asset group.
 * At least one field must be provided.
 */
export declare function updateGroup(id: string, updates: AssetGroupUpdate): Promise<AssetGroup>;
/**
 * Delete an asset group by ID.
 */
export declare function deleteGroup(id: string): Promise<void>;
//# sourceMappingURL=groups.d.ts.map