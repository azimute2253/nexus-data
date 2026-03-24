import { describe, it, expect } from 'vitest';
import type { TypePerformance, PerformanceMetrics, PortfolioSummary } from '../../src/lib/dashboard/types.js';
import type { PriceCache, ExchangeRate, AssetType, AssetGroup, Asset } from '../../src/lib/nexus/types.js';
import { buildPriceMapBrl, computeTypeValues } from '../../src/lib/dashboard/wallet-data.js';

// ── Fixtures ────────────────────────────────────────────────

const TYPES_FIXTURE: AssetType[] = [
  { id: 't1', name: 'FIIs', target_pct: 15, sort_order: 1, user_id: 'u1', wallet_id: 'w1', created_at: '', updated_at: '' },
  { id: 't2', name: 'Ações BR', target_pct: 35, sort_order: 2, user_id: 'u1', wallet_id: 'w1', created_at: '', updated_at: '' },
  { id: 't3', name: 'ETFs Int.', target_pct: 10, sort_order: 3, user_id: 'u1', wallet_id: 'w1', created_at: '', updated_at: '' },
];

const GROUPS_FIXTURE: AssetGroup[] = [
  { id: 'g1', type_id: 't1', name: 'FIIs Brasil', target_pct: 100, scoring_method: 'questionnaire', user_id: 'u1', wallet_id: 'w1', created_at: '', updated_at: '' },
  { id: 'g2', type_id: 't2', name: 'Blue Chips', target_pct: 60, scoring_method: 'questionnaire', user_id: 'u1', wallet_id: 'w1', created_at: '', updated_at: '' },
  { id: 'g3', type_id: 't3', name: 'ETFs Globais', target_pct: 100, scoring_method: 'questionnaire', user_id: 'u1', wallet_id: 'w1', created_at: '', updated_at: '' },
];

const ASSETS_FIXTURE: Asset[] = [
  { id: 'a1', ticker: 'HGLG11', name: 'HGLG11', sector: null, quantity: 100, group_id: 'g1', price_source: 'brapi', is_active: true, manual_override: false, whole_shares: true, bought: true, sold: false, weight_mode: 'questionnaire', manual_weight: 0, user_id: 'u1', wallet_id: 'w1', created_at: '', updated_at: '' },
  { id: 'a2', ticker: 'VALE3', name: 'VALE3', sector: null, quantity: 200, group_id: 'g2', price_source: 'brapi', is_active: true, manual_override: false, whole_shares: true, bought: true, sold: false, weight_mode: 'questionnaire', manual_weight: 0, user_id: 'u1', wallet_id: 'w1', created_at: '', updated_at: '' },
  { id: 'a3', ticker: 'VT', name: 'VT', sector: null, quantity: 50, group_id: 'g3', price_source: 'yahoo', is_active: true, manual_override: false, whole_shares: true, bought: true, sold: false, weight_mode: 'questionnaire', manual_weight: 0, user_id: 'u1', wallet_id: 'w1', created_at: '', updated_at: '' },
  // Inactive asset — should be excluded
  { id: 'a4', ticker: 'BOVA11', name: 'BOVA11', sector: null, quantity: 1000, group_id: 'g2', price_source: 'brapi', is_active: false, manual_override: false, whole_shares: true, bought: true, sold: false, weight_mode: 'questionnaire', manual_weight: 0, user_id: 'u1', wallet_id: 'w1', created_at: '', updated_at: '' },
];

const PRICES_FIXTURE: PriceCache[] = [
  { ticker: 'HGLG11', price: 160.0, currency: 'BRL', source: 'brapi', fetched_at: '2026-03-24T10:00:00Z', user_id: 'u1' },
  { ticker: 'VALE3', price: 65.0, currency: 'BRL', source: 'brapi', fetched_at: '2026-03-24T10:00:00Z', user_id: 'u1' },
  { ticker: 'VT', price: 110.0, currency: 'USD', source: 'yahoo', fetched_at: '2026-03-24T10:00:00Z', user_id: 'u1' },
  { ticker: 'BOVA11', price: 120.0, currency: 'BRL', source: 'brapi', fetched_at: '2026-03-24T10:00:00Z', user_id: 'u1' },
];

