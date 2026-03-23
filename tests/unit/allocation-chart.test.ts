import { describe, it, expect } from 'vitest';
import type { TypePerformance } from '../../src/lib/dashboard/types.js';
import {
  buildActualSlices,
  buildTargetSlices,
  getColor,
} from '../../src/components/nexus/AllocationChart.js';
import type { ChartSlice } from '../../src/components/nexus/AllocationChart.js';

// ── Fixtures ────────────────────────────────────────────────

const TEN_TYPES: TypePerformance[] = [
  { asset_type_id: 't1', asset_type_name: 'FIIs', target_pct: 15, actual_pct: 65, deviation_pct: 50, total_value_brl: 130000 },
  { asset_type_id: 't2', asset_type_name: 'Ações BR', target_pct: 35, actual_pct: 10, deviation_pct: -25, total_value_brl: 20000 },
  { asset_type_id: 't3', asset_type_name: 'ETFs Int.', target_pct: 10, actual_pct: 5, deviation_pct: -5, total_value_brl: 10000 },
  { asset_type_id: 't4', asset_type_name: 'Cripto', target_pct: 5, actual_pct: 5, deviation_pct: 0, total_value_brl: 10000 },
  { asset_type_id: 't5', asset_type_name: 'Renda Fixa', target_pct: 10, actual_pct: 5, deviation_pct: -5, total_value_brl: 10000 },
  { asset_type_id: 't6', asset_type_name: 'Stocks US', target_pct: 5, actual_pct: 3, deviation_pct: -2, total_value_brl: 6000 },
  { asset_type_id: 't7', asset_type_name: 'REITs', target_pct: 5, actual_pct: 2, deviation_pct: -3, total_value_brl: 4000 },
  { asset_type_id: 't8', asset_type_name: 'Commodities', target_pct: 5, actual_pct: 2, deviation_pct: -3, total_value_brl: 4000 },
  { asset_type_id: 't9', asset_type_name: 'Cash', target_pct: 5, actual_pct: 2, deviation_pct: -3, total_value_brl: 4000 },
  { asset_type_id: 't10', asset_type_name: 'Outros', target_pct: 5, actual_pct: 1, deviation_pct: -4, total_value_brl: 2000 },
];

const TOTAL_VALUE_BRL = 200000;

// ── Tests: T5.3.1 — Component rendering (data transformation) ──

describe('buildActualSlices', () => {
  it('T5.3.1 — builds slices for all 10 types with positive actual_pct', () => {
    const slices = buildActualSlices(TEN_TYPES);
    expect(slices).toHaveLength(10);
    expect(slices.every((s) => s.value > 0)).toBe(true);
  });

  it('maps TypePerformance fields to ChartSlice correctly', () => {
    const slices = buildActualSlices(TEN_TYPES);
    const fiiSlice = slices.find((s) => s.name === 'FIIs')!;
    expect(fiiSlice).toBeDefined();
    expect(fiiSlice.name).toBe('FIIs');
    expect(fiiSlice.value).toBe(65);
    expect(fiiSlice.valueBrl).toBe(130000);
    expect(fiiSlice.fill).toBe(getColor(0));
  });

  it('preserves original index for color assignment after filtering', () => {
    // If some types have 0% actual, color index should still match original position
    const typesWithZero: TypePerformance[] = [
      { asset_type_id: 't1', asset_type_name: 'FIIs', target_pct: 15, actual_pct: 0, deviation_pct: -15, total_value_brl: 0 },
      { asset_type_id: 't2', asset_type_name: 'Ações BR', target_pct: 35, actual_pct: 50, deviation_pct: 15, total_value_brl: 100000 },
      { asset_type_id: 't3', asset_type_name: 'Cripto', target_pct: 10, actual_pct: 50, deviation_pct: 40, total_value_brl: 100000 },
    ];
    const slices = buildActualSlices(typesWithZero);
    expect(slices).toHaveLength(2);
    // Ações BR is at index 1 in original, Cripto at index 2
    expect(slices[0].fill).toBe(getColor(1));
    expect(slices[1].fill).toBe(getColor(2));
  });
});

