import { describe, it, expect, vi } from 'vitest';
import { aggregatePrice, aggregatePrices } from './aggregator.ts';
import { BrapiProvider } from '../providers/brapi-provider.ts';
import { ExchangeRateProvider } from '../providers/exchange-provider.ts';
import type { PriceResult } from '../types.ts';
import type { ExchangeRateResult } from '../providers/exchange-provider.ts';
import type { PriceAggregatorOptions } from './aggregator.ts';

// ----- Helpers -----

function mockBrapiProvider(results: PriceResult[]): BrapiProvider {
  return {
    name: 'brapi',
    fetchPrices: vi.fn().mockResolvedValue(results),
  } as unknown as BrapiProvider;
}

function mockExchangeProvider(rates: ExchangeRateResult[]): ExchangeRateProvider {
  return {
    name: 'exchangerate-api',
    fetchRates: vi.fn().mockResolvedValue(rates),
  } as unknown as ExchangeRateProvider;
}

const USD_BRL_RATE = 5.85;

function defaultExchangeRates(): ExchangeRateResult[] {
  return [
    { pair: 'USD/BRL', rate: USD_BRL_RATE, source: 'exchangerate-api', fetched_at: '2026-03-22T12:00:00.000Z' },
    { pair: 'BTC/BRL', rate: 530000, source: 'exchangerate-api', fetched_at: '2026-03-22T12:00:00.000Z' },
  ];
}

function brapiResult(ticker: string, price: number, currency = 'BRL'): PriceResult {
  return {
    ticker,
    price,
    currency,
    source: 'brapi',
    fetched_at: '2026-03-22T12:00:00.000Z',
  };
}

// ----- AC1: BRL asset — no conversion -----

describe('AC1 — BRL asset price (no conversion)', () => {
  it('returns BRL price directly without exchange rate fetch', async () => {
    const brapi = mockBrapiProvider([brapiResult('VALE3', 68.42)]);
    const exchange = mockExchangeProvider(defaultExchangeRates());
    const options: PriceAggregatorOptions = { brapiProvider: brapi, exchangeProvider: exchange };

    const result = await aggregatePrice({ ticker: 'VALE3', currency: 'BRL' }, options);

    expect(result.ticker).toBe('VALE3');
    expect(result.price_brl).toBe(68.42);
    expect(result.original_price).toBe(68.42);
    expect(result.currency).toBe('BRL');
    expect(result.timestamp).toBeTruthy();

    // Should NOT call exchange provider for BRL assets
    expect(exchange.fetchRates).not.toHaveBeenCalled();
  });
});

// ----- AC2: USD asset — converts to BRL -----

describe('AC2 — USD asset price with conversion', () => {
  it('fetches USD price and converts to BRL using exchange rate', async () => {
    const brapi = mockBrapiProvider([brapiResult('AAPL34', 185.50, 'USD')]);
    const exchange = mockExchangeProvider(defaultExchangeRates());
    const options: PriceAggregatorOptions = { brapiProvider: brapi, exchangeProvider: exchange };

    const result = await aggregatePrice({ ticker: 'AAPL34', currency: 'USD' }, options);

    expect(result.ticker).toBe('AAPL34');
    expect(result.original_price).toBe(185.50);
    expect(result.price_brl).toBeCloseTo(185.50 * USD_BRL_RATE, 2);
    expect(result.currency).toBe('USD');
    expect(result.timestamp).toBeTruthy();

    // Should call exchange provider for USD assets
    expect(exchange.fetchRates).toHaveBeenCalledTimes(1);
  });
});

// ----- AC3: Return shape validation -----