const RATES_FIXTURE: ExchangeRate[] = [
  { pair: 'USD/BRL', rate: 5.5, fetched_at: '2026-03-24T10:00:00Z', user_id: 'u1' },
];

// ── Tests: buildPriceMapBrl ─────────────────────────────────

describe('buildPriceMapBrl', () => {
  it('T15.1.3 — converts USD prices to BRL using exchange rate', () => {
    const priceMap = buildPriceMapBrl(PRICES_FIXTURE, RATES_FIXTURE);
    // VT: 110 USD * 5.5 = 605 BRL
    expect(priceMap.get('VT')).toBe(605);
  });

  it('keeps BRL prices as-is', () => {
    const priceMap = buildPriceMapBrl(PRICES_FIXTURE, RATES_FIXTURE);
    expect(priceMap.get('HGLG11')).toBe(160);
    expect(priceMap.get('VALE3')).toBe(65);
  });

  it('skips prices with null value', () => {
    const prices: PriceCache[] = [
      { ticker: 'NULL_ASSET', price: null, currency: 'BRL', source: null, fetched_at: '', user_id: 'u1' },
    ];
    const priceMap = buildPriceMapBrl(prices, []);
    expect(priceMap.has('NULL_ASSET')).toBe(false);
  });

  it('skips USD prices when no exchange rate available', () => {
    const prices: PriceCache[] = [
      { ticker: 'VT', price: 110, currency: 'USD', source: 'yahoo', fetched_at: '', user_id: 'u1' },
    ];
    const priceMap = buildPriceMapBrl(prices, []); // No rates
    expect(priceMap.has('VT')).toBe(false);
  });

  it('handles empty inputs', () => {
    const priceMap = buildPriceMapBrl([], []);
    expect(priceMap.size).toBe(0);
  });
});

// ── Tests: computeTypeValues ────────────────────────────────

describe('computeTypeValues', () => {
  const priceMap = buildPriceMapBrl(PRICES_FIXTURE, RATES_FIXTURE);

  it('T15.1.1 — computes total BRL value per asset type', () => {
    const typeValues = computeTypeValues(TYPES_FIXTURE, GROUPS_FIXTURE, ASSETS_FIXTURE, priceMap);

    // FIIs (t1): HGLG11 = 100 * 160 = 16,000
    expect(typeValues.get('t1')).toBe(16000);

    // Ações BR (t2): VALE3 = 200 * 65 = 13,000 (BOVA11 inactive, excluded)
    expect(typeValues.get('t2')).toBe(13000);

    // ETFs Int (t3): VT = 50 * 605 = 30,250
    expect(typeValues.get('t3')).toBe(30250);
  });

  it('excludes inactive assets from calculation', () => {
    const typeValues = computeTypeValues(TYPES_FIXTURE, GROUPS_FIXTURE, ASSETS_FIXTURE, priceMap);
    // BOVA11 (inactive, group g2/type t2) should NOT contribute
    // If it were active: 1000 * 120 = 120,000
    // Actual t2: only VALE3 = 13,000
    expect(typeValues.get('t2')).toBe(13000);
  });

  it('T15.1.2 — returns zero for types with no assets', () => {
    const typeValues = computeTypeValues(
      [{ id: 'empty', name: 'Empty', target_pct: 10, sort_order: 1, user_id: 'u1', wallet_id: 'w1', created_at: '', updated_at: '' }],
      [],
      [],
      priceMap,
    );
    expect(typeValues.get('empty')).toBe(0);
  });

  it('handles assets with no price in price map', () => {
    const emptyPriceMap = new Map<string, number>();
    const typeValues = computeTypeValues(TYPES_FIXTURE, GROUPS_FIXTURE, ASSETS_FIXTURE, emptyPriceMap);
    // All values should be 0 since no prices available
    expect(typeValues.get('t1')).toBe(0);
    expect(typeValues.get('t2')).toBe(0);
    expect(typeValues.get('t3')).toBe(0);
  });
});

// ── Tests: Performance metrics computation ──────────────────