describe('buildTargetSlices', () => {
  it('T5.3.1 — builds target slices for all types with positive target_pct', () => {
    const slices = buildTargetSlices(TEN_TYPES, TOTAL_VALUE_BRL);
    expect(slices).toHaveLength(10);
    expect(slices.every((s) => s.value > 0)).toBe(true);
  });

  it('calculates BRL value from target percentage and total', () => {
    const slices = buildTargetSlices(TEN_TYPES, TOTAL_VALUE_BRL);
    const fiiSlice = slices.find((s) => s.name === 'FIIs')!;
    expect(fiiSlice).toBeDefined();
    expect(fiiSlice.value).toBe(15); // target_pct
    // 200000 * (15/100) = 30000
    expect(fiiSlice.valueBrl).toBe(30000);
  });

  it('preserves original index for color assignment after filtering', () => {
    const typesWithZero: TypePerformance[] = [
      { asset_type_id: 't1', asset_type_name: 'FIIs', target_pct: 0, actual_pct: 65, deviation_pct: 65, total_value_brl: 130000 },
      { asset_type_id: 't2', asset_type_name: 'Ações BR', target_pct: 50, actual_pct: 35, deviation_pct: -15, total_value_brl: 70000 },
    ];
    const slices = buildTargetSlices(typesWithZero, 100000);
    expect(slices).toHaveLength(1);
    expect(slices[0].fill).toBe(getColor(1)); // original index 1
    expect(slices[0].valueBrl).toBe(50000); // 100000 * 50/100
  });
});

// ── Tests: T5.3.2 — Data visualization (segments match input) ──

describe('Slice data matches input data', () => {
  it('T5.3.2 — FIIs actual slice shows 65% and correct BRL', () => {
    const slices = buildActualSlices(TEN_TYPES);
    const fiiSlice = slices.find((s) => s.name === 'FIIs')!;
    expect(fiiSlice.value).toBe(65);
    expect(fiiSlice.valueBrl).toBe(130000);
  });

  it('T5.3.2 — FIIs target slice shows 15% and calculated BRL', () => {
    const slices = buildTargetSlices(TEN_TYPES, TOTAL_VALUE_BRL);
    const fiiSlice = slices.find((s) => s.name === 'FIIs')!;
    expect(fiiSlice.value).toBe(15);
    expect(fiiSlice.valueBrl).toBe(30000);
  });

  it('actual FIIs slice (65%) is at least 4x larger than target (15%)', () => {
    const actualSlices = buildActualSlices(TEN_TYPES);
    const targetSlices = buildTargetSlices(TEN_TYPES, TOTAL_VALUE_BRL);
    const actualFii = actualSlices.find((s) => s.name === 'FIIs')!;
    const targetFii = targetSlices.find((s) => s.name === 'FIIs')!;
    expect(actualFii.value / targetFii.value).toBeGreaterThanOrEqual(4);
  });

  it('each type has a distinct color', () => {
    const slices = buildActualSlices(TEN_TYPES);
    const colors = slices.map((s) => s.fill);
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBe(slices.length);
  });

  it('actual and target slices share same color per type', () => {
    const actualSlices = buildActualSlices(TEN_TYPES);
    const targetSlices = buildTargetSlices(TEN_TYPES, TOTAL_VALUE_BRL);
    for (const actual of actualSlices) {
      const target = targetSlices.find((s) => s.name === actual.name);
      if (target) {
        expect(actual.fill).toBe(target.fill);
      }
    }
  });
});

// ── Tests: T5.3.3 — Tooltip data (hover interactions) ──

