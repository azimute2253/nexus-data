import type { Contribution, ContributionInsert, ContributionUpdate } from './types.js';
/**
 * List all contributions for a wallet, ordered by contributed_at descending.
 */
export declare function getContributions(walletId: string): Promise<Contribution[]>;
/**
 * Get a single contribution by ID.
 * Returns null if not found.
 */
export declare function getContribution(id: string): Promise<Contribution | null>;
/**
 * Create a new contribution.
 * Validates that amount is positive.
 */
export declare function createContribution(input: ContributionInsert): Promise<Contribution>;
/**
 * Update an existing contribution.
 * At least one field must be provided.
 */
export declare function updateContribution(id: string, updates: ContributionUpdate): Promise<Contribution>;
/**
 * Delete a contribution by ID.
 */
export declare function deleteContribution(id: string): Promise<void>;
//# sourceMappingURL=contributions.d.ts.map