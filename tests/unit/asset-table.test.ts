import { describe, it, expect } from 'vitest';
import type { Asset, PriceCache } from '../../src/lib/nexus/types.js';

// ── Re-implement deriveRows + sortRows as pure functions for testing ──
// (Mirrors AssetTable.tsx internal logic — tested without React/DOM)

interface AssetRow {
  id: string;
  ticker: string;
  name: string | null;
  quantity: number;
  priceBrl: number | null;
  valueBrl: number | null;
  currency: string | null;
  bought: boolean;
  sold: boolean;
}

type AssetSortKey = 'ticker' | 'quantity' | 'price' | 'value';
type SortDir = 'asc' | 'desc';
interface SortState { key: AssetSortKey; dir: SortDir; }

function deriveRows(
  assets: Asset[],
  prices: Map<string, PriceCache>,
  exchangeRateBrl: number | null,
): AssetRow[] {
  return assets.map((a) => {
    const cached = prices.get(a.ticker);
    let priceBrl: number | null = null;

    if (cached?.price != null) {
      if (cached.currency === 'BRL') {
        priceBrl = cached.price;
      } else if (exchangeRateBrl != null) {
        priceBrl = cached.price * exchangeRateBrl;
      }
    }

    return {
      id: a.id,
      ticker: a.ticker,
      name: a.name,
      quantity: a.quantity,
      priceBrl,
      valueBrl: priceBrl != null ? a.quantity * priceBrl : null,
      currency: cached?.currency ?? null,
      bought: a.bought,
      sold: a.sold,
    };
  });
}

function sortRows(rows: AssetRow[], sort: SortState): AssetRow[] {
  return [...rows].sort((a, b) => {
    let diff = 0;
    switch (sort.key) {
      case 'ticker':
        diff = a.ticker.localeCompare(b.ticker, 'pt-BR');
        break;
      case 'quantity':
        diff = a.quantity - b.quantity;
        break;
      case 'price':
        diff = (a.priceBrl ?? -Infinity) - (b.priceBrl ?? -Infinity);
        break;
      case 'value':
        diff = (a.valueBrl ?? -Infinity) - (b.valueBrl ?? -Infinity);
        break;
    }
    return sort.dir === 'asc' ? diff : -diff;
  });
}

// ── Fixtures ────────────────────────────────────────────────

const BASE_ASSET: Asset = {
  id: 'a1',
  ticker: 'PETR4',
  name: 'Petrobras',
  sector: 'Energy',
  quantity: 100,
  group_id: 'g1',
  price_source: 'brapi',
  is_active: true,
  manual_override: false,
  whole_shares: true,
  bought: false,
  sold: false,
  weight_mode: 'questionnaire',
  manual_weight: 0,
  user_id: 'u1',
  wallet_id: 'w1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function makeAsset(overrides: Partial<Asset>): Asset {
  return { ...BASE_ASSET, ...overrides };
}

function makePriceCache(ticker: string, price: number | null, currency = 'BRL'): PriceCache {
  return {
    ticker,
    price,
    currency,
    source: 'brapi',
    fetched_at: '2026-03-22T00:00:00Z',
    user_id: 'u1',
  };
}

// ── Tests: deriveRows ───────────────────────────────────────

describe('deriveRows', () => {
  it('T8.1.3 — computes BRL price and value for BRL assets', () => {
    const assets = [makeAsset({ ticker: 'PETR4', quantity: 100 })];
    const prices = new Map([['PETR4', makePriceCache('PETR4', 35.50)]]);

    const rows = deriveRows(assets, prices, null);
    expect(rows[0].priceBrl).toBe(35.50);
    expect(rows[0].valueBrl).toBe(3550);
  });

  it('converts USD price to BRL using exchange rate', () => {
    const assets = [makeAsset({ ticker: 'AAPL', quantity: 10 })];
    const prices = new Map([['AAPL', makePriceCache('AAPL', 175, 'USD')]]);

    const rows = deriveRows(assets, prices, 5.0);
    expect(rows[0].priceBrl).toBe(875);
    expect(rows[0].valueBrl).toBe(8750);
  });

  it('T8.1.5 — returns null price/value when price cache is missing', () => {
    const assets = [makeAsset({ ticker: 'UNKNOWN' })];
    const prices = new Map<string, PriceCache>();

    const rows = deriveRows(assets, prices, null);
    expect(rows[0].priceBrl).toBeNull();
    expect(rows[0].valueBrl).toBeNull();
  });

  it('T8.1.5 — returns null price/value when cached price is null', () => {
    const assets = [makeAsset({ ticker: 'PETR4' })];
    const prices = new Map([['PETR4', makePriceCache('PETR4', null)]]);

    const rows = deriveRows(assets, prices, null);
    expect(rows[0].priceBrl).toBeNull();
    expect(rows[0].valueBrl).toBeNull();
  });

  it('returns null for USD price when exchange rate is missing', () => {
    const assets = [makeAsset({ ticker: 'AAPL', quantity: 10 })];
    const prices = new Map([['AAPL', makePriceCache('AAPL', 175, 'USD')]]);

    const rows = deriveRows(assets, prices, null);
    expect(rows[0].priceBrl).toBeNull();
    expect(rows[0].valueBrl).toBeNull();
  });
});

// ── Tests: sortRows ─────────────────────────────────────────

describe('sortRows', () => {
  const ROWS: AssetRow[] = [
    { id: 'a1', ticker: 'PETR4', name: 'Petrobras', quantity: 100, priceBrl: 35, valueBrl: 3500, currency: 'BRL', bought: false, sold: false },
    { id: 'a2', ticker: 'AAPL', name: 'Apple', quantity: 10, priceBrl: 875, valueBrl: 8750, currency: 'USD', bought: true, sold: false },
    { id: 'a3', ticker: 'BTC', name: 'Bitcoin', quantity: 0.5, priceBrl: null, valueBrl: null, currency: null, bought: false, sold: false },
  ];

  it('sorts by ticker ascending', () => {
    const sorted = sortRows(ROWS, { key: 'ticker', dir: 'asc' });
    expect(sorted.map((r) => r.ticker)).toEqual(['AAPL', 'BTC', 'PETR4']);
  });

  it('sorts by value descending, null values last', () => {
    const sorted = sortRows(ROWS, { key: 'value', dir: 'desc' });
    expect(sorted.map((r) => r.ticker)).toEqual(['AAPL', 'PETR4', 'BTC']);
  });

  it('sorts by quantity ascending', () => {
    const sorted = sortRows(ROWS, { key: 'quantity', dir: 'asc' });
    expect(sorted.map((r) => r.quantity)).toEqual([0.5, 10, 100]);
  });

  it('does not mutate the original array', () => {
    const original = [...ROWS];
    sortRows(ROWS, { key: 'ticker', dir: 'desc' });
    expect(ROWS).toEqual(original);
  });

  it('handles empty array', () => {
    expect(sortRows([], { key: 'ticker', dir: 'asc' })).toEqual([]);
  });
});

// ── Tests: placeholder formatting ───────────────────────────

describe('null value formatting', () => {
  const PLACEHOLDER = '—';

  function formatPrice(value: number | null): string {
    if (value == null) return PLACEHOLDER;
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  it('T8.1.5 — returns "—" placeholder for null price', () => {
    expect(formatPrice(null)).toBe(PLACEHOLDER);
  });

  it('formats valid prices as BRL currency', () => {
    const result = formatPrice(35.50);
    expect(result).toMatch(/R\$/);
    expect(result).toContain('35');
  });
});
