import { describe, it, expect } from 'vitest';
import { normalizeScores } from '../../src/lib/nexus/rebalance.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sumResults(results: number[]): number {
  return results.reduce((s, v) => s + v, 0);
}

// ---------------------------------------------------------------------------
// T7.3.1 — Standard case with negative score (shift to zero)
// ---------------------------------------------------------------------------

describe('T7.3.1 — Scores [8, 5, 3, -2] → shift by +2, proportional %', () => {
  const result = normalizeScores([8, 5, 3, -2]);

  it('produces 4 values', () => {
    expect(result).toHaveLength(4);
  });

  it('shifted values [10, 7, 5, 0] → correct percentages', () => {
    // sum = 22 → [10/22, 7/22, 5/22, 0/22] * 100
    expect(result[0]).toBeCloseTo(45.4545, 2);
    expect(result[1]).toBeCloseTo(31.8182, 2);
    expect(result[2]).toBeCloseTo(22.7273, 2);
    expect(result[3]).toBeCloseTo(0, 2);
  });

  it('sum equals 100%', () => {
    expect(sumResults(result)).toBeCloseTo(100, 2);
  });
});

// ---------------------------------------------------------------------------
// T7.3.2 — All scores equal → equal distribution (1/N)
// ---------------------------------------------------------------------------

describe('T7.3.2 — All scores equal [5, 5, 5] → equal 33.33%', () => {
  const result = normalizeScores([5, 5, 5]);

  it('each value is 1/3 of 100', () => {
    for (const v of result) {
      expect(v).toBeCloseTo(100 / 3, 2);
    }
  });

  it('sum equals 100%', () => {
    expect(sumResults(result)).toBeCloseTo(100, 2);
  });
});

// ---------------------------------------------------------------------------
// T7.3.3 — Single element → [100]
// ---------------------------------------------------------------------------

describe('T7.3.3 — Single score [7] → [100%]', () => {
  const result = normalizeScores([7]);

  it('returns exactly [100]', () => {
    expect(result).toEqual([100]);
  });
});

// ---------------------------------------------------------------------------
// T7.3.4 — All zeros → equal fallback (1/N)
// ---------------------------------------------------------------------------

describe('T7.3.4 — All zeros [0, 0, 0] → equal fallback 33.33%', () => {
  const result = normalizeScores([0, 0, 0]);

  it('each value is 1/3 of 100', () => {
    for (const v of result) {
      expect(v).toBeCloseTo(100 / 3, 2);
    }
  });

  it('sum equals 100%', () => {
    expect(sumResults(result)).toBeCloseTo(100, 2);
  });
});

// ---------------------------------------------------------------------------
// T7.3.5 — All negative scores → shift, then proportional
// ---------------------------------------------------------------------------

describe('T7.3.5 — All negatives [-10, -5, -3] → shift by +10 → [0, 5, 7]', () => {
  const result = normalizeScores([-10, -5, -3]);

  it('produces correct proportions after shift', () => {
    // shifted: [0, 5, 7], sum = 12
    expect(result[0]).toBeCloseTo(0, 2);
    expect(result[1]).toBeCloseTo((5 / 12) * 100, 2); // 41.67%
    expect(result[2]).toBeCloseTo((7 / 12) * 100, 2); // 58.33%
  });

  it('sum equals 100%', () => {
    expect(sumResults(result)).toBeCloseTo(100, 2);
  });
});

// ---------------------------------------------------------------------------
// T7.3.6 — Empty array → returns []
// ---------------------------------------------------------------------------

describe('T7.3.6 — Empty array [] → returns []', () => {
  it('returns empty array without throwing', () => {
    expect(normalizeScores([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Additional edge cases
// ---------------------------------------------------------------------------

describe('Edge cases', () => {
  it('all scores equal after shift → equal distribution', () => {
    // [-3, -3, -3] → shift by +3 → [0, 0, 0] → sum=0 → equal fallback
    const result = normalizeScores([-3, -3, -3]);
    for (const v of result) {
      expect(v).toBeCloseTo(100 / 3, 2);
    }
  });

  it('pure function: same input produces same output', () => {
    const r1 = normalizeScores([10, 20, 30]);
    const r2 = normalizeScores([10, 20, 30]);
    expect(r1).toEqual(r2);
  });

  it('does not mutate input array', () => {
    const input = [8, 5, 3, -2];
    const copy = [...input];
    normalizeScores(input);
    expect(input).toEqual(copy);
  });

  it('two elements with one negative', () => {
    // [10, -5] → shift by +5 → [15, 0], sum=15
    const result = normalizeScores([10, -5]);
    expect(result[0]).toBeCloseTo(100, 2);
    expect(result[1]).toBeCloseTo(0, 2);
  });
});
