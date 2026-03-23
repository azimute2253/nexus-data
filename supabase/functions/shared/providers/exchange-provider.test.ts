import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExchangeRateProvider } from './exchange-provider.ts';
import type { ExchangeRateApiResponse } from './exchange-provider.ts';

// Helper: build a mock fetch that returns given exchange rate response
function mockFetch(body: ExchangeRateApiResponse, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : `Error ${status}`,
    json: () => Promise.resolve(body),
  });
}

function successResponse(from: string, to: string, rate: number): ExchangeRateApiResponse {
  return {
    result: 'success',
    base_code: from,
    target_code: to,
    conversion_rate: rate,
    time_last_update_utc: new Date().toUTCString(),
  };
}

function createProvider(
  fetchFn: typeof fetch,
  options: { cacheTtlMs?: number; nowFn?: () => number } = {}
) {
  return new ExchangeRateProvider({
    apiKey: 'test-key',
    fetchFn,
    ...options,
  });
}

// ----- T3.3.1: Fetch USD/BRL rate -----

describe('T3.3.1 — Fetch USD/BRL', () => {
  it('returns USD/BRL rate within reasonable range', async () => {
    const fn = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/pair/USD/BRL')) {
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve(successResponse('USD', 'BRL', 5.85)),
        };
      }
      // BTC/BRL
      return {
        ok: true,
        status: 200,
        json: () => Promise.resolve(successResponse('BTC', 'BRL', 530000)),
      };
    });

    const provider = createProvider(fn as unknown as typeof fetch);
    const results = await provider.fetchRates();

    const usdBrl = results.find((r) => r.pair === 'USD/BRL')!;
    expect(usdBrl).toBeDefined();
    expect(usdBrl.rate).toBe(5.85);
    expect(usdBrl.rate).toBeGreaterThan(4.0);
    expect(usdBrl.rate).toBeLessThan(8.0);
    expect(usdBrl.source).toBe('exchangerate-api');
    expect(usdBrl.fetched_at).toBeTruthy();
  });
});

// ----- T3.3.2: Fetch BTC/BRL rate -----

describe('T3.3.2 — Fetch BTC/BRL', () => {
  it('returns BTC/BRL with a positive rate', async () => {
    const fn = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/pair/USD/BRL')) {
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve(successResponse('USD', 'BRL', 5.85)),
        };
      }
      return {
        ok: true,
        status: 200,
        json: () => Promise.resolve(successResponse('BTC', 'BRL', 530000)),
      };
    });

    const provider = createProvider(fn as unknown as typeof fetch);
    const results = await provider.fetchRates();

    const btcBrl = results.find((r) => r.pair === 'BTC/BRL')!;
    expect(btcBrl).toBeDefined();
    expect(btcBrl.rate).toBe(530000);
    expect(btcBrl.rate).toBeGreaterThan(0);
    expect(btcBrl.source).toBe('exchangerate-api');
  });
});

// ----- T3.3.3: API error → last cached rate unchanged -----

describe('T3.3.3 — API error with cached fallback', () => {
  it('returns stale cache when API fails', async () => {
    let callCount = 0;
    const fn = vi.fn().mockImplementation(async (url: string) => {
      callCount++;
      if (callCount <= 2) {
        // First fetchRates() call succeeds for both pairs
        if (url.includes('/pair/USD/BRL')) {
          return {
            ok: true,
            status: 200,
            json: () => Promise.resolve(successResponse('USD', 'BRL', 5.85)),
          };
        }
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve(successResponse('BTC', 'BRL', 530000)),
        };
      }
      // Second fetchRates() call fails
      return {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ result: 'error' }),
      };
    });

    // Use a TTL of 0 so cache always expires, forcing re-fetch
    const provider = createProvider(fn as unknown as typeof fetch, { cacheTtlMs: 0 });

    // First call — populates cache
    const first = await provider.fetchRates();
    expect(first).toHaveLength(2);

    // Second call — API fails, should return stale cached rates
    const second = await provider.fetchRates();
    expect(second).toHaveLength(2);

    const usdBrl = second.find((r) => r.pair === 'USD/BRL')!;
    expect(usdBrl.rate).toBe(5.85); // stale cache preserved
  });

  it('returns empty when API fails and no cache exists', async () => {
    const fn = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({ result: 'error' }),
    });

    const provider = createProvider(fn as unknown as typeof fetch);
    const results = await provider.fetchRates();

    // No cache, no results for failed pairs
    expect(results).toHaveLength(0);
  });
});

// ----- T3.3.4: Cache prevents API calls within TTL -----

