import { describe, it, expect } from 'vitest';
import type { TypePerformance } from '../../src/lib/dashboard/types.js';
import {
  sortTypes,
  formatBrl,
  formatPct,
  getStatus,
} from '../../src/lib/dashboard/allocation-utils.js';
import type { SortState } from '../../src/lib/dashboard/allocation-utils.js';

// ── Fixtures ────────────────────────────────────────────────

const TYPES: TypePerformance[] = [
  { asset_type_id: 't1', asset_type_name: 'FIIs', target_pct: 15, actual_pct: 32.73, deviation_pct: 17.73, total_value_brl: 36000 },
  { asset_type_id: 't2', asset_type_name: 'Ações BR', target_pct: 35, actual_pct: 18.0, deviation_pct: -17.0, total_value_brl: 50000 },
  { asset_type_id: 't3', asset_type_name: 'ETFs Int.', target_pct: 10, actual_pct: 10.5, deviation_pct: 0.5, total_value_brl: 24000 },
  { asset_type_id: 't4', asset_type_name: 'Cripto', target_pct: 5, actual_pct: 5.0, deviation_pct: 0.0, total_value_brl: 12000 },
];

// ── Tests: getStatus (AC3, AC4, AC5) ────────────────────────

describe('getStatus', () => {
  it('T5.2.2 — returns Overweight when deviation > 2pp', () => {
    expect(getStatus(17.73)).toBe('Overweight');
    expect(getStatus(2.01)).toBe('Overweight');
    expect(getStatus(50)).toBe('Overweight');
  });

  it('T5.2.3 — returns Underweight when deviation < -2pp', () => {
    expect(getStatus(-17.0)).toBe('Underweight');
    expect(getStatus(-2.01)).toBe('Underweight');
    expect(getStatus(-50)).toBe('Underweight');
  });

  it('T5.2.4 — returns Aligned when deviation within ±2pp', () => {
    expect(getStatus(0)).toBe('Aligned');
    expect(getStatus(1.99)).toBe('Aligned');
    expect(getStatus(-1.99)).toBe('Aligned');
    expect(getStatus(2.0)).toBe('Aligned');
    expect(getStatus(-2.0)).toBe('Aligned');
    expect(getStatus(0.5)).toBe('Aligned');
  });
});

// ── Tests: sortTypes (AC2 — sortable columns) ──────────────

describe('sortTypes', () => {
  it('sorts by asset_type_name ascending (default)', () => {
    const sort: SortState = { key: 'asset_type_name', dir: 'asc' };
    const sorted = sortTypes(TYPES, sort);
    expect(sorted.map((t) => t.asset_type_name)).toEqual([
      'Ações BR', 'Cripto', 'ETFs Int.', 'FIIs',
    ]);
  });

  it('sorts by asset_type_name descending', () => {
    const sort: SortState = { key: 'asset_type_name', dir: 'desc' };
    const sorted = sortTypes(TYPES, sort);
    expect(sorted.map((t) => t.asset_type_name)).toEqual([
      'FIIs', 'ETFs Int.', 'Cripto', 'Ações BR',
    ]);
  });

  it('sorts by target_pct ascending', () => {
    const sort: SortState = { key: 'target_pct', dir: 'asc' };
    const sorted = sortTypes(TYPES, sort);
    expect(sorted.map((t) => t.target_pct)).toEqual([5, 10, 15, 35]);
  });

  it('sorts by deviation_pct descending (highest deviation first)', () => {
    const sort: SortState = { key: 'deviation_pct', dir: 'desc' };
    const sorted = sortTypes(TYPES, sort);
    expect(sorted.map((t) => t.deviation_pct)).toEqual([17.73, 0.5, 0.0, -17.0]);
  });

  it('sorts by total_value_brl ascending', () => {
    const sort: SortState = { key: 'total_value_brl', dir: 'asc' };
    const sorted = sortTypes(TYPES, sort);
    expect(sorted.map((t) => t.total_value_brl)).toEqual([12000, 24000, 36000, 50000]);
  });

  it('does not mutate the original array', () => {
    const original = [...TYPES];
    const sort: SortState = { key: 'deviation_pct', dir: 'desc' };
    sortTypes(TYPES, sort);
    expect(TYPES).toEqual(original);
  });

  it('handles empty array', () => {
    const sort: SortState = { key: 'target_pct', dir: 'asc' };
    expect(sortTypes([], sort)).toEqual([]);
  });
});

// ── Tests: formatPct ────────────────────────────────────────

describe('formatPct', () => {
  it('formats percentage with 2 decimal places', () => {
    expect(formatPct(15)).toBe('15.00%');
    expect(formatPct(32.73)).toBe('32.73%');
    expect(formatPct(0)).toBe('0.00%');
  });

  it('formats negative percentages', () => {
    expect(formatPct(-17)).toBe('-17.00%');
  });
});

// ── Tests: formatBrl ────────────────────────────────────────

describe('formatBrl', () => {
  it('formats BRL currency values', () => {
    const result = formatBrl(36000);
    // Should contain "36.000,00" or "36,000.00" depending on locale
    expect(result).toContain('36');
    expect(result).toMatch(/R\$/);
  });

  it('formats zero value', () => {
    const result = formatBrl(0);
    expect(result).toMatch(/R\$/);
    expect(result).toContain('0');
  });
});

// ── Tests: T5.2.1 — 10 asset types (row count) ─────────────

describe('AllocationTable data handling', () => {
  it('T5.2.1 — handles 10 asset types correctly', () => {
    const tenTypes: TypePerformance[] = Array.from({ length: 10 }, (_, i) => ({
      asset_type_id: `t${i + 1}`,
      asset_type_name: `Type ${i + 1}`,
      target_pct: 10,
      actual_pct: 8 + i,
      deviation_pct: -2 + i,
      total_value_brl: 10000 * (i + 1),
    }));

    const sort: SortState = { key: 'asset_type_name', dir: 'asc' };
    const sorted = sortTypes(tenTypes, sort);
    expect(sorted).toHaveLength(10);
  });
});
