// ============================================================
// Price Engine — Facade
// Ties together brapi provider, exchange rate provider, and aggregator.
// Story 3.4: getPrices() with in-memory caching and request dedup.
// ============================================================

import { BrapiProvider } from '../providers/brapi-provider.ts';
import { ExchangeRateProvider } from '../providers/exchange-provider.ts';
import {
  aggregatePrices,
  type AggregateRequest,
  type AggregatedPrice,
} from './aggregator.ts';

/** Normalized price result returned by the engine. */
export interface PriceEngineResult {
  ticker: string;
  price_brl: number;
  currency: 'BRL' | 'USD';
  timestamp: string; // ISO 8601
}

interface CachedEntry {
  result: PriceEngineResult;
  cachedAt: number;
}

export interface PriceEngineOptions {
  brapiApiKey: string;
  exchangeApiKey: string;
  /** Cache TTL in milliseconds. Default: 5 minutes. */
  cacheTtlMs?: number;
  /** Injected for testing. */
  brapiProvider?: BrapiProvider;
  /** Injected for testing. */
  exchangeProvider?: ExchangeRateProvider;
  /** Injected for testing. */
  nowFn?: () => number;
}

/**
 * Price Engine facade.
 * - Uses the aggregator (Story 3.2) to fetch and normalize prices.
 * - Deduplicates identical ticker requests within a single call.
 * - In-memory cache with configurable TTL.
 */
export class PriceEngine {
  private readonly brapiProvider: BrapiProvider;
  private readonly exchangeProvider: ExchangeRateProvider;
  private readonly cacheTtlMs: number;
  private readonly nowFn: () => number;
  private readonly cache = new Map<string, CachedEntry>();

  constructor(options: PriceEngineOptions) {
    this.brapiProvider =
      options.brapiProvider ??
      new BrapiProvider({ apiKey: options.brapiApiKey });
    this.exchangeProvider =
      options.exchangeProvider ??
      new ExchangeRateProvider({ apiKey: options.exchangeApiKey });
    this.cacheTtlMs = options.cacheTtlMs ?? 5 * 60 * 1000;
    this.nowFn = options.nowFn ?? Date.now;
  }

  /**
   * Fetches prices for a list of ticker requests.
   * - Returns cached results when within TTL.
   * - Deduplicates requests (same ticker+currency only fetched once).
   * - Uncached tickers are fetched via aggregator in a single batch.
   */
  async getPrices(
    requests: AggregateRequest[],
  ): Promise<PriceEngineResult[]> {
    if (requests.length === 0) return [];

    const now = this.nowFn();
    const results: PriceEngineResult[] = [];
    const toFetch: AggregateRequest[] = [];
    const seen = new Set<string>();

    // 1. Check cache and deduplicate
    for (const req of requests) {
      const key = cacheKey(req);
      if (seen.has(key)) continue;
      seen.add(key);

      const cached = this.cache.get(key);
      if (cached && now - cached.cachedAt < this.cacheTtlMs) {
        results.push(cached.result);
      } else {
        toFetch.push(req);
      }
    }

    // 2. Fetch uncached tickers via aggregator
    if (toFetch.length > 0) {
      const aggregated = await aggregatePrices(toFetch, {
        brapiProvider: this.brapiProvider,
        exchangeProvider: this.exchangeProvider,
      });

      for (const agg of aggregated) {
        const result = toEngineResult(agg);
        const key = cacheKey({ ticker: agg.ticker, currency: agg.currency });
        this.cache.set(key, { result, cachedAt: now });
        results.push(result);
      }
    }

    return results;
  }

  /** Clears the in-memory price cache. */
  clearCache(): void {
    this.cache.clear();
  }

  /** Returns the number of cached entries. */
  get cacheSize(): number {
    return this.cache.size;
  }
}

function cacheKey(req: AggregateRequest): string {
  return `${req.ticker}:${req.currency}`;
}

function toEngineResult(agg: AggregatedPrice): PriceEngineResult {
  return {
    ticker: agg.ticker,
    price_brl: agg.price_brl,
    currency: agg.currency,
    timestamp: agg.timestamp,
  };
}
