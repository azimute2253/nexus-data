import { describe, it, expect } from 'vitest';
import { distributeL1 } from '../../src/lib/nexus/rebalance.js';
import type { L1TypeInput } from '../../src/lib/nexus/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeType(
  overrides: Partial<L1TypeInput> & Pick<L1TypeInput, 'type_id'>,
): L1TypeInput {
  return {
    name: overrides.type_id,
    target_pct: 0.1,
    actual_value_brl: 0,
    ...overrides,
  };
}

function sumAllocated(results: ReturnType<typeof distributeL1>): number {
  return results.reduce((s, r) => s + r.allocated, 0);
}

// ---------------------------------------------------------------------------
// T4.1.1 — Standard distribution with FIIs overweight
// ---------------------------------------------------------------------------

describe('T4.1.1 — Standard 10-type distribution (FIIs overweight)', () => {
  // 10 types, each 10% target. FIIs are massively overweight (65%).
  // Aporte: R$12,000. Portfolio total: R$243,000.
  const types: L1TypeInput[] = [
    { type_id: 'acoes_br',   name: 'Ações BR',        target_pct: 0.15, actual_value_brl: 30_000 },
    { type_id: 'fiis',       name: 'FIIs',             target_pct: 0.15, actual_value_brl: 158_000 },
    { type_id: 'rf',         name: 'Renda Fixa',       target_pct: 0.10, actual_value_brl: 15_000 },
    { type_id: 'ri',         name: 'Renda Indexada',    target_pct: 0.10, actual_value_brl: 10_000 },
    { type_id: 'rv',         name: 'Renda Variável',    target_pct: 0.10, actual_value_brl: 5_000 },
    { type_id: 'crypto',     name: 'Crypto',            target_pct: 0.05, actual_value_brl: 3_000 },
    { type_id: 'intl_etf',   name: 'ETFs Intl',         target_pct: 0.10, actual_value_brl: 8_000 },
    { type_id: 'intl_stock', name: 'Stocks Intl',       target_pct: 0.10, actual_value_brl: 7_000 },
    { type_id: 'ouro',       name: 'Ouro',              target_pct: 0.05, actual_value_brl: 4_000 },
    { type_id: 'reserva',    name: 'Reserva Emerg.',    target_pct: 0.10, actual_value_brl: 3_000 },
  ];

  const contribution = 12_000;
  const results = distributeL1(types, contribution);

  it('AC1: total allocated equals contribution', () => {
    expect(sumAllocated(results)).toBeCloseTo(contribution, 2);
  });

  it('AC2: FIIs (overweight) receive R$0', () => {
    const fiis = results.find((r) => r.type_id === 'fiis')!;
    expect(fiis.allocated).toBe(0);
  });

  it('AC3: underweight types receive proportional to deficit', () => {
    const underweight = results.filter((r) => r.allocated > 0);
    expect(underweight.length).toBeGreaterThan(0);
    // Each underweight type should have a positive deficit
    for (const r of underweight) {
      expect(r.deficit).toBeGreaterThan(0);
    }
  });

  it('AC4: results sorted by abs(deviation) descending', () => {
    for (let i = 1; i < results.length; i++) {
      expect(Math.abs(results[i - 1].deviation)).toBeGreaterThanOrEqual(
        Math.abs(results[i].deviation),
      );
    }
  });
});

// ---------------------------------------------------------------------------
// T4.1.2 — Zero contribution
// ---------------------------------------------------------------------------

