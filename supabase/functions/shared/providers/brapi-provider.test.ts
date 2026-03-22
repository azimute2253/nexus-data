import { describe, it, expect, vi } from 'vitest';
import { BrapiProvider } from './brapi-provider.ts';
import type { BrapiQuoteResponse } from './brapi-provider.ts';

// Helper: build a mock fetch that returns the given response
function mockFetch(body: BrapiQuoteResponse, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : `Error ${status}`,
    json: () => Promise.resolve(body),
  });
}

function createProvider(fetchFn: typeof fetch, batchSize = 20) {
  return new BrapiProvider({
    apiKey: 'test-key',
    batchSize,
    fetchFn,
  });
}

// ----- T3.1.1: Batch splitting (25 tickers → 2 requests) -----

describe('T3.1.1 — Batch splitting', () => {
  it('splits 25 tickers into 2 batches (20 + 5)', async () => {
    const tickers = Array.from({ length: 25 }, (_, i) => `TICK${i}`);
    const fn = vi.fn().mockImplementation(async (url: string) => {
      // Extract tickers from URL path
      const path = new URL(url).pathname; // /api/quote/TICK0,TICK1,...
      const tickerPart = path.split('/quote/')[1];
      const requestedTickers = tickerPart.split(',');
      return {
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            results: requestedTickers.map((t: string) => ({
              symbol: t,
              regularMarketPrice: 10.5,
              currency: 'BRL',
            })),
          }),
      };
    });

    const provider = createProvider(fn as unknown as typeof fetch);
    const results = await provider.fetchPrices(tickers);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(25);

    // First batch: 20 tickers
    const firstUrl = fn.mock.calls[0][0] as string;
    const firstTickers = new URL(firstUrl).pathname.split('/quote/')[1].split(',');
    expect(firstTickers).toHaveLength(20);

    // Second batch: 5 tickers
    const secondUrl = fn.mock.calls[1][0] as string;
    const secondTickers = new URL(secondUrl).pathname.split('/quote/')[1].split(',');
    expect(secondTickers).toHaveLength(5);
  });

  it('makes 1 request for <= 20 tickers', async () => {
    const tickers = ['VALE3', 'PETR4', 'ITUB4'];
    const fn = mockFetch({
      results: tickers.map((t) => ({
        symbol: t,
        regularMarketPrice: 50.0,
        currency: 'BRL',
      })),
    });

    const provider = createProvider(fn);
    const results = await provider.fetchPrices(tickers);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(3);
  });

  it('returns empty array for empty ticker list', async () => {
    const fn = mockFetch({ results: [] });
    const provider = createProvider(fn);
    const results = await provider.fetchPrices([]);

    expect(fn).not.toHaveBeenCalled();
    expect(results).toEqual([]);
  });
});

// ----- T3.1.2: Valid tickers → prices in BRL -----

describe('T3.1.2 — Valid ticker response parsing', () => {
  it('returns prices for VALE3 and PETR4 in BRL', async () => {
    const fn = mockFetch({
      results: [
        { symbol: 'VALE3', regularMarketPrice: 68.42, currency: 'BRL' },
        { symbol: 'PETR4', regularMarketPrice: 38.15, currency: 'BRL' },
      ],
    });

    const provider = createProvider(fn);
    const results = await provider.fetchPrices(['VALE3', 'PETR4']);

    expect(results).toHaveLength(2);

    const vale = results.find((r) => r.ticker === 'VALE3')!;
    expect(vale.price).toBe(68.42);
    expect(vale.currency).toBe('BRL');
    expect(vale.source).toBe('brapi');
    expect(vale.fetched_at).toBeTruthy();

    const petr = results.find((r) => r.ticker === 'PETR4')!;
    expect(petr.price).toBe(38.15);
    expect(petr.currency).toBe('BRL');
    expect(petr.source).toBe('brapi');
  });

  it('maps all PriceResult fields correctly', async () => {
    const fn = mockFetch({
      results: [
        { symbol: 'HGLG11', regularMarketPrice: 162.3, currency: 'BRL' },
      ],
    });

    const provider = createProvider(fn);
    const [result] = await provider.fetchPrices(['HGLG11']);

    expect(result).toEqual({
      ticker: 'HGLG11',
      price: 162.3,
      currency: 'BRL',
      source: 'brapi',
      fetched_at: expect.any(String),
    });

    // Verify fetched_at is valid ISO 8601
    expect(() => new Date(result.fetched_at)).not.toThrow();
    expect(new Date(result.fetched_at).toISOString()).toBe(result.fetched_at);
  });
});

