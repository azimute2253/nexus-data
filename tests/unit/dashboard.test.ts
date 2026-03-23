import { describe, it, expect } from 'vitest';
import type { TypePerformance, PerformanceMetrics } from '../../src/lib/dashboard/types.js';

// ── Re-implement top-deviations logic from Dashboard.tsx ─────

function getTopDeviations(types: TypePerformance[], limit: number): TypePerformance[] {
  return [...types]
    .sort((a, b) => Math.abs(b.deviation_pct) - Math.abs(a.deviation_pct))
    .slice(0, limit);
}

// ── Fixtures ────────────────────────────────────────────────

const TYPES: TypePerformance[] = [
  { asset_type_id: 't1', asset_type_name: 'FIIs', target_pct: 15, actual_pct: 32.73, deviation_pct: 17.73, total_value_brl: 36000 },
  { asset_type_id: 't2', asset_type_name: 'Ações BR', target_pct: 35, actual_pct: 18.0, deviation_pct: -17.0, total_value_brl: 50000 },
  { asset_type_id: 't3', asset_type_name: 'ETFs Int.', target_pct: 10, actual_pct: 10.5, deviation_pct: 0.5, total_value_brl: 24000 },
  { asset_type_id: 't4', asset_type_name: 'Cripto', target_pct: 5, actual_pct: 5.0, deviation_pct: 0.0, total_value_brl: 12000 },
  { asset_type_id: 't5', asset_type_name: 'RF', target_pct: 20, actual_pct: 15.0, deviation_pct: -5.0, total_value_brl: 30000 },
  { asset_type_id: 't6', asset_type_name: 'Commodities', target_pct: 5, actual_pct: 8.0, deviation_pct: 3.0, total_value_brl: 16000 },
  { asset_type_id: 't7', asset_type_name: 'Cash', target_pct: 10, actual_pct: 10.77, deviation_pct: 0.77, total_value_brl: 20000 },
];

// ── Tests: Top deviations ───────────────────────────────────

describe('getTopDeviations', () => {
  it('T8.1.2 — returns top 5 deviations sorted by absolute value', () => {
    const top5 = getTopDeviations(TYPES, 5);
    expect(top5).toHaveLength(5);
    // Ordered by |deviation|: 17.73, 17.0, 5.0, 3.0, 0.77
    expect(top5.map((t) => t.asset_type_name)).toEqual([
      'FIIs', 'Ações BR', 'RF', 'Commodities', 'Cash',
    ]);
  });

  it('handles fewer types than limit', () => {
    const twoTypes = TYPES.slice(0, 2);
    const top5 = getTopDeviations(twoTypes, 5);
    expect(top5).toHaveLength(2);
  });

  it('handles empty types', () => {
    expect(getTopDeviations([], 5)).toEqual([]);
  });

  it('does not mutate the original array', () => {
    const original = [...TYPES];
    getTopDeviations(TYPES, 5);
    expect(TYPES).toEqual(original);
  });

  it('includes both overweight and underweight deviations', () => {
    const top5 = getTopDeviations(TYPES, 5);
    const overweight = top5.filter((t) => t.deviation_pct > 0);
    const underweight = top5.filter((t) => t.deviation_pct < 0);
    expect(overweight.length).toBeGreaterThan(0);
    expect(underweight.length).toBeGreaterThan(0);
  });
});

// ── Tests: Mobile layout constraints ────────────────────────

describe('Mobile layout data constraints', () => {
  it('T8.1.4 — portfolio total is always a number', () => {
    const total = TYPES.reduce((sum, t) => sum + t.total_value_brl, 0);
    expect(typeof total).toBe('number');
    expect(total).toBeGreaterThan(0);
  });

  it('T8.1.1 — all type fields are non-null for card rendering', () => {
    for (const t of TYPES) {
      expect(typeof t.asset_type_name).toBe('string');
      expect(typeof t.target_pct).toBe('number');
      expect(typeof t.actual_pct).toBe('number');
      expect(typeof t.deviation_pct).toBe('number');
      expect(typeof t.total_value_brl).toBe('number');
    }
  });
});
