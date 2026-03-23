// ============================================================
// Exchange Rate Provider — exchangerate-api.com
// Fetches USD/BRL and BTC/BRL rates with 15-minute cache TTL.
// ADR-003: exchangerate-api.com for FX rates.
// ADR-005: 1,500 req/month budget → minimum 15-min between requests.
// API endpoint: https://v6.exchangerate-api.com/v6/{KEY}/pair/USD/BRL
// ============================================================

import { logPriceFetch, logTickerError } from './price-fetch-logger.ts';
import type { PriceFetchError } from '../types.ts';

const EXCHANGERATE_BASE_URL = 'https://v6.exchangerate-api.com/v6';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/** Result from a single exchange rate fetch. */
export interface ExchangeRateResult {
  pair: string;        // e.g. 'USD/BRL'
  rate: number;
  source: 'exchangerate-api';
  fetched_at: string;  // ISO 8601
}

/** Shape of the exchangerate-api.com pair endpoint response. */
export interface ExchangeRateApiResponse {
  result: 'success' | 'error';
  base_code?: string;
  target_code?: string;
  conversion_rate?: number;
  time_last_update_utc?: string;
  'error-type'?: string;
}

export interface ExchangeProviderOptions {
  apiKey: string;
  baseUrl?: string;
  cacheTtlMs?: number;
  fetchFn?: typeof fetch;
  nowFn?: () => number;
}

interface CachedRate {
  result: ExchangeRateResult;
  cachedAt: number;
}

/**
 * Exchange rate provider with in-memory cache.
 * Respects 1,500 req/month budget via 15-minute minimum intervals.
 */
export class ExchangeRateProvider {
  readonly name = 'exchangerate-api';
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly cacheTtlMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly nowFn: () => number;
  private readonly cache = new Map<string, CachedRate>();

  constructor(options: ExchangeProviderOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? EXCHANGERATE_BASE_URL;
    this.cacheTtlMs = options.cacheTtlMs ?? CACHE_TTL_MS;
    this.fetchFn = options.fetchFn ?? fetch;
    this.nowFn = options.nowFn ?? Date.now;
  }

  /**
   * Fetches USD/BRL and BTC/BRL exchange rates.
   * Returns cached rates if within TTL window.
   */
  async fetchRates(): Promise<ExchangeRateResult[]> {
    const pairs: Array<{ from: string; to: string }> = [
      { from: 'USD', to: 'BRL' },
      { from: 'BTC', to: 'BRL' },
    ];

    const results: ExchangeRateResult[] = [];

    for (const { from, to } of pairs) {
      const pairKey = `${from}/${to}`;

      // Check cache
      const cached = this.cache.get(pairKey);
      if (cached && this.nowFn() - cached.cachedAt < this.cacheTtlMs) {
        results.push(cached.result);
        continue;
      }

      // Fetch fresh rate
      const start = Date.now();
      try {
        const result = await this.fetchPair(from, to);
        const elapsed = Date.now() - start;

        this.cache.set(pairKey, { result, cachedAt: this.nowFn() });
        results.push(result);

        logPriceFetch({
          provider: this.name,
          tickers: [pairKey],
          status: 'success',
          response_time_ms: elapsed,
          error_message: null,
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        const elapsed = Date.now() - start;
        const message = err instanceof Error ? err.message : String(err);

        // If we have a stale cached value, return it on error
        if (cached) {
          results.push(cached.result);
        }

        const error: PriceFetchError = {
          ticker: pairKey,
          provider: this.name,
          status: null,
          error_message: message,
          created_at: new Date().toISOString(),
        };
        logTickerError(error);

        logPriceFetch({
          provider: this.name,
          tickers: [pairKey],
          status: 'error',
          response_time_ms: elapsed,
          error_message: message,
          created_at: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  /**
   * Fetches a single currency pair from exchangerate-api.com.
   * Endpoint: GET /v6/{KEY}/pair/{FROM}/{TO}
   */
  private async fetchPair(from: string, to: string): Promise<ExchangeRateResult> {
    const url = `${this.baseUrl}/${this.apiKey}/pair/${from}/${to}`;
    const response = await this.fetchFn(url);

    if (!response.ok) {
      throw new Error(`exchangerate-api HTTP ${response.status}: ${response.statusText}`);
    }

    const data: ExchangeRateApiResponse = await response.json();

    if (data.result !== 'success') {
      throw new Error(`exchangerate-api error: ${data['error-type'] ?? 'unknown'}`);
    }

    if (data.conversion_rate === undefined) {
      throw new Error('exchangerate-api: missing conversion_rate in response');
    }

    return {
      pair: `${from}/${to}`,
      rate: data.conversion_rate,
      source: 'exchangerate-api',
      fetched_at: new Date().toISOString(),
    };
  }
}
