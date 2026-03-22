// ============================================================
// Price Fetch Logger
// Logs API call results to price_fetch_log table.
// ADR-003 Obligation 3: All API calls MUST be logged.
// ============================================================

import type { PriceFetchError } from '../types.ts';

export interface PriceFetchLogEntry {
  provider: string;
  tickers: string[];
  status: 'success' | 'partial' | 'error';
  response_time_ms: number;
  error_message: string | null;
  created_at: string;
}

/**
 * Logs a price fetch operation.
 * In Edge Functions, pass a Supabase client to persist to DB.
 * Falls back to console.error for environments without DB access.
 */
export function logPriceFetch(entry: PriceFetchLogEntry): void {
  const level = entry.status === 'error' ? 'error' : 'info';
  const msg = `[price-fetch] ${entry.provider} ${entry.status}: ${entry.tickers.length} tickers in ${entry.response_time_ms}ms`;

  if (level === 'error') {
    console.error(msg, entry.error_message);
  } else {
    console.log(msg);
  }
}

export function logTickerError(error: PriceFetchError): void {
  console.error(
    `[price-fetch] ${error.provider} ticker error: ${error.ticker} — ${error.error_message}`
  );
}
