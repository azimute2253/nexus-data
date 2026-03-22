import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PriceEngine } from './index.ts';
import { BrapiProvider } from '../providers/brapi-provider.ts';
import { ExchangeRateProvider } from '../providers/exchange-provider.ts';
import type { PriceResult } from '../types.ts';
import type { ExchangeRateResult } from '../providers/exchange-provider.ts';

// ============================================================
// Integration tests — Price Engine full pipeline
// Story 3.4: brapi → exchange rate → aggregator → engine facade
// ============================================================

// ----- Mock helpers -----

function mockBrapi(results: PriceResult[]): BrapiProvider {
  return {
    name: 'brapi',
    fetchPrices: vi.fn().mockResolvedValue(results),
  } as unknown as BrapiProvider;
}

function mockExchange(rates: ExchangeRateResult[]): ExchangeRateProvider {
  return {
    name: 'exchangerate-api',
    fetchRates: vi.fn().mockResolvedValue(rates),
  } as unknown as ExchangeRateProvider;
}

const USD_BRL = 5.85;
const NOW = 1_711_100_000_000; // fixed timestamp

function defaultRates(): ExchangeRateResult[] {
  return [
    { pair: 'USD/BRL', rate: USD_BRL, source: 'exchangerate-api', fetched_at: '2026-03-22T12:00:00.000Z' },
    { pair: 'BTC/BRL', rate: 530_000, source: 'exchangerate-api', fetched_at: '2026-03-22T12:00:00.000Z' },
  ];
}

function price(ticker: string, value: number, currency = 'BRL'): PriceResult {
  return { ticker, price: value, currency, source: 'brapi', fetched_at: '2026-03-22T12:00:00.000Z' };
}

function createEngine(
  brapiResults: PriceResult[],
  exchangeRates: ExchangeRateResult[] = defaultRates(),
  cacheTtlMs = 5 * 60 * 1000,
  nowFn = () => NOW,
) {
  const brapi = mockBrapi(brapiResults);
  const exchange = mockExchange(exchangeRates);
  const engine = new PriceEngine({
    brapiApiKey: 'test-key',
    exchangeApiKey: 'test-key',
    brapiProvider: brapi,
    exchangeProvider: exchange,
    cacheTtlMs,
    nowFn,
  });
  return { engine, brapi, exchange };
}

// ----- AC1: Fetches prices via aggregator -----

describe('AC1 — getPrices uses aggregator pipeline', () => {
  it('fetches a single BRL ticker through the full pipeline', async () => {
    const { engine, brapi } = createEngine([price('VALE3', 68.42)]);

    const results = await engine.getPrices([{ ticker: 'VALE3', currency: 'BRL' }]);

    expect(results).toHaveLength(1);
    expect(results[0].ticker).toBe('VALE3');
    expect(results[0].price_brl).toBe(68.42);
    expect(brapi.fetchPrices).toHaveBeenCalledWith(['VALE3']);
  });

  it('fetches multiple tickers in a single batch', async () => {
    const { engine, brapi } = createEngine([
      price('VALE3', 68.42),
      price('PETR4', 38.15),
      price('ITUB4', 25.00),
    ]);

    const results = await engine.getPrices([
      { ticker: 'VALE3', currency: 'BRL' },
      { ticker: 'PETR4', currency: 'BRL' },
      { ticker: 'ITUB4', currency: 'BRL' },
    ]);

    expect(results).toHaveLength(3);
    expect(brapi.fetchPrices).toHaveBeenCalledTimes(1);
  });
});

// ----- AC2: Handles BRL and USD correctly -----

