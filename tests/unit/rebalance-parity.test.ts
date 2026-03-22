import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { rebalance } from '../../src/lib/nexus/rebalance.js';
import type { PortfolioInput, RebalanceResult } from '../../src/lib/nexus/types.js';

// ---------------------------------------------------------------------------
// Load reference fixture data
// ---------------------------------------------------------------------------

interface Scenario {
  id: string;
  description: string;
  contribution: number;
  portfolio: PortfolioInput;
}

const fixtures = JSON.parse(
  readFileSync(new URL('../fixtures/spreadsheet-reference.json', import.meta.url), 'utf8'),
) as { scenarios: Scenario[] };

const TOLERANCE = 1.0; // R$1 per-asset tolerance (ADR-004 Obligation 1)

// ---------------------------------------------------------------------------
// Helper: flatten all assets from a RebalanceResult
// ---------------------------------------------------------------------------

function flattenAssets(result: RebalanceResult) {
  const assets: Array<{ ticker: string; allocated_brl: number; estimated_cost_brl: number; shares_to_buy: number }> = [];
  for (const type of result.types) {
    for (const group of type.groups) {
      for (const asset of group.assets) {
        assets.push(asset);
      }
    }
  }
  return assets;
}

// ---------------------------------------------------------------------------
// T4.4.1 — Scenario 1: R$12,000, real portfolio (FIIs overweight)
// ---------------------------------------------------------------------------

