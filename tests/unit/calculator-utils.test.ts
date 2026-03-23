import { describe, it, expect } from 'vitest';
import type { RebalanceResult } from '../../src/lib/nexus/types.js';
import {
  isValidContribution,
  parseContribution,
  formatBrl,
  formatShares,
  countBuyOrders,
  flattenBuyOrders,
  countAllocatedTypes,
} from '../../src/lib/dashboard/calculator-utils.js';

// ── Fixtures ────────────────────────────────────────────────

const RESULT: RebalanceResult = {
  contribution: 12000,
  total_allocated: 12000,
  total_spent: 11847.50,
  total_remainder: 152.50,
  types: [
    {
      type_id: 't1',
      name: 'Ações BR',
      allocated: 8000,
      groups: [
        {
          group_id: 'g1',
          name: 'Dividendos',
          allocated: 4800,
          spent: 4650,
          remainder: 150,
          assets: [
            {
              asset_id: 'a1', ticker: 'VALE3', group_id: 'g1',
              ideal_pct: 60, allocated_brl: 2880, shares_to_buy: 5,
              estimated_cost_brl: 2750, remainder_brl: 130,
            },
            {
              asset_id: 'a2', ticker: 'PETR4', group_id: 'g1',
              ideal_pct: 40, allocated_brl: 1920, shares_to_buy: 3,
              estimated_cost_brl: 1900, remainder_brl: 20,
            },
          ],
        },
        {
          group_id: 'g2',
          name: 'Crescimento',
          allocated: 3200,
          spent: 3197.50,
          remainder: 2.50,
          assets: [
            {
              asset_id: 'a3', ticker: 'WEGE3', group_id: 'g2',
              ideal_pct: 100, allocated_brl: 3200, shares_to_buy: 7,
              estimated_cost_brl: 3197.50, remainder_brl: 2.50,
            },
          ],
        },
      ],
    },
    {
      type_id: 't2',
      name: 'FIIs',
      allocated: 4000,
      groups: [
        {
          group_id: 'g3',
          name: 'Logístico',
          allocated: 4000,
          spent: 4000,
          remainder: 0,
          assets: [
            {
              asset_id: 'a4', ticker: 'HGLG11', group_id: 'g3',
              ideal_pct: 100, allocated_brl: 4000, shares_to_buy: 25,
              estimated_cost_brl: 4000, remainder_brl: 0,
            },
          ],
        },
      ],
    },
    {
      type_id: 't3',
      name: 'Cripto',
      allocated: 0,
      groups: [],
    },
  ],
};

// ── Tests: isValidContribution (AC7 — input validation) ─────

describe('isValidContribution', () => {
  it('T5.5.4 — rejects empty string', () => {
    expect(isValidContribution('')).toBe(false);
    expect(isValidContribution('   ')).toBe(false);
  });

  it('T5.5.4 — rejects non-numeric input', () => {
    expect(isValidContribution('abc')).toBe(false);
    expect(isValidContribution('R$12.000')).toBe(false);
  });

  it('T5.5.4 — rejects negative values', () => {
    expect(isValidContribution('-1000')).toBe(false);
    expect(isValidContribution('-0.01')).toBe(false);
  });

  it('AC1 — accepts valid positive amounts', () => {
    expect(isValidContribution('12000')).toBe(true);
    expect(isValidContribution('12.000')).toBe(true);
    expect(isValidContribution('12.000,50')).toBe(true);
    expect(isValidContribution('0')).toBe(true);
  });
});

// ── Tests: parseContribution (pt-BR format parsing) ─────────

describe('parseContribution', () => {
  it('parses plain number', () => {
    expect(parseContribution('12000')).toBe(12000);
  });

  it('parses pt-BR thousands separator', () => {
    expect(parseContribution('12.000')).toBe(12000);
    expect(parseContribution('1.234.567')).toBe(1234567);
  });

  it('parses pt-BR decimal separator', () => {
    expect(parseContribution('12.000,50')).toBe(12000.5);
    expect(parseContribution('0,99')).toBe(0.99);
  });

  it('returns NaN for non-numeric input', () => {
    expect(parseContribution('abc')).toBeNaN();
  });
});

// ── Tests: formatBrl ────────────────────────────────────────

describe('formatBrl', () => {
  it('AC5 — formats contribution amount in BRL', () => {
    const result = formatBrl(12000);
    expect(result).toMatch(/R\$/);
    expect(result).toContain('12');
  });

  it('formats zero', () => {
    const result = formatBrl(0);
    expect(result).toMatch(/R\$/);
    expect(result).toContain('0');
  });

  it('formats fractional values', () => {
    const result = formatBrl(154.26);
    expect(result).toMatch(/R\$/);
    expect(result).toContain('154');
  });
});

// ── Tests: formatShares ─────────────────────────────────────