describe('AC2 — BRL and USD asset handling', () => {
  it('BRL asset: returns price directly without exchange rate call', async () => {
    const { engine, exchange } = createEngine([price('PETR4', 38.15)]);

    const results = await engine.getPrices([{ ticker: 'PETR4', currency: 'BRL' }]);

    expect(results[0].price_brl).toBe(38.15);
    expect(results[0].currency).toBe('BRL');
    expect(exchange.fetchRates).not.toHaveBeenCalled();
  });

  it('USD asset: converts to BRL using exchange rate', async () => {
    const { engine, exchange } = createEngine([price('QQQM', 195.00, 'USD')]);

    const results = await engine.getPrices([{ ticker: 'QQQM', currency: 'USD' }]);

    expect(results[0].price_brl).toBeCloseTo(195.00 * USD_BRL, 2);
    expect(results[0].currency).toBe('USD');
    expect(exchange.fetchRates).toHaveBeenCalledTimes(1);
  });

  it('mixed BRL + USD batch: only fetches exchange rate once', async () => {
    const { engine, exchange } = createEngine([
      price('VALE3', 68.42),
      price('QQQM', 195.00, 'USD'),
    ]);

    const results = await engine.getPrices([
      { ticker: 'VALE3', currency: 'BRL' },
      { ticker: 'QQQM', currency: 'USD' },
    ]);

    expect(results).toHaveLength(2);
    const vale = results.find((r) => r.ticker === 'VALE3')!;
    const qqqm = results.find((r) => r.ticker === 'QQQM')!;
    expect(vale.price_brl).toBe(68.42);
    expect(qqqm.price_brl).toBeCloseTo(195.00 * USD_BRL, 2);
    expect(exchange.fetchRates).toHaveBeenCalledTimes(1);
  });
});

// ----- AC3: Normalized return shape -----

describe('AC3 — Returns normalized { ticker, price_brl, currency, timestamp }', () => {
  it('BRL result has correct shape', async () => {
    const { engine } = createEngine([price('VALE3', 68.42)]);

    const [result] = await engine.getPrices([{ ticker: 'VALE3', currency: 'BRL' }]);

    expect(result).toEqual({
      ticker: 'VALE3',
      price_brl: 68.42,
      currency: 'BRL',
      timestamp: expect.any(String),
    });
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it('USD result has correct shape with converted price', async () => {
    const { engine } = createEngine([price('SCHD', 27.50, 'USD')]);

    const [result] = await engine.getPrices([{ ticker: 'SCHD', currency: 'USD' }]);

    expect(result).toEqual({
      ticker: 'SCHD',
      price_brl: expect.closeTo(27.50 * USD_BRL, 2),
      currency: 'USD',
      timestamp: expect.any(String),
    });
  });
});

// ----- AC4: Integration test — full pipeline -----

describe('AC4 — Full pipeline integration', () => {
  it('BRL asset: brapi → engine → return BRL price', async () => {
    const { engine, brapi, exchange } = createEngine([price('VALE3', 68.42)]);

    const results = await engine.getPrices([{ ticker: 'VALE3', currency: 'BRL' }]);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      ticker: 'VALE3',
      price_brl: 68.42,
      currency: 'BRL',
      timestamp: expect.any(String),
    });
    expect(brapi.fetchPrices).toHaveBeenCalledWith(['VALE3']);
    expect(exchange.fetchRates).not.toHaveBeenCalled();
  });

  it('USD asset: brapi + exchange rate → return BRL price', async () => {
    const { engine, brapi, exchange } = createEngine([price('QQQM', 195.00, 'USD')]);

    const results = await engine.getPrices([{ ticker: 'QQQM', currency: 'USD' }]);

    expect(results).toHaveLength(1);
    expect(results[0].ticker).toBe('QQQM');
    expect(results[0].price_brl).toBeCloseTo(195.00 * USD_BRL, 2);
    expect(results[0].currency).toBe('USD');
    expect(brapi.fetchPrices).toHaveBeenCalledTimes(1);
    expect(exchange.fetchRates).toHaveBeenCalledTimes(1);
  });
});

// ----- AC5: Caching -----

