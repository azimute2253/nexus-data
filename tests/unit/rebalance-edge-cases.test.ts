import { describe, it, expect } from 'vitest';
import { rebalance } from '../../src/lib/nexus/rebalance.js';
import type { PortfolioInput } from '../../src/lib/nexus/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePortfolio(overrides: Partial<PortfolioInput> = {}): PortfolioInput {
  return {
    types: [
      { type_id: 'acoes', name: 'Ações', target_pct: 0.60, actual_value_brl: 5000 },
      { type_id: 'rf', name: 'RF', target_pct: 0.40, actual_value_brl: 3000 },
    ],
    groups: [
      { group_id: 'acoes_g1', name: 'Grupo 1', type_id: 'acoes', target_pct: 1.0 },
      { group_id: 'rf_g1', name: 'Grupo 1', type_id: 'rf', target_pct: 1.0 },
    ],
    assets: [
      { asset_id: 'v3', ticker: 'VALE3', group_id: 'acoes_g1', score: 8, price_brl: 77.13, is_active: true, manual_override: false, whole_shares: true },
      { asset_id: 'cdb', ticker: 'CDB', group_id: 'rf_g1', score: 5, price_brl: 1000, is_active: true, manual_override: false, whole_shares: false },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// T4.4.4 — Zero contribution
// ---------------------------------------------------------------------------

describe('T4.4.4 — Zero contribution', () => {
  const portfolio = makePortfolio();
  const result = rebalance(portfolio, 0);

  it('contribution is 0', () => {
    expect(result.contribution).toBe(0);
  });

  it('total_allocated is 0', () => {
    expect(result.total_allocated).toBe(0);
  });

  it('all type allocations are R$0', () => {
    for (const type of result.types) {
      expect(type.allocated).toBe(0);
    }
  });

  it('all asset allocations are R$0', () => {
    for (const type of result.types) {
      for (const group of type.groups) {
        for (const asset of group.assets) {
          expect(asset.allocated_brl).toBe(0);
          expect(asset.shares_to_buy).toBe(0);
          expect(asset.estimated_cost_brl).toBe(0);
        }
      }
    }
  });

  it('sum(allocations) === 0', () => {
    expect(result.total_spent).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// T4.4.5 — All types overweight (graceful degradation)
// ---------------------------------------------------------------------------

describe('T4.4.5 — All types overweight', () => {
  const portfolio = makePortfolio({
    types: [
      { type_id: 'acoes', name: 'Ações', target_pct: 0.10, actual_value_brl: 50000 },
      { type_id: 'rf', name: 'RF', target_pct: 0.10, actual_value_brl: 30000 },
    ],
  });
  const result = rebalance(portfolio, 1000);

  it('no error thrown', () => {
    expect(result).toBeDefined();
  });

  it('total_allocated equals contribution', () => {
    expect(result.total_allocated).toBe(1000);
  });

  it('sum(type allocations) equals contribution', () => {
    const sum = result.types.reduce((s, t) => s + t.allocated, 0);
    expect(sum).toBeCloseTo(1000, 2);
  });

  it('least-overweight type receives full contribution', () => {
    // rf has lower actual value → less overweight
    const rf = result.types.find((t) => t.type_id === 'rf')!;
    expect(rf.allocated).toBeCloseTo(1000, 2);
  });

  it('valid result structure', () => {
    expect(result.types.length).toBe(2);
    for (const type of result.types) {
      expect(type.groups.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// T4.4.6 — Group with all inactive assets (remainder tracked)
// ---------------------------------------------------------------------------

describe('T4.4.6 — Group with all inactive assets', () => {
  const portfolio = makePortfolio({
    assets: [
      { asset_id: 'v3', ticker: 'VALE3', group_id: 'acoes_g1', score: 8, price_brl: 77.13, is_active: false, manual_override: false, whole_shares: true },
      { asset_id: 'cdb', ticker: 'CDB', group_id: 'rf_g1', score: 5, price_brl: 1000, is_active: true, manual_override: false, whole_shares: false },
    ],
  });
  const result = rebalance(portfolio, 5000);

  it('no error thrown', () => {
    expect(result).toBeDefined();
  });

  it('acoes group: unallocated amount returned as remainder', () => {
    const acoes = result.types.find((t) => t.type_id === 'acoes')!;
    const group = acoes.groups[0];
    expect(group.remainder).toBeCloseTo(group.allocated, 2);
    expect(group.spent).toBe(0);
  });

  it('inactive asset gets zero shares', () => {
    const acoes = result.types.find((t) => t.type_id === 'acoes')!;
    const vale = acoes.groups[0].assets.find((a) => a.ticker === 'VALE3')!;
    expect(vale.shares_to_buy).toBe(0);
    expect(vale.estimated_cost_brl).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Edge: Single asset type receives entire contribution
// ---------------------------------------------------------------------------

describe('Edge — Single asset type', () => {
  const portfolio: PortfolioInput = {
    types: [
      { type_id: 'rf', name: 'RF', target_pct: 1.0, actual_value_brl: 5000 },
    ],
    groups: [
      { group_id: 'rf_g1', name: 'RF', type_id: 'rf', target_pct: 1.0 },
    ],
    assets: [
      { asset_id: 'cdb', ticker: 'CDB', group_id: 'rf_g1', score: 10, price_brl: 1000, is_active: true, manual_override: false, whole_shares: false },
    ],
  };

  const result = rebalance(portfolio, 3000);

  it('single type gets full contribution', () => {
    expect(result.types.length).toBe(1);
    expect(result.types[0].allocated).toBeCloseTo(3000, 2);
  });

  it('single asset gets full group allocation', () => {
    const asset = result.types[0].groups[0].assets[0];
    expect(asset.allocated_brl).toBeCloseTo(3000, 2);
    expect(asset.shares_to_buy).toBeCloseTo(3, 4);
  });
});

// ---------------------------------------------------------------------------
// Edge: Score of 0 for all assets → equal distribution
// ---------------------------------------------------------------------------

describe('Edge — All scores equal zero → equal distribution', () => {
  const portfolio: PortfolioInput = {
    types: [
      { type_id: 'acoes', name: 'Ações', target_pct: 1.0, actual_value_brl: 0 },
    ],
    groups: [
      { group_id: 'g1', name: 'Grupo', type_id: 'acoes', target_pct: 1.0 },
    ],
    assets: [
      { asset_id: 'a1', ticker: 'A', group_id: 'g1', score: 0, price_brl: 100, is_active: true, manual_override: false, whole_shares: true },
      { asset_id: 'a2', ticker: 'B', group_id: 'g1', score: 0, price_brl: 100, is_active: true, manual_override: false, whole_shares: true },
    ],
  };

  const result = rebalance(portfolio, 1000);

  it('each asset gets 50% ideal_pct', () => {
    const assets = result.types[0].groups[0].assets;
    for (const a of assets) {
      expect(a.ideal_pct).toBeCloseTo(50, 1);
    }
  });

  it('each asset gets R$500 allocation', () => {
    const assets = result.types[0].groups[0].assets;
    for (const a of assets) {
      expect(a.allocated_brl).toBeCloseTo(500, 2);
    }
  });
});

// ---------------------------------------------------------------------------
// Edge: Negative group total score (all negative after shift → equal)
// ---------------------------------------------------------------------------

describe('Edge — Negative scores normalize correctly', () => {
  const portfolio: PortfolioInput = {
    types: [
      { type_id: 'acoes', name: 'Ações', target_pct: 1.0, actual_value_brl: 0 },
    ],
    groups: [
      { group_id: 'g1', name: 'Grupo', type_id: 'acoes', target_pct: 1.0 },
    ],
    assets: [
      { asset_id: 'a1', ticker: 'A', group_id: 'g1', score: -5, price_brl: 100, is_active: true, manual_override: false, whole_shares: true },
      { asset_id: 'a2', ticker: 'B', group_id: 'g1', score: -5, price_brl: 100, is_active: true, manual_override: false, whole_shares: true },
    ],
  };

  const result = rebalance(portfolio, 1000);

  it('all equal negative scores → equal distribution', () => {
    const assets = result.types[0].groups[0].assets;
    for (const a of assets) {
      expect(a.ideal_pct).toBeCloseTo(50, 1);
    }
  });

  it('no error thrown, valid result', () => {
    expect(result.total_allocated).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// Validation: empty types throws
// ---------------------------------------------------------------------------

describe('Validation — empty types array throws', () => {
  it('throws descriptive error for empty types', () => {
    const portfolio: PortfolioInput = {
      types: [],
      groups: [{ group_id: 'g1', name: 'G', type_id: 'x', target_pct: 1.0 }],
      assets: [],
    };
    expect(() => rebalance(portfolio, 1000)).toThrow(
      'Portfolio must contain at least one asset type',
    );
  });

  it('throws descriptive error for empty groups', () => {
    const portfolio: PortfolioInput = {
      types: [{ type_id: 'a', name: 'A', target_pct: 1.0, actual_value_brl: 0 }],
      groups: [],
      assets: [],
    };
    expect(() => rebalance(portfolio, 1000)).toThrow(
      'Portfolio must contain at least one asset group',
    );
  });
});

// ---------------------------------------------------------------------------
// Determinism: same inputs → identical outputs
// ---------------------------------------------------------------------------

describe('Determinism — same inputs produce identical outputs', () => {
  const portfolio = makePortfolio();

  it('two calls produce deep-equal results', () => {
    const r1 = rebalance(portfolio, 5000);
    const r2 = rebalance(portfolio, 5000);
    expect(r1).toEqual(r2);
  });
});
