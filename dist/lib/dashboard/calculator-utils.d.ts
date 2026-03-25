import type { RebalanceResult, L3Result } from '../nexus/types.js';
/**
 * Checks if a string represents a valid contribution amount.
 * Accepts pt-BR format (e.g., "12.000" or "12000,50") and plain numbers.
 */
export declare function isValidContribution(value: string): boolean;
/**
 * Parses a pt-BR formatted string into a number.
 * "12.000" → 12000, "12.000,50" → 12000.5
 */
export declare function parseContribution(value: string): number;
export declare function formatBrl(value: number): string;
export declare function formatShares(shares: number): string;
/** Count total buy orders (assets with shares_to_buy > 0) across all levels */
export declare function countBuyOrders(result: RebalanceResult): number;
/** Get flat list of all buy orders from nested result */
export declare function flattenBuyOrders(result: RebalanceResult): (L3Result & {
    type_name: string;
    group_name: string;
})[];
/** Count types that received allocation > 0 */
export declare function countAllocatedTypes(result: RebalanceResult): number;
//# sourceMappingURL=calculator-utils.d.ts.map