describe('AC5 — In-memory price cache', () => {
  it('returns cached result on second call within TTL', async () => {
    const { engine, brapi } = createEngine([price('VALE3', 68.42)]);

    const first = await engine.getPrices([{ ticker: 'VALE3', currency: 'BRL' }]);
    const second = await engine.getPrices([{ ticker: 'VALE3', currency: 'BRL' }]);

    expect(first).toEqual(second);
    // brapi should only be called once — second call uses cache
    expect(brapi.fetchPrices).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after cache TTL expires', async () => {
    let now = NOW;
    const { engine, brapi } = createEngine(
      [price('VALE3', 68.42)],
      defaultRates(),
      5 * 60 * 1000,
      () => now,
    );

    await engine.getPrices([{ ticker: 'VALE3', currency: 'BRL' }]);
    expect(brapi.fetchPrices).toHaveBeenCalledTimes(1);

    // Advance past TTL
    now += 5 * 60 * 1000 + 1;
    await engine.getPrices([{ ticker: 'VALE3', currency: 'BRL' }]);
    expect(brapi.fetchPrices).toHaveBeenCalledTimes(2);
  });

  it('clearCache() forces fresh fetch', async () => {
    const { engine, brapi } = createEngine([price('VALE3', 68.42)]);

    await engine.getPrices([{ ticker: 'VALE3', currency: 'BRL' }]);
    expect(engine.cacheSize).toBe(1);

    engine.clearCache();
    expect(engine.cacheSize).toBe(0);

    await engine.getPrices([{ ticker: 'VALE3', currency: 'BRL' }]);
    expect(brapi.fetchPrices).toHaveBeenCalledTimes(2);
  });

  it('caches BRL and USD tickers independently', async () => {
    const { engine } = createEngine([
      price('VALE3', 68.42),
      price('QQQM', 195.00, 'USD'),
    ]);

    await engine.getPrices([
      { ticker: 'VALE3', currency: 'BRL' },
      { ticker: 'QQQM', currency: 'USD' },
    ]);

    expect(engine.cacheSize).toBe(2);
  });
});

// ----- AC6: Error handling -----

describe('AC6 — Error handling propagates with context', () => {
  it('propagates brapi error', async () => {
    const brapi = {
      name: 'brapi',
      fetchPrices: vi.fn().mockRejectedValue(new Error('brapi HTTP 500: Internal Server Error')),
    } as unknown as BrapiProvider;
    const exchange = mockExchange(defaultRates());
    const engine = new PriceEngine({
      brapiApiKey: 'k',
      exchangeApiKey: 'k',
      brapiProvider: brapi,
      exchangeProvider: exchange,
    });

    await expect(
      engine.getPrices([{ ticker: 'VALE3', currency: 'BRL' }]),
    ).rejects.toThrow('brapi HTTP 500');
  });

  it('propagates exchange rate error for USD tickers', async () => {
    const brapi = mockBrapi([price('QQQM', 195.00, 'USD')]);
    const exchange = {
      name: 'exchangerate-api',
      fetchRates: vi.fn().mockRejectedValue(new Error('exchangerate-api timeout')),
    } as unknown as ExchangeRateProvider;
    const engine = new PriceEngine({
      brapiApiKey: 'k',
      exchangeApiKey: 'k',
      brapiProvider: brapi,
      exchangeProvider: exchange,
    });

    await expect(
      engine.getPrices([{ ticker: 'QQQM', currency: 'USD' }]),
    ).rejects.toThrow('exchangerate-api timeout');
  });

  it('returns empty array for empty request', async () => {
    const { engine, brapi } = createEngine([]);

    const results = await engine.getPrices([]);

    expect(results).toEqual([]);
    expect(brapi.fetchPrices).not.toHaveBeenCalled();
  });
});

// ----- Deduplication -----

describe('Request deduplication', () => {
  it('deduplicates identical ticker+currency requests', async () => {
    const { engine, brapi } = createEngine([price('VALE3', 68.42)]);

    const results = await engine.getPrices([
      { ticker: 'VALE3', currency: 'BRL' },
      { ticker: 'VALE3', currency: 'BRL' }, // duplicate
      { ticker: 'VALE3', currency: 'BRL' }, // duplicate
    ]);

    // Only one result (deduped), only one ticker sent to brapi
    expect(results).toHaveLength(1);
    expect(brapi.fetchPrices).toHaveBeenCalledWith(['VALE3']);
  });

  it('treats same ticker with different currencies as separate', async () => {
    const { engine } = createEngine([
      price('AAPL34', 38.00),
      price('AAPL34', 185.00, 'USD'),
    ]);

    const results = await engine.getPrices([
      { ticker: 'AAPL34', currency: 'BRL' },
      { ticker: 'AAPL34', currency: 'USD' },
    ]);

    expect(results).toHaveLength(2);
  });
});
