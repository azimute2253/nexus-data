import { describe, it, expect } from 'vitest';
import { distributeL2 } from '../../src/lib/nexus/rebalance.js';
import type { L1Result, L2GroupInput } from '../../src/lib/nexus/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeL1(
  overrides: Partial<L1Result> & Pick<L1Result, 'type_id' | 'allocated'>,
): L1Result {
  return {
    name: overrides.type_id,
    target_pct: 0.1,
    desired_value: 0,
    actual_value: 0,
    deviation: 0,
    deficit: 0,
    ...overrides,
  };
}

function makeGroup(
  overrides: Partial<L2GroupInput> & Pick<L2GroupInput, 'group_id' | 'type_id' | 'target_pct'>,
): L2GroupInput {
  return {
    name: overrides.group_id,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// T4.2.1 — Multi-group distribution (60/20/10/10)
// ---------------------------------------------------------------------------

describe('T4.2.1 — R$4,428 to type with 4 groups (60/20/10/10)', () => {
  const l1Results: L1Result[] = [
    makeL1({ type_id: 'acoes_br', allocated: 4_428 }),
  ];

  const groups: L2GroupInput[] = [
    makeGroup({ group_id: 'large_cap', type_id: 'acoes_br', target_pct: 0.60 }),
    makeGroup({ group_id: 'mid_cap',   type_id: 'acoes_br', target_pct: 0.20 }),
    makeGroup({ group_id: 'small_cap', type_id: 'acoes_br', target_pct: 0.10 }),
    makeGroup({ group_id: 'micro_cap', type_id: 'acoes_br', target_pct: 0.10 }),
  ];

  const results = distributeL2(l1Results, groups);

  it('AC1: produces one result per group', () => {
    expect(results.length).toBe(4);
  });

  it('AC1: group amounts match expected values', () => {
    const byId = (id: string) => results.find((r) => r.group_id === id)!;
    expect(byId('large_cap').allocated).toBeCloseTo(2_656.80, 2);
    expect(byId('mid_cap').allocated).toBeCloseTo(885.60, 2);
    expect(byId('small_cap').allocated).toBeCloseTo(442.80, 2);
    expect(byId('micro_cap').allocated).toBeCloseTo(442.80, 2);
  });

  it('AC3: sum of group allocations equals type allocation', () => {
    const sum = results.reduce((s, r) => s + r.allocated, 0);
    expect(sum).toBeCloseTo(4_428, 2);
  });
});

// ---------------------------------------------------------------------------
// T4.2.2 — Type received R$0 from L1
// ---------------------------------------------------------------------------

describe('T4.2.2 — R$0 to type → all groups receive R$0', () => {
  const l1Results: L1Result[] = [
    makeL1({ type_id: 'fiis', allocated: 0 }),
  ];

  const groups: L2GroupInput[] = [
    makeGroup({ group_id: 'papel',  type_id: 'fiis', target_pct: 0.50 }),
    makeGroup({ group_id: 'tijolo', type_id: 'fiis', target_pct: 0.50 }),
  ];

  const results = distributeL2(l1Results, groups);

  it('AC3: all groups receive R$0', () => {
    for (const r of results) {
      expect(r.allocated).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// T4.2.3 — Single group at 100%
// ---------------------------------------------------------------------------

describe('T4.2.3 — Type with 1 group at 100% gets full amount', () => {
  const l1Results: L1Result[] = [
    makeL1({ type_id: 'crypto', allocated: 3_500 }),
  ];

  const groups: L2GroupInput[] = [
    makeGroup({ group_id: 'all_crypto', type_id: 'crypto', target_pct: 1.0 }),
  ];

  const results = distributeL2(l1Results, groups);

  it('AC2: single group gets full type allocation', () => {
    expect(results.length).toBe(1);
    expect(results[0].allocated).toBeCloseTo(3_500, 2);
  });
});

// ---------------------------------------------------------------------------
// T4.2.4 — Validation: group targets don't sum to 100%
// ---------------------------------------------------------------------------

describe('T4.2.4 — Validation error when group targets != 100%', () => {
  const l1Results: L1Result[] = [
    makeL1({ type_id: 'rf', allocated: 5_000 }),
  ];

  it('AC5: throws when sum > 1.0', () => {
    const groups: L2GroupInput[] = [
      makeGroup({ group_id: 'g1', type_id: 'rf', target_pct: 0.60 }),
      makeGroup({ group_id: 'g2', type_id: 'rf', target_pct: 0.50 }),
    ];
    expect(() => distributeL2(l1Results, groups)).toThrow(
      'Group targets for type "rf" sum to 1.1000, expected 1.0',
    );
  });

  it('AC5: throws when sum < 1.0', () => {
    const groups: L2GroupInput[] = [
      makeGroup({ group_id: 'g1', type_id: 'rf', target_pct: 0.30 }),
      makeGroup({ group_id: 'g2', type_id: 'rf', target_pct: 0.20 }),
    ];
    expect(() => distributeL2(l1Results, groups)).toThrow(
      'Group targets for type "rf" sum to 0.5000, expected 1.0',
    );
  });
});

// ---------------------------------------------------------------------------
// Multi-type cascade — L1 feeds into L2 across multiple types
// ---------------------------------------------------------------------------

describe('Multi-type cascade — 3 types with groups', () => {
  const l1Results: L1Result[] = [
    makeL1({ type_id: 'acoes', allocated: 6_000 }),
    makeL1({ type_id: 'fiis',  allocated: 3_000 }),
    makeL1({ type_id: 'rf',    allocated: 1_000 }),
  ];

  const groups: L2GroupInput[] = [
    makeGroup({ group_id: 'acoes_large', type_id: 'acoes', target_pct: 0.70 }),
    makeGroup({ group_id: 'acoes_small', type_id: 'acoes', target_pct: 0.30 }),
    makeGroup({ group_id: 'fiis_papel',  type_id: 'fiis',  target_pct: 0.40 }),
    makeGroup({ group_id: 'fiis_tijolo', type_id: 'fiis',  target_pct: 0.60 }),
    makeGroup({ group_id: 'rf_cdb',      type_id: 'rf',    target_pct: 1.00 }),
  ];

  const results = distributeL2(l1Results, groups);

  it('produces correct count of results', () => {
    expect(results.length).toBe(5);
  });

  it('acoes groups receive correct amounts', () => {
    const large = results.find((r) => r.group_id === 'acoes_large')!;
    const small = results.find((r) => r.group_id === 'acoes_small')!;
    expect(large.allocated).toBeCloseTo(4_200, 2);
    expect(small.allocated).toBeCloseTo(1_800, 2);
  });

  it('fiis groups receive correct amounts', () => {
    const papel = results.find((r) => r.group_id === 'fiis_papel')!;
    const tijolo = results.find((r) => r.group_id === 'fiis_tijolo')!;
    expect(papel.allocated).toBeCloseTo(1_200, 2);
    expect(tijolo.allocated).toBeCloseTo(1_800, 2);
  });

  it('rf single group receives full amount', () => {
    const cdb = results.find((r) => r.group_id === 'rf_cdb')!;
    expect(cdb.allocated).toBeCloseTo(1_000, 2);
  });

  it('total across all groups equals total across all types', () => {
    const totalGroups = results.reduce((s, r) => s + r.allocated, 0);
    const totalTypes = l1Results.reduce((s, r) => s + r.allocated, 0);
    expect(totalGroups).toBeCloseTo(totalTypes, 2);
  });
});

// ---------------------------------------------------------------------------
// Edge: L1 type has no groups defined
// ---------------------------------------------------------------------------

describe('Edge — L1 type with no groups produces no results', () => {
  const l1Results: L1Result[] = [
    makeL1({ type_id: 'orphan', allocated: 5_000 }),
  ];

  const results = distributeL2(l1Results, []);

  it('returns empty array', () => {
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Pure function — determinism
// ---------------------------------------------------------------------------

describe('Pure function — same inputs produce identical outputs', () => {
  const l1Results: L1Result[] = [
    makeL1({ type_id: 'a', allocated: 10_000 }),
  ];

  const groups: L2GroupInput[] = [
    makeGroup({ group_id: 'g1', type_id: 'a', target_pct: 0.75 }),
    makeGroup({ group_id: 'g2', type_id: 'a', target_pct: 0.25 }),
  ];

  it('two calls produce deep-equal results', () => {
    const r1 = distributeL2(l1Results, groups);
    const r2 = distributeL2(l1Results, groups);
    expect(r1).toEqual(r2);
  });
});

// ---------------------------------------------------------------------------
// AC6: output contains correct metadata
// ---------------------------------------------------------------------------

describe('Output metadata — group_id, name, type_id, target_pct preserved', () => {
  const l1Results: L1Result[] = [
    makeL1({ type_id: 'crypto', allocated: 2_000 }),
  ];

  const groups: L2GroupInput[] = [
    makeGroup({ group_id: 'btc', name: 'Bitcoin', type_id: 'crypto', target_pct: 0.80 }),
    makeGroup({ group_id: 'eth', name: 'Ethereum', type_id: 'crypto', target_pct: 0.20 }),
  ];

  const results = distributeL2(l1Results, groups);

  it('preserves group metadata in output', () => {
    const btc = results.find((r) => r.group_id === 'btc')!;
    expect(btc.name).toBe('Bitcoin');
    expect(btc.type_id).toBe('crypto');
    expect(btc.target_pct).toBe(0.80);
  });
});