// ----- T3.1.3: Invalid ticker handling -----

describe('T3.1.3 — Invalid ticker handling', () => {
  it('skips invalid ticker and returns valid ones', async () => {
    // brapi returns results only for valid tickers
    const fn = mockFetch({
      results: [
        { symbol: 'VALE3', regularMarketPrice: 68.42, currency: 'BRL' },
      ],
    });

    const provider = createProvider(fn);
    const results = await provider.fetchPrices(['VALE3', 'XXXX99']);

    // Only VALE3 should be in results
    expect(results).toHaveLength(1);
    expect(results[0].ticker).toBe('VALE3');
  });

  it('returns empty results when all tickers are invalid', async () => {
    const fn = mockFetch({ results: [] });

    const provider = createProvider(fn);
    const results = await provider.fetchPrices(['XXXX99', 'YYYY88']);

    expect(results).toHaveLength(0);
  });
});

// ----- API error handling -----

describe('API error handling', () => {
  it('handles HTTP 429 rate limit gracefully', async () => {
    const fn = mockFetch({ error: true, message: 'Rate limit' }, 429);
    const provider = createProvider(fn);

    // Should not throw — returns empty results and logs
    const results = await provider.fetchPrices(['VALE3']);
    expect(results).toHaveLength(0);
  });

  it('handles HTTP 500 server error gracefully', async () => {
    const fn = mockFetch({ error: true, message: 'Internal error' }, 500);
    const provider = createProvider(fn);

    const results = await provider.fetchPrices(['VALE3']);
    expect(results).toHaveLength(0);
  });

  it('handles network failure gracefully', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Network error'));
    const provider = createProvider(fn as unknown as typeof fetch);

    const results = await provider.fetchPrices(['VALE3']);
    expect(results).toHaveLength(0);
  });

  it('handles brapi API-level error response', async () => {
    const fn = mockFetch({ error: true, message: 'Invalid token' });
    // Note: brapi may return 200 with error in body
    const provider = createProvider(fn);

    const results = await provider.fetchPrices(['VALE3']);
    expect(results).toHaveLength(0);
  });

  it('returns partial results when one batch fails', async () => {
    let callCount = 0;
    const fn = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              results: [
                { symbol: 'VALE3', regularMarketPrice: 68.42, currency: 'BRL' },
              ],
            }),
        };
      }
      // Second batch fails
      return {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: true }),
      };
    });

    const provider = createProvider(fn as unknown as typeof fetch, 1);
    const results = await provider.fetchPrices(['VALE3', 'PETR4']);

    // Only first batch succeeded
    expect(results).toHaveLength(1);
    expect(results[0].ticker).toBe('VALE3');
  });
});

// ----- Provider interface compliance -----

describe('PriceProvider interface', () => {
  it('has name property set to "brapi"', () => {
    const provider = createProvider(mockFetch({ results: [] }));
    expect(provider.name).toBe('brapi');
  });

  it('passes API key as token query parameter', async () => {
    const fn = mockFetch({
      results: [
        { symbol: 'VALE3', regularMarketPrice: 68.42, currency: 'BRL' },
      ],
    });

    const provider = createProvider(fn);
    await provider.fetchPrices(['VALE3']);

    const calledUrl = (fn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('token=test-key');
  });

  it('constructs correct URL with comma-separated tickers', async () => {
    const fn = mockFetch({
      results: [
        { symbol: 'VALE3', regularMarketPrice: 68.42, currency: 'BRL' },
        { symbol: 'PETR4', regularMarketPrice: 38.15, currency: 'BRL' },
      ],
    });

    const provider = createProvider(fn);
    await provider.fetchPrices(['VALE3', 'PETR4']);

    const calledUrl = (fn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('/quote/VALE3,PETR4');
  });
});