describe('Tooltip data preparation', () => {
  it('T5.3.3 — each slice contains name, value (pct), and valueBrl for tooltip', () => {
    const slices = buildActualSlices(TEN_TYPES);
    for (const slice of slices) {
      expect(slice).toHaveProperty('name');
      expect(slice).toHaveProperty('value');
      expect(slice).toHaveProperty('valueBrl');
      expect(typeof slice.name).toBe('string');
      expect(typeof slice.value).toBe('number');
      expect(typeof slice.valueBrl).toBe('number');
      expect(slice.name.length).toBeGreaterThan(0);
    }
  });

  it('T5.3.3 — FIIs slice tooltip data matches expected values', () => {
    const slices = buildActualSlices(TEN_TYPES);
    const fiiSlice = slices.find((s) => s.name === 'FIIs')!;
    // Tooltip should show: "FIIs", "65.00%", "R$ 130.000,00"
    expect(fiiSlice.name).toBe('FIIs');
    expect(fiiSlice.value).toBe(65);
    expect(fiiSlice.valueBrl).toBe(130000);
  });
});

// ── Tests: T5.3.4 — Edge cases ──────────────────────────────

describe('Edge cases', () => {
  it('T5.3.4 — empty types array produces no slices', () => {
    const actualSlices = buildActualSlices([]);
    const targetSlices = buildTargetSlices([], TOTAL_VALUE_BRL);
    expect(actualSlices).toEqual([]);
    expect(targetSlices).toEqual([]);
  });

  it('T5.3.4 — single type produces one slice', () => {
    const singleType: TypePerformance[] = [
      { asset_type_id: 't1', asset_type_name: 'FIIs', target_pct: 100, actual_pct: 100, deviation_pct: 0, total_value_brl: 200000 },
    ];
    const actualSlices = buildActualSlices(singleType);
    const targetSlices = buildTargetSlices(singleType, 200000);
    expect(actualSlices).toHaveLength(1);
    expect(targetSlices).toHaveLength(1);
    expect(actualSlices[0].value).toBe(100);
    expect(targetSlices[0].value).toBe(100);
    expect(targetSlices[0].valueBrl).toBe(200000);
  });

  it('types with 0% actual are excluded from actual slices', () => {
    const typesWithZero: TypePerformance[] = [
      { asset_type_id: 't1', asset_type_name: 'FIIs', target_pct: 50, actual_pct: 0, deviation_pct: -50, total_value_brl: 0 },
      { asset_type_id: 't2', asset_type_name: 'Ações BR', target_pct: 50, actual_pct: 100, deviation_pct: 50, total_value_brl: 200000 },
    ];
    const slices = buildActualSlices(typesWithZero);
    expect(slices).toHaveLength(1);
    expect(slices[0].name).toBe('Ações BR');
  });

  it('types with 0% target are excluded from target slices', () => {
    const typesWithZero: TypePerformance[] = [
      { asset_type_id: 't1', asset_type_name: 'FIIs', target_pct: 0, actual_pct: 100, deviation_pct: 100, total_value_brl: 200000 },
      { asset_type_id: 't2', asset_type_name: 'Ações BR', target_pct: 100, actual_pct: 0, deviation_pct: -100, total_value_brl: 0 },
    ];
    const slices = buildTargetSlices(typesWithZero, 200000);
    expect(slices).toHaveLength(1);
    expect(slices[0].name).toBe('Ações BR');
    expect(slices[0].valueBrl).toBe(200000);
  });

  it('totalValueBrl of 0 results in 0 BRL for all target slices', () => {
    const slices = buildTargetSlices(TEN_TYPES, 0);
    for (const slice of slices) {
      expect(slice.valueBrl).toBe(0);
    }
  });
});

// ── Tests: getColor ─────────────────────────────────────────

describe('getColor', () => {
  it('returns distinct colors for indices 0-9', () => {
    const colors = Array.from({ length: 10 }, (_, i) => getColor(i));
    const unique = new Set(colors);
    expect(unique.size).toBe(10);
  });

  it('wraps around after 10 colors', () => {
    expect(getColor(10)).toBe(getColor(0));
    expect(getColor(11)).toBe(getColor(1));
  });

  it('returns valid hex color strings', () => {
    for (let i = 0; i < 10; i++) {
      expect(getColor(i)).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
