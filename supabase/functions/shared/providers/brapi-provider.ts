// ============================================================
// brapi.dev Price Provider
// Fetches B3 stock and FII quotes in batches of 20.
// ADR-003: brapi handles ~111 B3 tickers via batch requests.
// ============================================================

import type { PriceProvider, PriceResult, PriceFetchError } from '../types.ts';
import { logPriceFetch, logTickerError } from './price-fetch-logger.ts';
import type { PriceFetchLogEntry } from './price-fetch-logger.ts';

const BRAPI_BASE_URL = 'https://brapi.dev/api';
const BATCH_SIZE = 20;

export interface BrapiQuoteResponse {
  results?: BrapiQuoteResult[];
  error?: boolean;
  message?: string;
}

export interface BrapiQuoteResult {
  symbol: string;
  regularMarketPrice: number;
  currency: string;
  regularMarketTime?: string;
  [key: string]: unknown;
}

export interface BrapiProviderOptions {
  apiKey: string;
  batchSize?: number;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

export class BrapiProvider implements PriceProvider {
  readonly name = 'brapi';
  private readonly apiKey: string;
  private readonly batchSize: number;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: BrapiProviderOptions) {
    this.apiKey = options.apiKey;
    this.batchSize = options.batchSize ?? BATCH_SIZE;
    this.baseUrl = options.baseUrl ?? BRAPI_BASE_URL;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  /**
   * Fetches prices for an array of tickers in batches of 20.
   * Returns successful results; errors are logged and skipped.
   */
  async fetchPrices(tickers: string[]): Promise<PriceResult[]> {
    if (tickers.length === 0) return [];

    const batches = this.chunk(tickers, this.batchSize);
    const results: PriceResult[] = [];
    const errors: PriceFetchError[] = [];

    for (const batch of batches) {
      const start = Date.now();
      try {
        const batchResults = await this.fetchBatch(batch);
        const elapsed = Date.now() - start;

        // Map successful results
        for (const result of batchResults) {
          results.push(this.mapResult(result));
        }

        // Detect tickers that were requested but not returned
        const returnedTickers = new Set(batchResults.map(r => r.symbol));
        for (const ticker of batch) {
          if (!returnedTickers.has(ticker)) {
            const error: PriceFetchError = {
              ticker,
              provider: this.name,
              status: null,
              error_message: `Ticker not found in brapi response`,
              created_at: new Date().toISOString(),
            };
            errors.push(error);
            logTickerError(error);
          }
        }

        const status = errors.length > 0 ? 'partial' as const : 'success' as const;
        logPriceFetch({
          provider: this.name,
          tickers: batch,
          status,
          response_time_ms: elapsed,
          error_message: null,
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        const elapsed = Date.now() - start;
        const message = err instanceof Error ? err.message : String(err);

        for (const ticker of batch) {
          errors.push({
            ticker,
            provider: this.name,
            status: null,
            error_message: message,
            created_at: new Date().toISOString(),
          });
        }

        logPriceFetch({
          provider: this.name,
          tickers: batch,
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
   * Fetches a single batch of tickers from brapi.dev.
   * Endpoint: GET /api/quote/TICKER1,TICKER2,...?token=KEY
   */
  private async fetchBatch(tickers: string[]): Promise<BrapiQuoteResult[]> {
    const tickerParam = tickers.join(',');
    const url = `${this.baseUrl}/quote/${tickerParam}?token=${this.apiKey}`;

    const response = await this.fetchFn(url);

    if (response.status === 429) {
      throw new Error('brapi rate limit exceeded (HTTP 429)');
    }

    if (!response.ok) {
      throw new Error(`brapi HTTP ${response.status}: ${response.statusText}`);
    }

    const data: BrapiQuoteResponse = await response.json();

    if (data.error) {
      throw new Error(`brapi API error: ${data.message ?? 'unknown'}`);
    }

    return data.results ?? [];
  }

  /** Maps a brapi quote result to our PriceResult format. */
  private mapResult(result: BrapiQuoteResult): PriceResult {
    return {
      ticker: result.symbol,
      price: result.regularMarketPrice,
      currency: result.currency ?? 'BRL',
      source: this.name,
      fetched_at: new Date().toISOString(),
    };
  }

  /** Splits an array into chunks of the given size. */
  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