describe('AC3 — AggregatedPrice shape', () => {
  it('returns { ticker, price_brl, original_price, currency, timestamp }', async () => {
    const brapi = mockBrapiProvider([brapiResult('PETR4', 38.15)]);
    const exchange = mockExchangeProvider(defaultExchangeRates());
    const options: PriceAggregatorOptions = { brapiProvider: brapi, exchangeProvider: exchange };

    const result = await aggregatePrice({ ticker: 'PETR4', currency: 'BRL' }, options);

    expect(result).toEqual({
      ticker: 'PETR4',
      price_brl: 38.15,
      original_price: 38.15,
      currency: 'BRL',
      timestamp: expect.any(String),
    });

    // Verify timestamp is valid ISO 8601
    expect(() => new Date(result.timestamp)).not.toThrow();
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});

// ----- AC4: Batch mode -----

describe('AC4 — Batch aggregation', () => {
  it('aggregates mixed BRL and USD tickers in one call', async () => {
    const brapi = mockBrapiProvider([
      brapiResult('VALE3', 68.42),
      brapiResult('PETR4', 38.15),
      brapiResult('QQQM', 195.00, 'USD'),
    ]);
    const exchange = mockExchangeProvider(defaultExchangeRates());
    const options: PriceAggregatorOptions = { brapiProvider: brapi, exchangeProvider: exchange };

    const results = await aggregatePrices(
      [
        { ticker: 'VALE3', currency: 'BRL' },
        { ticker: 'PETR4', currency: 'BRL' },
        { ticker: 'QQQM', currency: 'USD' },
      ],
      options,
    );

    expect(results).toHaveLength(3);

    const vale = results.find((r) => r.ticker === 'VALE3')!;
    expect(vale.price_brl).toBe(68.42);
    expect(vale.currency).toBe('BRL');

    const petr = results.find((r) => r.ticker === 'PETR4')!;
    expect(petr.price_brl).toBe(38.15);
    expect(petr.currency).toBe('BRL');

    const qqqm = results.find((r) => r.ticker === 'QQQM')!;
    expect(qqqm.price_brl).toBeCloseTo(195.00 * USD_BRL_RATE, 2);
    expect(qqqm.original_price).toBe(195.00);
    expect(qqqm.currency).toBe('USD');
  });

  it('returns empty array for empty request list', async () => {
    const brapi = mockBrapiProvider([]);
    const exchange = mockExchangeProvider(defaultExchangeRates());
    const options: PriceAggregatorOptions = { brapiProvider: brapi, exchangeProvider: exchange };

    const results = await aggregatePrices([], options);

    expect(results).toEqual([]);
    expect(brapi.fetchPrices).not.toHaveBeenCalled();
  });

  it('only fetches exchange rate when USD tickers are present', async () => {
    const brapi = mockBrapiProvider([
      brapiResult('VALE3', 68.42),
      brapiResult('PETR4', 38.15),
    ]);
    const exchange = mockExchangeProvider(defaultExchangeRates());
    const options: PriceAggregatorOptions = { brapiProvider: brapi, exchangeProvider: exchange };

    await aggregatePrices(
      [
        { ticker: 'VALE3', currency: 'BRL' },
        { ticker: 'PETR4', currency: 'BRL' },
      ],
      options,
    );

    // No USD tickers → no exchange rate fetch
    expect(exchange.fetchRates).not.toHaveBeenCalled();
  });

  it('fetches all tickers in a single brapi batch call', async () => {
    const brapi = mockBrapiProvider([
      brapiResult('VALE3', 68.42),
      brapiResult('PETR4', 38.15),
      brapiResult('ITUB4', 25.00),
    ]);
    const exchange = mockExchangeProvider(defaultExchangeRates());
    const options: PriceAggregatorOptions = { brapiProvider: brapi, exchangeProvider: exchange };

    await aggregatePrices(
      [
        { ticker: 'VALE3', currency: 'BRL' },
        { ticker: 'PETR4', currency: 'BRL' },
        { ticker: 'ITUB4', currency: 'BRL' },
      ],
      options,
    );

    // Should make a single batch call with all tickers
    expect(brapi.fetchPrices).toHaveBeenCalledTimes(1);
    expect(brapi.fetchPrices).toHaveBeenCalledWith(['VALE3', 'PETR4', 'ITUB4']);
  });
});

// ----- AC5: Error handling -----

describe('AC5 — Error propagation', () => {
  it('throws when brapi returns no result for ticker', async () => {
    const brapi = mockBrapiProvider([]); // no results
    const exchange = mockExchangeProvider(defaultExchangeRates());
    const options: PriceAggregatorOptions = { brapiProvider: brapi, exchangeProvider: exchange };

    await expect(
      aggregatePrice({ ticker: 'INVALID', currency: 'BRL' }, options),
    ).rejects.toThrow('No price returned for ticker: INVALID');
  });

  it('throws when exchange rate is unavailable for USD ticker', async () => {
    const brapi = mockBrapiProvider([brapiResult('QQQM', 195.00, 'USD')]);
    const exchange = mockExchangeProvider([]); // no rates
    const options: PriceAggregatorOptions = { brapiProvider: brapi, exchangeProvider: exchange };

    await expect(
      aggregatePrice({ ticker: 'QQQM', currency: 'USD' }, options),
    ).rejects.toThrow('USD/BRL exchange rate not available');
  });

  it('propagates brapi fetch error with context', async () => {
    const brapi = {
      name: 'brapi',
      fetchPrices: vi.fn().mockRejectedValue(new Error('brapi HTTP 500: Internal Server Error')),
    } as unknown as BrapiProvider;
    const exchange = mockExchangeProvider(defaultExchangeRates());
    const options: PriceAggregatorOptions = { brapiProvider: brapi, exchangeProvider: exchange };

    await expect(
      aggregatePrice({ ticker: 'VALE3', currency: 'BRL' }, options),
    ).rejects.toThrow('brapi HTTP 500: Internal Server Error');
  });

  it('propagates exchange provider error with context', async () => {
    const brapi = mockBrapiProvider([brapiResult('QQQM', 195.00, 'USD')]);
    const exchange = {
      name: 'exchangerate-api',
      fetchRates: vi.fn().mockRejectedValue(new Error('exchangerate-api HTTP 500: Internal Server Error')),
    } as unknown as ExchangeRateProvider;
    const options: PriceAggregatorOptions = { brapiProvider: brapi, exchangeProvider: exchange };

    await expect(
      aggregatePrice({ ticker: 'QQQM', currency: 'USD' }, options),
    ).rejects.toThrow('exchangerate-api HTTP 500: Internal Server Error');
  });

  it('batch throws when exchange rate missing for USD tickers', async () => {
    const brapi = mockBrapiProvider([brapiResult('QQQM', 195.00, 'USD')]);
    const exchange = mockExchangeProvider([]); // no rates
    const options: PriceAggregatorOptions = { brapiProvider: brapi, exchangeProvider: exchange };

    await expect(
      aggregatePrices([{ ticker: 'QQQM', currency: 'USD' }], options),
    ).rejects.toThrow('USD/BRL exchange rate not available');
  });
});