describe('T4.4.1 — Scenario 1: R$12,000 with real portfolio data', () => {
  const scenario = fixtures.scenarios[0];
  const result = rebalance(scenario.portfolio, scenario.contribution);

  it('total_allocated equals contribution', () => {
    expect(result.total_allocated).toBeCloseTo(scenario.contribution, 2);
  });

  it('sum of type allocations equals contribution', () => {
    const sum = result.types.reduce((s, t) => s + t.allocated, 0);
    expect(sum).toBeCloseTo(scenario.contribution, 2);
  });

  it('FIIs (overweight) receive R$0', () => {
    const fiis = result.types.find((t) => t.type_id === 'fiis')!;
    expect(fiis.allocated).toBe(0);
  });

  it('REITs (overweight) receive R$0', () => {
    const reits = result.types.find((t) => t.type_id === 'reits')!;
    expect(reits.allocated).toBe(0);
  });

  it('Ações BR receives ~R$4,209 (within tolerance)', () => {
    const acoes = result.types.find((t) => t.type_id === 'acoes_br')!;
    expect(Math.abs(acoes.allocated - 4209.18)).toBeLessThan(TOLERANCE);
  });

  it('Ações US receives ~R$3,032 (within tolerance)', () => {
    const us = result.types.find((t) => t.type_id === 'acoes_us')!;
    expect(Math.abs(us.allocated - 3031.80)).toBeLessThan(TOLERANCE);
  });

  it('nested structure: types[].groups[].assets[] present', () => {
    for (const type of result.types) {
      expect(type).toHaveProperty('groups');
      for (const group of type.groups) {
        expect(group).toHaveProperty('assets');
      }
    }
  });

  it('all asset amounts sum correctly (within tolerance)', () => {
    const assets = flattenAssets(result);
    const totalEstimated = assets.reduce((s, a) => s + a.estimated_cost_brl, 0);
    expect(totalEstimated).toBeCloseTo(result.total_spent, 2);
  });

  it('total_spent + total_remainder ≤ contribution', () => {
    expect(result.total_spent + result.total_remainder).toBeLessThanOrEqual(
      scenario.contribution + 0.01,
    );
  });

  it('per-asset: max(abs(diff)) < R$1 from expected allocation', () => {
    // Verify each type's allocation matches expected within tolerance
    const expected: Record<string, number> = {
      reserva_inv: 1058.47,
      reserva_val: 900.93,
      rf_br: 1097.22,
      fiis: 0,
      acoes_br: 4209.18,
      acoes_us: 3031.80,
      reits: 0,
      rf_ext: 643.91,
      acoes_eu: 635.08,
      acoes_asia: 423.39,
    };

    for (const type of result.types) {
      const exp = expected[type.type_id];
      if (exp !== undefined) {
        expect(
          Math.abs(type.allocated - exp),
          `${type.type_id}: expected ~${exp}, got ${type.allocated}`,
        ).toBeLessThan(TOLERANCE);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// T4.4.2 — Scenario 2: R$5,000, 3-type portfolio
// ---------------------------------------------------------------------------

describe('T4.4.2 — Scenario 2: R$5,000 with 3-type portfolio', () => {
  const scenario = fixtures.scenarios[1];
  const result = rebalance(scenario.portfolio, scenario.contribution);

  it('total_allocated equals R$5,000', () => {
    expect(result.total_allocated).toBeCloseTo(5000, 2);
  });

  it('Ações receives ~R$500 (within tolerance)', () => {
    const acoes = result.types.find((t) => t.type_id === 'acoes')!;
    expect(Math.abs(acoes.allocated - 500)).toBeLessThan(TOLERANCE);
  });

  it('FIIs receives ~R$2,100 (within tolerance)', () => {
    const fiis = result.types.find((t) => t.type_id === 'fiis')!;
    expect(Math.abs(fiis.allocated - 2100)).toBeLessThan(TOLERANCE);
  });

  it('RF receives ~R$2,400 (within tolerance)', () => {
    const rf = result.types.find((t) => t.type_id === 'rf')!;
    expect(Math.abs(rf.allocated - 2400)).toBeLessThan(TOLERANCE);
  });

  it('groups sum to type allocations', () => {
    for (const type of result.types) {
      const groupSum = type.groups.reduce((s, g) => s + g.allocated, 0);
      expect(groupSum).toBeCloseTo(type.allocated, 2);
    }
  });

  it('acoes Large Cap gets 70% of type allocation', () => {
    const acoes = result.types.find((t) => t.type_id === 'acoes')!;
    const large = acoes.groups.find((g) => g.group_id === 'acoes_large')!;
    expect(large.allocated).toBeCloseTo(acoes.allocated * 0.70, 2);
  });

  it('total_spent ≤ contribution', () => {
    expect(result.total_spent).toBeLessThanOrEqual(5000 + 0.01);
  });
});

// ---------------------------------------------------------------------------
// T4.4.3 — Scenario 3: R$20,000, edge allocation (heavily skewed)
// ---------------------------------------------------------------------------

describe('T4.4.3 — Scenario 3: R$20,000 with heavily skewed portfolio', () => {
  const scenario = fixtures.scenarios[2];
  const result = rebalance(scenario.portfolio, scenario.contribution);

  it('total_allocated equals R$20,000', () => {
    expect(result.total_allocated).toBeCloseTo(20000, 2);
  });

  it('Ações receives ~R$19,000 (massive underweight)', () => {
    const acoes = result.types.find((t) => t.type_id === 'acoes')!;
    expect(Math.abs(acoes.allocated - 19000)).toBeLessThan(TOLERANCE);
  });

  it('RF receives ~R$1,000 (slightly underweight)', () => {
    const rf = result.types.find((t) => t.type_id === 'rf')!;
    expect(Math.abs(rf.allocated - 1000)).toBeLessThan(TOLERANCE);
  });

  it('L3 assets within Ações: score-proportional allocation', () => {
    // Scores: VALE3=8, BBAS3=5, PETR4=3 → total=16 → 50%, 31.25%, 18.75%
    const acoes = result.types.find((t) => t.type_id === 'acoes')!;
    const group = acoes.groups[0];
    const vale = group.assets.find((a) => a.ticker === 'VALE3')!;
    const bbas = group.assets.find((a) => a.ticker === 'BBAS3')!;
    const petr = group.assets.find((a) => a.ticker === 'PETR4')!;

    expect(vale.ideal_pct).toBeCloseTo(50, 1);
    expect(bbas.ideal_pct).toBeCloseTo(31.25, 1);
    expect(petr.ideal_pct).toBeCloseTo(18.75, 1);
  });

  it('VALE3 shares_to_buy is integer (whole_shares)', () => {
    const acoes = result.types.find((t) => t.type_id === 'acoes')!;
    const vale = acoes.groups[0].assets.find((a) => a.ticker === 'VALE3')!;
    expect(Number.isInteger(vale.shares_to_buy)).toBe(true);
    // 50% of 19000 = 9500, 9500/77.13 = 123.17 → floor = 123
    expect(vale.shares_to_buy).toBe(123);
  });

  it('CDB-120 fractional shares (whole_shares=false)', () => {
    const rf = result.types.find((t) => t.type_id === 'rf')!;
    const group = rf.groups[0];
    const cdb = group.assets.find((a) => a.ticker === 'CDB-120')!;
    // Score 7 out of 12 → 58.33%, 58.33% of 1000 = 583.33, 583.33/1000 = 0.58333
    expect(cdb.shares_to_buy).toBeCloseTo(0.5833, 3);
  });

  it('all type allocations sum to contribution (within tolerance)', () => {
    const sum = result.types.reduce((s, t) => s + t.allocated, 0);
    expect(Math.abs(sum - 20000)).toBeLessThan(TOLERANCE);
  });
});

// ---------------------------------------------------------------------------
// Cross-scenario structural validations
// ---------------------------------------------------------------------------

describe('Cross-scenario structural validations', () => {
  for (const scenario of fixtures.scenarios) {
    describe(`${scenario.id}: ${scenario.description}`, () => {
      const result = rebalance(scenario.portfolio, scenario.contribution);

      it('contribution field matches input', () => {
        expect(result.contribution).toBe(scenario.contribution);
      });

      it('nested sums: group allocations sum to type allocation', () => {
        for (const type of result.types) {
          const groupSum = type.groups.reduce((s, g) => s + g.allocated, 0);
          expect(groupSum).toBeCloseTo(type.allocated, 2);
        }
      });

      it('nested sums: asset estimated_cost ≤ group allocated', () => {
        for (const type of result.types) {
          for (const group of type.groups) {
            const assetCost = group.assets.reduce((s, a) => s + a.estimated_cost_brl, 0);
            expect(assetCost).toBeLessThanOrEqual(group.allocated + 0.01);
          }
        }
      });

      it('no negative allocations', () => {
        for (const type of result.types) {
          expect(type.allocated).toBeGreaterThanOrEqual(0);
          for (const group of type.groups) {
            expect(group.allocated).toBeGreaterThanOrEqual(0);
            for (const asset of group.assets) {
              expect(asset.allocated_brl).toBeGreaterThanOrEqual(0);
              expect(asset.shares_to_buy).toBeGreaterThanOrEqual(0);
              expect(asset.estimated_cost_brl).toBeGreaterThanOrEqual(0);
            }
          }
        }
      });
    });
  }
});
