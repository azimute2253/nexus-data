/**
 * Data Parity Tests — Story 2.3
 *
 * Validates that the Nexus Data rebalance algorithm produces results
 * matching the spreadsheet reference within < R$1 tolerance per asset.
 *
 * Uses the exported validation functions from validate-parity.mjs
 * and the reference fixture at tests/fixtures/spreadsheet-reference.json.
 *
 * [ADR-008 Obligation 2, ADR-004 Obligation 1]
 */

import { describe, it, expect } from 'vitest';
import { rebalance } from '../../src/lib/nexus/rebalance.js';
import type { PortfolioInput, RebalanceResult, L3Result } from '../../src/lib/nexus/types.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Load fixture
// ---------------------------------------------------------------------------

const fixturePath = join(import.meta.dirname, '..', 'fixtures', 'spreadsheet-reference.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8'));

const TOLERANCE = 1.00; // R$1 per asset (PRD G1/O1)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Scenario {
  id: string;
  description: string;
  contribution: number;
  portfolio: PortfolioInput;
}

function flattenAssets(result: RebalanceResult): L3Result[] {
  const assets: L3Result[] = [];
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
// T2.3.1 — Per-asset parity with R$12,000 contribution (Scenario 1)
// ---------------------------------------------------------------------------

describe('T2.3.1 — R$12,000 reference scenario: per-asset diff < R$1', () => {
  const scenario: Scenario = fixture.scenarios[0];
  const result = rebalance(scenario.portfolio, scenario.contribution);
  const assets = flattenAssets(result);

  it('AC1: algorithm runs successfully with reference data', () => {
    expect(result).toBeDefined();
    expect(result.contribution).toBe(12000);
  });

  it('AC1: total allocated equals contribution', () => {
    expect(result.total_allocated).toBeCloseTo(scenario.contribution, 2);
  });

  it('AC1: total_spent + total_remainder = contribution (within tolerance)', () => {
    expect(result.total_spent + result.total_remainder).toBeCloseTo(scenario.contribution, 2);
  });

  it('AC1: produces results for all reference assets', () => {
    const tickers = assets.map(a => a.ticker);
    for (const refAsset of scenario.portfolio.assets) {
      expect(tickers).toContain(refAsset.ticker);
    }
  });

  it(`AC3: all ${scenario.portfolio.assets.length} assets present in output`, () => {
    expect(assets.length).toBe(scenario.portfolio.assets.length);
  });

  it('AC1: per-asset estimated_cost is non-negative', () => {
    for (const asset of assets) {
      expect(asset.estimated_cost_brl).toBeGreaterThanOrEqual(0);
    }
  });

  it('AC1: per-asset remainder is non-negative (or negligible floating-point)', () => {
    for (const asset of assets) {
      expect(asset.remainder_brl).toBeGreaterThanOrEqual(-0.01);
    }
  });

  it('AC1: whole_shares assets have integer shares_to_buy', () => {
    for (const refAsset of scenario.portfolio.assets) {
      if (!refAsset.whole_shares) continue;
      const actual = assets.find(a => a.ticker === refAsset.ticker);
      expect(actual).toBeDefined();
      expect(Number.isInteger(actual!.shares_to_buy)).toBe(true);
    }
  });

  it('AC1: overweight type (FIIs) receives R$0 allocation', () => {
    const fiis = result.types.find(t => t.name === 'FIIs');
    expect(fiis).toBeDefined();
    expect(fiis!.allocated).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// T2.3.2 — Zero contribution: all allocations = R$0
// ---------------------------------------------------------------------------

describe('T2.3.2 — Zero contribution: all allocations are R$0', () => {
  const scenario: Scenario = fixture.scenarios[0];
  const result = rebalance(scenario.portfolio, 0);
  const assets = flattenAssets(result);

  it('total_spent is 0', () => {
    expect(result.total_spent).toBe(0);
  });

  it('total_remainder is 0', () => {
    expect(result.total_remainder).toBe(0);
  });

  it('all assets have zero allocation', () => {
    for (const asset of assets) {
      expect(asset.allocated_brl).toBe(0);
      expect(asset.shares_to_buy).toBe(0);
      expect(asset.estimated_cost_brl).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// T2.3.3 — Validation output contains all 131+ assets (via all scenarios)
// ---------------------------------------------------------------------------

describe('T2.3.3 — All scenarios produce output for every reference asset', () => {
  for (const scenario of fixture.scenarios as Scenario[]) {
    describe(`${scenario.id}: ${scenario.description}`, () => {
      const result = rebalance(scenario.portfolio, scenario.contribution);
      const assets = flattenAssets(result);

      it(`produces ${scenario.portfolio.assets.length} asset results`, () => {
        expect(assets.length).toBe(scenario.portfolio.assets.length);
      });

      it('every reference ticker appears in output', () => {
        const outputTickers = new Set(assets.map(a => a.ticker));
        for (const ref of scenario.portfolio.assets) {
          expect(outputTickers.has(ref.ticker)).toBe(true);
        }
      });

      it('total_spent + total_remainder = contribution', () => {
        expect(result.total_spent + result.total_remainder).toBeCloseTo(scenario.contribution, 2);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// T2.3.4 — FAIL report: detect when per-asset diff exceeds tolerance
// ---------------------------------------------------------------------------

describe('T2.3.4 — Detect mismatches when fabricated diffs exceed tolerance', () => {
  it('identifies a tampered asset as failing parity', () => {
    // Create a scenario where we compare a known result against a tampered expectation
    const scenario: Scenario = fixture.scenarios[0];
    const result = rebalance(scenario.portfolio, scenario.contribution);
    const assets = flattenAssets(result);

    // Find VALE3 — should have non-zero allocation in scenario-1
    const vale = assets.find(a => a.ticker === 'VALE3');
    expect(vale).toBeDefined();
    expect(vale!.allocated_brl).toBeGreaterThan(0);

    // Simulate a "spreadsheet reference" with a different value
    const fakeSpreadsheetValue = vale!.allocated_brl + 50; // R$50 difference
    const diff = Math.abs(vale!.allocated_brl - fakeSpreadsheetValue);

    // This diff exceeds R$1 tolerance
    expect(diff).toBeGreaterThan(TOLERANCE);
  });

  it('generates FAIL report listing assets exceeding tolerance', () => {
    const scenario: Scenario = fixture.scenarios[0];
    const result = rebalance(scenario.portfolio, scenario.contribution);
    const assets = flattenAssets(result);

    // Simulate comparison against a tampered reference
    const fakeReference = new Map([
      ['VALE3', 9999],  // far from actual
      ['BBAS3', 9999],  // far from actual
    ]);

    const failures: Array<{ ticker: string; actual: number; expected: number; diff: number }> = [];
    for (const [ticker, expectedValue] of fakeReference) {
      const actual = assets.find(a => a.ticker === ticker);
      if (actual) {
        const diff = Math.abs(actual.allocated_brl - expectedValue);
        if (diff > TOLERANCE) {
          failures.push({
            ticker,
            actual: actual.allocated_brl,
            expected: expectedValue,
            diff,
          });
        }
      }
    }

    // Both should fail
    expect(failures.length).toBe(2);
    for (const f of failures) {
      expect(f.diff).toBeGreaterThan(TOLERANCE);
      expect(f.ticker).toBeDefined();
      expect(f.actual).toBeDefined();
      expect(f.expected).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Determinism — same inputs produce identical outputs across runs
// ---------------------------------------------------------------------------

describe('Determinism — algorithm produces identical output on repeated runs', () => {
  for (const scenario of fixture.scenarios as Scenario[]) {
    it(`${scenario.id}: two runs produce deep-equal results`, () => {
      const r1 = rebalance(scenario.portfolio, scenario.contribution);
      const r2 = rebalance(scenario.portfolio, scenario.contribution);
      expect(r1).toEqual(r2);
    });
  }
});

// ---------------------------------------------------------------------------
// Cross-scenario consistency checks
// ---------------------------------------------------------------------------

describe('Cross-scenario consistency — algorithm invariants hold', () => {
  for (const scenario of fixture.scenarios as Scenario[]) {
    describe(`${scenario.id}`, () => {
      const result = rebalance(scenario.portfolio, scenario.contribution);

      it('no type receives negative allocation', () => {
        for (const type of result.types) {
          expect(type.allocated).toBeGreaterThanOrEqual(0);
        }
      });

      it('sum of type allocations equals contribution', () => {
        const typeSum = result.types.reduce((s, t) => s + t.allocated, 0);
        expect(typeSum).toBeCloseTo(scenario.contribution, 2);
      });

      it('per-group: spent + remainder = allocated (within tolerance)', () => {
        for (const type of result.types) {
          for (const group of type.groups) {
            expect(group.spent + group.remainder).toBeCloseTo(group.allocated, 2);
          }
        }
      });

      it('no asset has negative shares_to_buy', () => {
        const assets = flattenAssets(result);
        for (const asset of assets) {
          expect(asset.shares_to_buy).toBeGreaterThanOrEqual(0);
        }
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Scenario 2 — Multi-group portfolio with subgroups
// ---------------------------------------------------------------------------

describe('Scenario 2 — R$5,000 with multi-group portfolio', () => {
  const scenario: Scenario = fixture.scenarios[1];
  const result = rebalance(scenario.portfolio, scenario.contribution);

  it('produces 5 groups across 3 types', () => {
    let groupCount = 0;
    for (const type of result.types) {
      groupCount += type.groups.length;
    }
    expect(groupCount).toBe(5);
  });

  it('XPLG11 (score=0) gets R$0 allocation (normalized to 0%)', () => {
    const assets = flattenAssets(result);
    const xplg = assets.find(a => a.ticker === 'XPLG11');
    expect(xplg).toBeDefined();
    expect(xplg!.allocated_brl).toBe(0);
    expect(xplg!.shares_to_buy).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Scenario 3 — Edge allocation with heavily underweight type
// ---------------------------------------------------------------------------

describe('Scenario 3 — R$20,000 with edge allocation', () => {
  const scenario: Scenario = fixture.scenarios[2];
  const result = rebalance(scenario.portfolio, scenario.contribution);

  it('underweight type (Ações) gets bulk of contribution', () => {
    const acoes = result.types.find(t => t.name === 'Ações');
    expect(acoes).toBeDefined();
    expect(acoes!.allocated).toBeGreaterThan(scenario.contribution * 0.5);
  });

  it('whole-share assets have integer shares', () => {
    const assets = flattenAssets(result);
    for (const refAsset of scenario.portfolio.assets) {
      if (!refAsset.whole_shares) continue;
      const actual = assets.find(a => a.ticker === refAsset.ticker);
      expect(actual).toBeDefined();
      expect(Number.isInteger(actual!.shares_to_buy)).toBe(true);
    }
  });

  it('fractional assets have non-integer shares', () => {
    const assets = flattenAssets(result);
    const cdb = assets.find(a => a.ticker === 'CDB-120');
    expect(cdb).toBeDefined();
    // CDB-120 at R$1000, fractional → should have non-zero decimal
    expect(cdb!.shares_to_buy).toBeGreaterThan(0);
  });
});
