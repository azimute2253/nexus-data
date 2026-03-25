import type { Wallet, WalletInsert, WalletUpdate } from './types.js';
/**
 * Check if a wallet belongs to the current user.
 * Relies on RLS — if the wallet is not the user's, Supabase returns null.
 */
export declare function isWalletOwner(walletId: string): Promise<boolean>;
/**
 * List all wallets for a specific user, ordered by creation date.
 */
export declare function getWallets(userId: string): Promise<Wallet[]>;
/**
 * Get a single wallet by ID.
 * Returns null if not found (or not owned by current user due to RLS).
 */
export declare function getWallet(id: string): Promise<Wallet | null>;
/**
 * Create a new wallet.
 * Validates that name is 1-50 chars.
 */
export declare function createWallet(input: WalletInsert): Promise<Wallet>;
/**
 * Update a wallet name.
 * Validates that the new name is 1-50 chars.
 */
export declare function updateWallet(id: string, updates: WalletUpdate): Promise<Wallet>;
/**
 * Delete a wallet by ID.
 * Cascade deletes all child data (6 tables: asset_types, asset_groups,
 * assets, questionnaires, asset_scores, contributions) via DB FK CASCADE.
 */
export declare function deleteWallet(id: string): Promise<void>;
//# sourceMappingURL=wallets.d.ts.map