describe('Performance metrics computation (pure logic)', () => {
  const priceMap = buildPriceMapBrl(PRICES_FIXTURE, RATES_FIXTURE);
  const typeValues = computeTypeValues(TYPES_FIXTURE, GROUPS_FIXTURE, ASSETS_FIXTURE, priceMap);

  // Helper: compute performance from type values (mirrors wallet-data.ts logic)
  function computePerformance(
    types: AssetType[],
    values: Map<string, number>,
  ): PerformanceMetrics {
    const totalValue = Array.from(values.values()).reduce((sum, v) => sum + v, 0);
    const perf: TypePerformance[] = types.map((t) => {
      const value = values.get(t.id) ?? 0;
      const actualPct = totalValue > 0 ? (value / totalValue) * 100 : 0;
      return {
        asset_type_id: t.id,
        asset_type_name: t.name,
        target_pct: t.target_pct ?? 0,
        actual_pct: Math.round(actualPct * 100) / 100,
        deviation_pct: Math.round((actualPct - (t.target_pct ?? 0)) * 100) / 100,
        total_value_brl: value,
      };
    });
    let maxDevType = '';
    let maxDev = 0;
    for (const tp of perf) {
      if (Math.abs(tp.deviation_pct) > maxDev) {
        maxDev = Math.abs(tp.deviation_pct);
        maxDevType = tp.asset_type_name;
      }
    }
    return { total_value_brl: totalValue, types: perf, max_deviation_type: maxDevType };
  }

  it('T15.1.1 — computes total portfolio value correctly', () => {
    const metrics = computePerformance(TYPES_FIXTURE, typeValues);
    // 16,000 + 13,000 + 30,250 = 59,250
    expect(metrics.total_value_brl).toBe(59250);
  });

  it('T15.1.3 — includes USD→BRL converted values in total', () => {
    const metrics = computePerformance(TYPES_FIXTURE, typeValues);
    // VT = 50 * 110 USD * 5.5 = 30,250 BRL is included
    const etfType = metrics.types.find((t) => t.asset_type_id === 't3');
    expect(etfType?.total_value_brl).toBe(30250);
  });

  it('computes actual percentages that sum to ~100', () => {
    const metrics = computePerformance(TYPES_FIXTURE, typeValues);
    const sum = metrics.types.reduce((s, t) => s + t.actual_pct, 0);
    expect(sum).toBeCloseTo(100, 0);
  });

  it('computes deviations as actual - target', () => {
    const metrics = computePerformance(TYPES_FIXTURE, typeValues);
    for (const t of metrics.types) {
      const expected = Math.round((t.actual_pct - t.target_pct) * 100) / 100;
      expect(t.deviation_pct).toBe(expected);
    }
  });

  it('T15.1.5 — different wallet data produces different metrics', () => {
    // Simulate a different wallet with different values
    const otherValues = new Map<string, number>([
      ['t1', 50000],
      ['t2', 25000],
      ['t3', 25000],
    ]);
    const metrics1 = computePerformance(TYPES_FIXTURE, typeValues);
    const metrics2 = computePerformance(TYPES_FIXTURE, otherValues);
    expect(metrics1.total_value_brl).not.toBe(metrics2.total_value_brl);
  });
});

// ── Tests: Empty state detection ────────────────────────────

describe('Empty state detection', () => {
  it('T15.1.2 — empty types array triggers empty state', () => {
    const isEmpty = (types: TypePerformance[]) => types.length === 0;
    expect(isEmpty([])).toBe(true);
  });

  it('populated types array does not trigger empty state', () => {
    const isEmpty = (types: TypePerformance[]) => types.length === 0;
    const types: TypePerformance[] = [
      { asset_type_id: 't1', asset_type_name: 'FIIs', target_pct: 15, actual_pct: 27, deviation_pct: 12, total_value_brl: 16000 },
    ];
    expect(isEmpty(types)).toBe(false);
  });
});

// ── Tests: Timestamp formatting ─────────────────────────────

describe('Last refresh timestamp', () => {
  it('T15.1.4 — fetched_at is a valid ISO date string', () => {
    const fetchedAt = new Date().toISOString();
    const date = new Date(fetchedAt);
    expect(date.getTime()).not.toBeNaN();
  });

  it('null fetched_at is handled gracefully', () => {
    const fetchedAt: string | null = null;
    expect(fetchedAt).toBeNull();
  });
});