describe('formatShares', () => {
  it('AC4 — formats whole shares as integer', () => {
    expect(formatShares(5)).toBe('5');
    expect(formatShares(25)).toBe('25');
  });

  it('formats fractional shares with 4 decimals', () => {
    expect(formatShares(3.1415)).toBe('3.1415');
    expect(formatShares(0.5)).toBe('0.5000');
  });

  it('formats zero', () => {
    expect(formatShares(0)).toBe('0');
  });
});

// ── Tests: countBuyOrders (AC3 — result display) ─────────

describe('countBuyOrders', () => {
  it('T5.5.1 — counts all assets with shares_to_buy > 0', () => {
    expect(countBuyOrders(RESULT)).toBe(4);
  });

  it('returns 0 for empty result', () => {
    const empty: RebalanceResult = {
      contribution: 0, total_allocated: 0, total_spent: 0, total_remainder: 0, types: [],
    };
    expect(countBuyOrders(empty)).toBe(0);
  });
});

// ── Tests: flattenBuyOrders (AC3 — hierarchical display) ────

describe('flattenBuyOrders', () => {
  it('T5.5.1 — returns flat list with type/group context', () => {
    const orders = flattenBuyOrders(RESULT);
    expect(orders).toHaveLength(4);
    expect(orders[0].ticker).toBe('VALE3');
    expect(orders[0].type_name).toBe('Ações BR');
    expect(orders[0].group_name).toBe('Dividendos');
  });

  it('T5.5.3 — each order has ticker, shares, and cost', () => {
    const orders = flattenBuyOrders(RESULT);
    for (const order of orders) {
      expect(order.ticker).toBeTruthy();
      expect(order.shares_to_buy).toBeGreaterThan(0);
      expect(order.estimated_cost_brl).toBeGreaterThan(0);
    }
  });

  it('excludes zero-share assets', () => {
    const withZero: RebalanceResult = {
      contribution: 1000, total_allocated: 1000, total_spent: 500, total_remainder: 500,
      types: [{
        type_id: 't1', name: 'Test', allocated: 1000,
        groups: [{
          group_id: 'g1', name: 'G', allocated: 1000, spent: 500, remainder: 500,
          assets: [
            { asset_id: 'a1', ticker: 'BUY1', group_id: 'g1', ideal_pct: 50, allocated_brl: 500, shares_to_buy: 2, estimated_cost_brl: 500, remainder_brl: 0 },
            { asset_id: 'a2', ticker: 'SKIP1', group_id: 'g1', ideal_pct: 50, allocated_brl: 500, shares_to_buy: 0, estimated_cost_brl: 0, remainder_brl: 500 },
          ],
        }],
      }],
    };
    const orders = flattenBuyOrders(withZero);
    expect(orders).toHaveLength(1);
    expect(orders[0].ticker).toBe('BUY1');
  });
});

// ── Tests: countAllocatedTypes ──────────────────────────────

describe('countAllocatedTypes', () => {
  it('T5.5.2 — counts types with allocated > 0', () => {
    expect(countAllocatedTypes(RESULT)).toBe(2);
  });

  it('returns 0 when no types allocated', () => {
    const empty: RebalanceResult = {
      contribution: 0, total_allocated: 0, total_spent: 0, total_remainder: 0,
      types: [{ type_id: 't1', name: 'X', allocated: 0, groups: [] }],
    };
    expect(countAllocatedTypes(empty)).toBe(0);
  });
});

// ── Tests: T5.5.5 — Performance requirement ─────────────────

describe('Performance', () => {
  it('T5.5.5 — countBuyOrders + flattenBuyOrders execute in < 10ms for large result', () => {
    // Build a large result with 10 types × 15 groups × 9 assets = 1350 assets
    const largeResult: RebalanceResult = {
      contribution: 12000,
      total_allocated: 12000,
      total_spent: 11000,
      total_remainder: 1000,
      types: Array.from({ length: 10 }, (_, ti) => ({
        type_id: `t${ti}`,
        name: `Type ${ti}`,
        allocated: 1200,
        groups: Array.from({ length: 15 }, (_, gi) => ({
          group_id: `g${ti}-${gi}`,
          name: `Group ${gi}`,
          allocated: 80,
          spent: 75,
          remainder: 5,
          assets: Array.from({ length: 9 }, (_, ai) => ({
            asset_id: `a${ti}-${gi}-${ai}`,
            ticker: `TICK${ti}${gi}${ai}`,
            group_id: `g${ti}-${gi}`,
            ideal_pct: 100 / 9,
            allocated_brl: 80 / 9,
            shares_to_buy: ai + 1,
            estimated_cost_brl: (80 / 9) * 0.95,
            remainder_brl: (80 / 9) * 0.05,
          })),
        })),
      })),
    };

    const t0 = performance.now();
    countBuyOrders(largeResult);
    flattenBuyOrders(largeResult);
    const t1 = performance.now();
    expect(t1 - t0).toBeLessThan(10);
  });
});