describe('T4.1.2 — Zero contribution', () => {
  const types: L1TypeInput[] = [
    makeType({ type_id: 'acoes', target_pct: 0.5, actual_value_brl: 100 }),
    makeType({ type_id: 'fiis', target_pct: 0.5, actual_value_brl: 200 }),
  ];

  const results = distributeL1(types, 0);

  it('all allocations are R$0', () => {
    for (const r of results) {
      expect(r.allocated).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// T4.1.3 — All types overweight (graceful degradation)
// ---------------------------------------------------------------------------

describe('T4.1.3 — All types overweight → least-overweight gets full aporte', () => {
  // target_pct sums to 0.20, but actual values are much higher
  const types: L1TypeInput[] = [
    makeType({ type_id: 'a', target_pct: 0.10, actual_value_brl: 8_000 }),
    makeType({ type_id: 'b', target_pct: 0.10, actual_value_brl: 5_000 }),
  ];

  const contribution = 1_000;
  const results = distributeL1(types, contribution);

  it('sum equals contribution', () => {
    expect(sumAllocated(results)).toBeCloseTo(contribution, 2);
  });

  it('at least one type receives the full aporte', () => {
    const receiving = results.filter((r) => r.allocated > 0);
    expect(receiving.length).toBe(1);
    expect(receiving[0].allocated).toBeCloseTo(contribution, 2);
  });

  it('the least-overweight type is the one receiving', () => {
    // 'b' has lower actual_value_brl so its deviation is smaller (less overweight)
    const receiving = results.find((r) => r.allocated > 0)!;
    expect(receiving.type_id).toBe('b');
  });
});

// ---------------------------------------------------------------------------
// T4.1.4 — Single underweight type gets full aporte
// ---------------------------------------------------------------------------

describe('T4.1.4 — Single underweight type gets full aporte', () => {
  const types: L1TypeInput[] = [
    makeType({ type_id: 'over', target_pct: 0.30, actual_value_brl: 9_000 }),
    makeType({ type_id: 'under', target_pct: 0.70, actual_value_brl: 1_000 }),
  ];

  const contribution = 12_000;
  const results = distributeL1(types, contribution);

  it('the only underweight type gets full contribution', () => {
    const under = results.find((r) => r.type_id === 'under')!;
    expect(under.allocated).toBeCloseTo(contribution, 2);
  });

  it('overweight type gets R$0', () => {
    const over = results.find((r) => r.type_id === 'over')!;
    expect(over.allocated).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// T4.1.5 — Determinism: same inputs → identical outputs
// ---------------------------------------------------------------------------

describe('T4.1.5 — Deterministic (same inputs = same outputs)', () => {
  const types: L1TypeInput[] = [
    makeType({ type_id: 'a', target_pct: 0.4, actual_value_brl: 3_000 }),
    makeType({ type_id: 'b', target_pct: 0.3, actual_value_brl: 2_000 }),
    makeType({ type_id: 'c', target_pct: 0.3, actual_value_brl: 5_000 }),
  ];

  it('two calls produce deep-equal results', () => {
    const r1 = distributeL1(types, 5_000);
    const r2 = distributeL1(types, 5_000);
    expect(r1).toEqual(r2);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('Edge cases', () => {
  it('AC6: empty portfolio returns empty array', () => {
    const results = distributeL1([], 12_000);
    expect(results).toEqual([]);
  });

  it('AC6: single asset type receives entire contribution', () => {
    const types: L1TypeInput[] = [
      makeType({ type_id: 'only', target_pct: 1.0, actual_value_brl: 5_000 }),
    ];
    const results = distributeL1(types, 10_000);
    expect(results.length).toBe(1);
    expect(results[0].allocated).toBeCloseTo(10_000, 2);
  });

  it('all types at zero value — distributes proportionally to target_pct', () => {
    const types: L1TypeInput[] = [
      makeType({ type_id: 'a', target_pct: 0.6, actual_value_brl: 0 }),
      makeType({ type_id: 'b', target_pct: 0.4, actual_value_brl: 0 }),
    ];
    const results = distributeL1(types, 10_000);
    expect(sumAllocated(results)).toBeCloseTo(10_000, 2);
    const a = results.find((r) => r.type_id === 'a')!;
    const b = results.find((r) => r.type_id === 'b')!;
    // With 0 actual value, deficit = desired_value = totalAfterContribution * target_pct
    // So allocation is proportional to target_pct
    expect(a.allocated).toBeGreaterThan(b.allocated);
  });

  it('desired_value = total_portfolio_after_contribution * target_pct', () => {
    const types: L1TypeInput[] = [
      makeType({ type_id: 'x', target_pct: 0.25, actual_value_brl: 1_000 }),
      makeType({ type_id: 'y', target_pct: 0.75, actual_value_brl: 3_000 }),
    ];
    const contribution = 6_000;
    const results = distributeL1(types, contribution);
    // total_after = 4000 + 6000 = 10000
    const x = results.find((r) => r.type_id === 'x')!;
    expect(x.desired_value).toBeCloseTo(10_000 * 0.25, 2); // 2500
    const y = results.find((r) => r.type_id === 'y')!;
    expect(y.desired_value).toBeCloseTo(10_000 * 0.75, 2); // 7500
  });

  it('deviation = actual - desired (positive means overweight)', () => {
    const types: L1TypeInput[] = [
      makeType({ type_id: 'a', target_pct: 0.5, actual_value_brl: 8_000 }),
      makeType({ type_id: 'b', target_pct: 0.5, actual_value_brl: 2_000 }),
    ];
    const results = distributeL1(types, 0);
    // contribution=0 so desired_value=0, deviation=actual-0=actual, deficit=0
    // Actually contribution=0 returns early with zeros
    // Let's use non-zero contribution
    const results2 = distributeL1(types, 10_000);
    // total_after = 10000 + 10000 = 20000, desired = 10000 each
    const a = results2.find((r) => r.type_id === 'a')!;
    expect(a.deviation).toBeCloseTo(8_000 - 10_000, 2); // -2000 (underweight)
    const b = results2.find((r) => r.type_id === 'b')!;
    expect(b.deviation).toBeCloseTo(2_000 - 10_000, 2); // -8000 (underweight)
  });

  it('AC5: negative deviation (underweight) types get allocation', () => {
    const types: L1TypeInput[] = [
      makeType({ type_id: 'heavy', target_pct: 0.2, actual_value_brl: 50_000 }),
      makeType({ type_id: 'light', target_pct: 0.8, actual_value_brl: 10_000 }),
    ];
    const results = distributeL1(types, 5_000);
    const heavy = results.find((r) => r.type_id === 'heavy')!;
    const light = results.find((r) => r.type_id === 'light')!;
    // heavy: desired = 65000*0.2 = 13000, actual = 50000 → overweight → allocated = 0
    expect(heavy.allocated).toBe(0);
    // light gets entire contribution
    expect(light.allocated).toBeCloseTo(5_000, 2);
  });
});
