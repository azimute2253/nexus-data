// ============================================================
// Nexus Data — Rebalance Calculator Utilities
// Pure logic for input validation, formatting, and result
// summarization. Used by RebalanceCalculator.tsx React island.
// [Story 5.5]
// ============================================================

import type {
  RebalanceResult,
  RebalanceTypeResult,
  RebalanceGroupResult,
  L3Result,
} from '../nexus/types.js';

// ---------- Input validation ----------

/**
 * Checks if a string represents a valid contribution amount.
 * Accepts pt-BR format (e.g., "12.000" or "12000,50") and plain numbers.
 */
export function isValidContribution(value: string): boolean {
  if (value.trim() === '') return false;
  const num = parseContribution(value);
  return !isNaN(num) && num >= 0;
}

/**
 * Parses a pt-BR formatted string into a number.
 * "12.000" → 12000, "12.000,50" → 12000.5
 */
export function parseContribution(value: string): number {
  return parseFloat(value.replace(/\./g, '').replace(',', '.'));
}

// ---------- Formatting ----------

export function formatBrl(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatShares(shares: number): string {
  if (Number.isInteger(shares)) {
    return String(shares);
  }
  return shares.toFixed(4);
}

// ---------- Result analysis ----------

/** Count total buy orders (assets with shares_to_buy > 0) across all levels */
export function countBuyOrders(result: RebalanceResult): number {
  let count = 0;
  for (const type of result.types) {
    for (const group of type.groups) {
      for (const asset of group.assets) {
        if (asset.shares_to_buy > 0) count++;
      }
    }
  }
  return count;
}

/** Get flat list of all buy orders from nested result */
export function flattenBuyOrders(result: RebalanceResult): (L3Result & { type_name: string; group_name: string })[] {
  const orders: (L3Result & { type_name: string; group_name: string })[] = [];
  for (const type of result.types) {
    for (const group of type.groups) {
      for (const asset of group.assets) {
        if (asset.shares_to_buy > 0) {
          orders.push({ ...asset, type_name: type.name, group_name: group.name });
        }
      }
    }
  }
  return orders;
}

/** Count types that received allocation > 0 */
export function countAllocatedTypes(result: RebalanceResult): number {
  return result.types.filter((t) => t.allocated > 0).length;
}