describe('T3.3.4 — Cache TTL enforcement', () => {
  it('does not call API when cache is fresh', async () => {
    let currentTime = 1000000;
    const fn = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/pair/USD/BRL')) {
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve(successResponse('USD', 'BRL', 5.85)),
        };
      }
      return {
        ok: true,
        status: 200,
        json: () => Promise.resolve(successResponse('BTC', 'BRL', 530000)),
      };
    });

    const provider = createProvider(fn as unknown as typeof fetch, {
      cacheTtlMs: 15 * 60 * 1000, // 15 minutes
      nowFn: () => currentTime,
    });

    // First call — 2 API requests (USD/BRL + BTC/BRL)
    await provider.fetchRates();
    expect(fn).toHaveBeenCalledTimes(2);

    // Second call within TTL — 0 additional requests
    currentTime += 5 * 60 * 1000; // +5 minutes
    const results = await provider.fetchRates();
    expect(fn).toHaveBeenCalledTimes(2); // no new calls
    expect(results).toHaveLength(2);

    const usdBrl = results.find((r) => r.pair === 'USD/BRL')!;
    expect(usdBrl.rate).toBe(5.85);
  });

  it('calls API again after cache expires', async () => {
    let currentTime = 1000000;
    const fn = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/pair/USD/BRL')) {
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve(successResponse('USD', 'BRL', 5.85)),
        };
      }
      return {
        ok: true,
        status: 200,
        json: () => Promise.resolve(successResponse('BTC', 'BRL', 530000)),
      };
    });

    const provider = createProvider(fn as unknown as typeof fetch, {
      cacheTtlMs: 15 * 60 * 1000,
      nowFn: () => currentTime,
    });

    // First call
    await provider.fetchRates();
    expect(fn).toHaveBeenCalledTimes(2);

    // Advance past TTL
    currentTime += 16 * 60 * 1000; // +16 minutes
    await provider.fetchRates();
    expect(fn).toHaveBeenCalledTimes(4); // 2 new calls
  });
});

// ----- Result shape validation -----

describe('ExchangeRateResult shape', () => {
  it('includes pair, rate, source, and fetched_at', async () => {
    const fn = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/pair/USD/BRL')) {
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve(successResponse('USD', 'BRL', 5.85)),
        };
      }
      return {
        ok: true,
        status: 200,
        json: () => Promise.resolve(successResponse('BTC', 'BRL', 530000)),
      };
    });

    const provider = createProvider(fn as unknown as typeof fetch);
    const results = await provider.fetchRates();

    for (const result of results) {
      expect(result).toEqual({
        pair: expect.stringMatching(/^[A-Z]+\/BRL$/),
        rate: expect.any(Number),
        source: 'exchangerate-api',
        fetched_at: expect.any(String),
      });

      // Verify fetched_at is valid ISO 8601
      expect(() => new Date(result.fetched_at)).not.toThrow();
      expect(new Date(result.fetched_at).toISOString()).toBe(result.fetched_at);
    }
  });
});

// ----- API error types -----

describe('API error handling', () => {
  it('handles API-level error response (result !== success)', async () => {
    const fn = mockFetch({
      result: 'error',
      'error-type': 'invalid-key',
    });

    const provider = createProvider(fn);
    const results = await provider.fetchRates();
    expect(results).toHaveLength(0);
  });

  it('handles missing conversion_rate in response', async () => {
    const fn = mockFetch({
      result: 'success',
      base_code: 'USD',
      target_code: 'BRL',
      // conversion_rate missing
    });

    const provider = createProvider(fn);
    const results = await provider.fetchRates();
    expect(results).toHaveLength(0);
  });

  it('handles network failure', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Network error'));
    const provider = createProvider(fn as unknown as typeof fetch);

    const results = await provider.fetchRates();
    expect(results).toHaveLength(0);
  });

  it('constructs correct URL with API key', async () => {
    const fn = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      json: () => Promise.resolve(successResponse('USD', 'BRL', 5.85)),
    }));

    const provider = createProvider(fn as unknown as typeof fetch);
    await provider.fetchRates();

    const firstUrl = fn.mock.calls[0][0] as string;
    expect(firstUrl).toContain('/test-key/pair/USD/BRL');
  });
});

// ----- Provider identity -----

describe('Provider identity', () => {
  it('has name set to "exchangerate-api"', () => {
    const fn = mockFetch(successResponse('USD', 'BRL', 5.85));
    const provider = createProvider(fn);
    expect(provider.name).toBe('exchangerate-api');
  });
});
