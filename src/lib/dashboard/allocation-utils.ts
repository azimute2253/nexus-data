// ============================================================
// Nexus Data — Allocation Table Utilities
// Pure logic for sorting, formatting, and status computation.
// Used by AllocationTable.tsx React island.
// [Story 5.2]
// ============================================================

import type { TypePerformance } from './types.js';

// ---------- Sorting ----------

export type SortKey = 'asset_type_name' | 'target_pct' | 'actual_pct' | 'deviation_pct' | 'total_value_brl';
export type SortDir = 'asc' | 'desc';

export interface SortState {
  key: SortKey;
  dir: SortDir;
}

export function sortTypes(types: TypePerformance[], sort: SortState): TypePerformance[] {
  return [...types].sort((a, b) => {
    const aVal = a[sort.key];
    const bVal = b[sort.key];
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sort.dir === 'asc'
        ? aVal.localeCompare(bVal, 'pt-BR')
        : bVal.localeCompare(aVal, 'pt-BR');
    }
    const diff = (aVal as number) - (bVal as number);
    return sort.dir === 'asc' ? diff : -diff;
  });
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

export function formatPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

// ---------- Status ----------

export type AllocationStatus = 'Overweight' | 'Underweight' | 'Aligned';

export function getStatus(deviationPct: number): AllocationStatus {
  if (deviationPct > 2) return 'Overweight';
  if (deviationPct < -2) return 'Underweight';
  return 'Aligned';
}
