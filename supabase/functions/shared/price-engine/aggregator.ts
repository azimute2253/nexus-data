// ============================================================
// Price Aggregator
// Combines brapi quotes + exchange rate → normalized BRL prices.
// Story 3.2: Uses adapters from Stories 3.1 (brapi) and 3.3 (exchange).
// ============================================================

import type { BrapiProvider } from '../providers/brapi-provider.ts';
import type { ExchangeRateProvider } from '../providers/exchange-provider.ts';

/** Input for a single price aggregation request. */
export interface AggregateRequest {
  ticker: string;
  currency: 'BRL' | 'USD';
}

/** Result from price aggregation with BRL normalization. */
export interface AggregatedPrice {
  ticker: string;
  price_brl: number;
  original_price: number;
  currency: 'BRL' | 'USD';
  timestamp: string; // ISO 8601
}

export interface PriceAggregatorOptions {
  brapiProvider: BrapiProvider;
  exchangeProvider: ExchangeRateProvider;
}

/**
 * Aggregates a single ticker's price into BRL.
 * - BRL tickers: fetched directly via brapi, no conversion.
 * - USD tickers: fetched via brapi, then converted using exchange rate.
 */
export async function aggregatePrice(
  request: AggregateRequest,
  options: PriceAggregatorOptions,
): Promise<AggregatedPrice> {
  const { brapiProvider, exchangeProvider } = options;

  const results = await brapiProvider.fetchPrices([request.ticker]);
  if (results.length === 0) {
    throw new Error(`No price returned for ticker: ${request.ticker}`);
  }

  const priceResult = results[0];

  if (request.currency === 'BRL') {
    return {
      ticker: priceResult.ticker,
      price_brl: priceResult.price,
      original_price: priceResult.price,
      currency: 'BRL',
      timestamp: priceResult.fetched_at,
    };
  }

  // USD → BRL conversion
  const rates = await exchangeProvider.fetchRates();
  const usdBrl = rates.find((r) => r.pair === 'USD/BRL');
  if (!usdBrl) {
    throw new Error('USD/BRL exchange rate not available');
  }

  return {
    ticker: priceResult.ticker,
    price_brl: priceResult.price * usdBrl.rate,
    original_price: priceResult.price,
    currency: 'USD',
    timestamp: priceResult.fetched_at,
  };
}

/**
 * Batch version: aggregates prices for multiple tickers.
 * Groups by currency to minimize exchange rate fetches.
 */
export async function aggregatePrices(
  requests: AggregateRequest[],
  options: PriceAggregatorOptions,
): Promise<AggregatedPrice[]> {
  if (requests.length === 0) return [];

  const { brapiProvider, exchangeProvider } = options;

  const allTickers = requests.map((r) => r.ticker);
  const currencyMap = new Map(requests.map((r) => [r.ticker, r.currency]));

  // Fetch all prices in one batch call
  const priceResults = await brapiProvider.fetchPrices(allTickers);

  // Only fetch exchange rate if any USD ticker exists
  const hasUsd = requests.some((r) => r.currency === 'USD');
  let usdBrlRate: number | null = null;

  if (hasUsd) {
    const rates = await exchangeProvider.fetchRates();
    const usdBrl = rates.find((r) => r.pair === 'USD/BRL');
    if (!usdBrl) {
      throw new Error('USD/BRL exchange rate not available');
    }
    usdBrlRate = usdBrl.rate;
  }

  const aggregated: AggregatedPrice[] = [];

  for (const result of priceResults) {
    const currency = currencyMap.get(result.ticker);
    if (!currency) continue;

    if (currency === 'BRL') {
      aggregated.push({
        ticker: result.ticker,
        price_brl: result.price,
        original_price: result.price,
        currency: 'BRL',
        timestamp: result.fetched_at,
      });
    } else {
      aggregated.push({
        ticker: result.ticker,
        price_brl: result.price * usdBrlRate!,
        original_price: result.price,
        currency: 'USD',
        timestamp: result.fetched_at,
      });
    }
  }

  return aggregated;
}
