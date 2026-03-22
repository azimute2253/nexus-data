import { describe, it, expect } from 'vitest';
import { distributeL3 } from '../../src/lib/nexus/rebalance.js';
import type { L2Result, L3AssetInput } from '../../src/lib/nexus/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeL2(
  overrides: Partial<L2Result> & Pick<L2Result, 'group_id' | 'allocated'>,
): L2Result {
  return {
    name: overrides.group_id,
    type_id: 'test_type',
    target_pct: 0.5,
    ...overrides,
  };
}

function makeAsset(
  overrides: Partial<L3AssetInput> &
    Pick<L3AssetInput, 'asset_id' | 'ticker' | 'group_id' | 'score' | 'price_brl'>,
): L3AssetInput {
  return {
    is_active: true,
    manual_override: false,
    whole_shares: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// T4.3.1 — Group with R$1,000, 3 stocks (scores: 8, 5, 3)
// ---------------------------------------------------------------------------

describe('T4.3.1 — R$1,000 group, 3 stocks with scores 8/5/3', () => {
  const l2: L2Result[] = [makeL2({ group_id: 'large_cap', allocated: 1_000 })];

  const assets: L3AssetInput[] = [
    makeAsset({ asset_id: 'a1', ticker: 'PETR4', group_id: 'large_cap', score: 8, price_brl: 38.50 }),
    makeAsset({ asset_id: 'a2', ticker: 'VALE3', group_id: 'large_cap', score: 5, price_brl: 62.00 }),
    makeAsset({ asset_id: 'a3', ticker: 'ITUB4', group_id: 'large_cap', score: 3, price_brl: 27.00 }),
  ];

  const summaries = distributeL3(l2, assets);
  const summary = summaries[0];

  it('AC1: produces results for all 3 assets', () => {
    expect(summary.assets.length).toBe(3);
  });

  it('AC1: allocates proportionally to normalized scores', () => {
    // scores 8, 5, 3 → total 16 → 50%, 31.25%, 18.75%
    const petr = summary.assets.find((a) => a.ticker === 'PETR4')!;
    const vale = summary.assets.find((a) => a.ticker === 'VALE3')!;
    const itub = summary.assets.find((a) => a.ticker === 'ITUB4')!;

    expect(petr.ideal_pct).toBeCloseTo(50, 1);
    expect(vale.ideal_pct).toBeCloseTo(31.25, 1);
    expect(itub.ideal_pct).toBeCloseTo(18.75, 1);
  });

  it('AC2: shares are integers (whole_shares = true)', () => {
    for (const a of summary.assets) {
      expect(Number.isInteger(a.shares_to_buy)).toBe(true);
    }
  });

  it('AC3: estimated cost ≤ allocated amount per asset', () => {
    for (const a of summary.assets) {
      expect(a.estimated_cost_brl).toBeLessThanOrEqual(a.allocated_brl + 0.01);
    }
  });

  it('AC3: total spent ≤ group allocation', () => {
    expect(summary.spent_brl).toBeLessThanOrEqual(1_000);
  });

  it('AC6: remainder is tracked', () => {
    expect(summary.remainder_brl).toBeGreaterThanOrEqual(0);
    expect(summary.remainder_brl).toBeCloseTo(1_000 - summary.spent_brl, 2);
  });

  it('shares_to_buy calculation is correct (FLOOR)', () => {
    const petr = summary.assets.find((a) => a.ticker === 'PETR4')!;
    // 50% of 1000 = R$500, 500 / 38.50 = 12.987 → floor = 12
    expect(petr.shares_to_buy).toBe(12);
    expect(petr.estimated_cost_brl).toBeCloseTo(12 * 38.50, 2);
  });
});

// ---------------------------------------------------------------------------
// T4.3.2 — ETF with fractional shares
// ---------------------------------------------------------------------------

describe('T4.3.2 — ETF with fractional shares allowed', () => {
  const l2: L2Result[] = [makeL2({ group_id: 'etf_int', allocated: 500 })];

  const assets: L3AssetInput[] = [
    makeAsset({
      asset_id: 'e1',
      ticker: 'VT',
      group_id: 'etf_int',
      score: 10,
      price_brl: 250, // price already in BRL (converted)
      whole_shares: false,
    }),
  ];

  const summaries = distributeL3(l2, assets);
  const result = summaries[0].assets[0];

  it('AC1: single asset gets 100% of group', () => {
    expect(result.ideal_pct).toBeCloseTo(100, 1);
    expect(result.allocated_brl).toBeCloseTo(500, 2);
  });

  it('AC2: fractional shares allowed (not floored)', () => {
    // 500 / 250 = 2.0 (exact in this case)
    expect(result.shares_to_buy).toBeCloseTo(2.0, 4);
  });

  it('no remainder for exact fractional division', () => {
    expect(summaries[0].remainder_brl).toBeCloseTo(0, 2);
  });
});

// ---------------------------------------------------------------------------
// T4.3.3 — Asset with is_active=false excluded
// ---------------------------------------------------------------------------

describe('T4.3.3 — Inactive asset excluded from calculation', () => {
  const l2: L2Result[] = [makeL2({ group_id: 'g1', allocated: 1_000 })];

  const assets: L3AssetInput[] = [
    makeAsset({ asset_id: 'a1', ticker: 'PETR4', group_id: 'g1', score: 8, price_brl: 40, is_active: true }),
    makeAsset({ asset_id: 'a2', ticker: 'DEAD3', group_id: 'g1', score: 5, price_brl: 20, is_active: false }),
  ];

  const summaries = distributeL3(l2, assets);
  const summary = summaries[0];

  it('AC5: inactive asset gets zero shares', () => {
    const dead = summary.assets.find((a) => a.ticker === 'DEAD3')!;
    expect(dead.shares_to_buy).toBe(0);
    expect(dead.estimated_cost_brl).toBe(0);
    expect(dead.allocated_brl).toBe(0);
  });

  it('AC5: active asset gets full allocation', () => {
    const petr = summary.assets.find((a) => a.ticker === 'PETR4')!;
    expect(petr.ideal_pct).toBeCloseTo(100, 1);
    expect(petr.allocated_brl).toBeCloseTo(1_000, 2);
  });
});

// ---------------------------------------------------------------------------
// T4.3.4 — Asset with manual_override=true excluded
// ---------------------------------------------------------------------------

describe('T4.3.4 — Manual override asset excluded', () => {
  const l2: L2Result[] = [makeL2({ group_id: 'g1', allocated: 1_000 })];

  const assets: L3AssetInput[] = [
    makeAsset({ asset_id: 'a1', ticker: 'VALE3', group_id: 'g1', score: 5, price_brl: 60 }),
    makeAsset({ asset_id: 'a2', ticker: 'MGLU3', group_id: 'g1', score: 7, price_brl: 10, manual_override: true }),
  ];

  const summaries = distributeL3(l2, assets);
  const summary = summaries[0];

  it('overridden asset gets zero shares', () => {
    const mglu = summary.assets.find((a) => a.ticker === 'MGLU3')!;
    expect(mglu.shares_to_buy).toBe(0);
    expect(mglu.allocated_brl).toBe(0);
  });

  it('remaining asset gets full group allocation', () => {
    const vale = summary.assets.find((a) => a.ticker === 'VALE3')!;
    expect(vale.ideal_pct).toBeCloseTo(100, 1);
  });
});

// ---------------------------------------------------------------------------
// T4.3.5 — All assets in group inactive
// ---------------------------------------------------------------------------

describe('T4.3.5 — All assets inactive → full amount as remainder', () => {
  const l2: L2Result[] = [makeL2({ group_id: 'g1', allocated: 2_000 })];

  const assets: L3AssetInput[] = [
    makeAsset({ asset_id: 'a1', ticker: 'X1', group_id: 'g1', score: 5, price_brl: 10, is_active: false }),
    makeAsset({ asset_id: 'a2', ticker: 'X2', group_id: 'g1', score: 3, price_brl: 20, manual_override: true }),
  ];

  const summaries = distributeL3(l2, assets);
  const summary = summaries[0];

  it('AC8: remainder equals full group allocation', () => {
    expect(summary.remainder_brl).toBeCloseTo(2_000, 2);
  });

  it('AC8: spent is zero', () => {
    expect(summary.spent_brl).toBe(0);
  });

  it('all assets get zero', () => {
    for (const a of summary.assets) {
      expect(a.shares_to_buy).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// T4.3.6 — Negative scores handled via normalization
// ---------------------------------------------------------------------------

describe('T4.3.6 — Negative scores normalized correctly', () => {
  const l2: L2Result[] = [makeL2({ group_id: 'g1', allocated: 1_000 })];

  // scores: -10, 5, 15 → shifted: 0, 15, 25 → normalized: 0%, 37.5%, 62.5%
  const assets: L3AssetInput[] = [
    makeAsset({ asset_id: 'a1', ticker: 'XPLG11', group_id: 'g1', score: -10, price_brl: 100 }),
    makeAsset({ asset_id: 'a2', ticker: 'HGLG11', group_id: 'g1', score: 5, price_brl: 160 }),
    makeAsset({ asset_id: 'a3', ticker: 'KNRI11', group_id: 'g1', score: 15, price_brl: 130 }),
  ];

  const summaries = distributeL3(l2, assets);
  const summary = summaries[0];

  it('negative-scored asset gets allocation (shifted to 0%)', () => {
    const xplg = summary.assets.find((a) => a.ticker === 'XPLG11')!;
    expect(xplg.ideal_pct).toBeCloseTo(0, 1);
    expect(xplg.shares_to_buy).toBe(0);
  });

  it('positive-scored assets share allocation proportionally', () => {
    const hglg = summary.assets.find((a) => a.ticker === 'HGLG11')!;
    const knri = summary.assets.find((a) => a.ticker === 'KNRI11')!;
    expect(hglg.ideal_pct).toBeCloseTo(37.5, 1);
    expect(knri.ideal_pct).toBeCloseTo(62.5, 1);
  });
});

// ---------------------------------------------------------------------------
// Edge: zero deviation (score 0 for all) — equal distribution
// ---------------------------------------------------------------------------

describe('Edge — All scores equal → equal distribution', () => {
  const l2: L2Result[] = [makeL2({ group_id: 'g1', allocated: 900 })];

  const assets: L3AssetInput[] = [
    makeAsset({ asset_id: 'a1', ticker: 'A', group_id: 'g1', score: 5, price_brl: 100 }),
    makeAsset({ asset_id: 'a2', ticker: 'B', group_id: 'g1', score: 5, price_brl: 100 }),
    makeAsset({ asset_id: 'a3', ticker: 'C', group_id: 'g1', score: 5, price_brl: 100 }),
  ];

  const summaries = distributeL3(l2, assets);
  const summary = summaries[0];

  it('each asset gets equal ideal_pct', () => {
    for (const a of summary.assets) {
      expect(a.ideal_pct).toBeCloseTo(100 / 3, 1);
    }
  });

  it('each asset gets R$300 allocation', () => {
    for (const a of summary.assets) {
      expect(a.allocated_brl).toBeCloseTo(300, 2);
    }
  });

  it('FLOOR: each asset gets 2-3 shares (floating-point FLOOR)', () => {
    // 100/3 ≈ 33.333% → 33.333% * 900 ≈ 300 → floor(300/100) = 3
    // But floating-point can produce 299.999... → floor = 2
    const totalShares = summary.assets.reduce((s, a) => s + a.shares_to_buy, 0);
    expect(totalShares).toBeGreaterThanOrEqual(6);
    expect(totalShares).toBeLessThanOrEqual(9);
    for (const a of summary.assets) {
      expect(a.shares_to_buy).toBeGreaterThanOrEqual(2);
      expect(a.shares_to_buy).toBeLessThanOrEqual(3);
    }
  });
});

// ---------------------------------------------------------------------------
// Edge: zero price — no shares bought
// ---------------------------------------------------------------------------

describe('Edge — Asset with price 0 → zero shares', () => {
  const l2: L2Result[] = [makeL2({ group_id: 'g1', allocated: 500 })];

  const assets: L3AssetInput[] = [
    makeAsset({ asset_id: 'a1', ticker: 'FREE', group_id: 'g1', score: 10, price_brl: 0 }),
  ];

  const summaries = distributeL3(l2, assets);

  it('zero-price asset gets 0 shares', () => {
    expect(summaries[0].assets[0].shares_to_buy).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Edge: group with no assets defined → empty results
// ---------------------------------------------------------------------------

describe('Edge — L2 group with no assets → empty summary', () => {
  const l2: L2Result[] = [makeL2({ group_id: 'empty_group', allocated: 1_000 })];

  const summaries = distributeL3(l2, []);
  const summary = summaries[0];

  it('remainder equals full allocation', () => {
    expect(summary.remainder_brl).toBeCloseTo(1_000, 2);
  });

  it('no asset results', () => {
    expect(summary.assets.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Multi-group cascade — multiple L2 results with assets
// ---------------------------------------------------------------------------

describe('Multi-group cascade — 2 groups with different assets', () => {
  const l2: L2Result[] = [
    makeL2({ group_id: 'stocks', allocated: 2_000 }),
    makeL2({ group_id: 'etfs', allocated: 1_000 }),
  ];

  const assets: L3AssetInput[] = [
    makeAsset({ asset_id: 's1', ticker: 'PETR4', group_id: 'stocks', score: 6, price_brl: 38 }),
    makeAsset({ asset_id: 's2', ticker: 'VALE3', group_id: 'stocks', score: 4, price_brl: 62 }),
    makeAsset({ asset_id: 'e1', ticker: 'VT', group_id: 'etfs', score: 7, price_brl: 500, whole_shares: false }),
    makeAsset({ asset_id: 'e2', ticker: 'VEA', group_id: 'etfs', score: 3, price_brl: 250, whole_shares: false }),
  ];

  const summaries = distributeL3(l2, assets);

  it('produces 2 group summaries', () => {
    expect(summaries.length).toBe(2);
  });

  it('stocks group: whole shares (FLOOR)', () => {
    const stocks = summaries.find((s) => s.group_id === 'stocks')!;
    for (const a of stocks.assets) {
      expect(Number.isInteger(a.shares_to_buy)).toBe(true);
    }
  });

  it('etfs group: fractional shares', () => {
    const etfs = summaries.find((s) => s.group_id === 'etfs')!;
    const vt = etfs.assets.find((a) => a.ticker === 'VT')!;
    // 70% of 1000 = 700, 700/500 = 1.4
    expect(vt.shares_to_buy).toBeCloseTo(1.4, 4);
  });

  it('total spent across groups ≤ total allocated', () => {
    const totalSpent = summaries.reduce((s, g) => s + g.spent_brl, 0);
    expect(totalSpent).toBeLessThanOrEqual(3_000);
  });
});

// ---------------------------------------------------------------------------
// Pure function — determinism
// ---------------------------------------------------------------------------

describe('Pure function — same inputs produce identical outputs', () => {
  const l2: L2Result[] = [makeL2({ group_id: 'g1', allocated: 5_000 })];

  const assets: L3AssetInput[] = [
    makeAsset({ asset_id: 'a1', ticker: 'PETR4', group_id: 'g1', score: 8, price_brl: 38.50 }),
    makeAsset({ asset_id: 'a2', ticker: 'VALE3', group_id: 'g1', score: 5, price_brl: 62.00 }),
  ];

  it('two calls produce deep-equal results', () => {
    const r1 = distributeL3(l2, assets);
    const r2 = distributeL3(l2, assets);
    expect(r1).toEqual(r2);
  });
});

// ---------------------------------------------------------------------------
// Output metadata — fields preserved correctly
// ---------------------------------------------------------------------------

describe('Output metadata — asset_id, ticker, group_id preserved', () => {
  const l2: L2Result[] = [makeL2({ group_id: 'g1', allocated: 1_000 })];

  const assets: L3AssetInput[] = [
    makeAsset({ asset_id: 'abc-123', ticker: 'WEGE3', group_id: 'g1', score: 10, price_brl: 35 }),
  ];

  const summaries = distributeL3(l2, assets);
  const result = summaries[0].assets[0];

  it('preserves asset metadata', () => {
    expect(result.asset_id).toBe('abc-123');
    expect(result.ticker).toBe('WEGE3');
    expect(result.group_id).toBe('g1');
  });

  it('output contains correct fields', () => {
    expect(result).toHaveProperty('ideal_pct');
    expect(result).toHaveProperty('allocated_brl');
    expect(result).toHaveProperty('shares_to_buy');
    expect(result).toHaveProperty('estimated_cost_brl');
    expect(result).toHaveProperty('remainder_brl');
  });
});
