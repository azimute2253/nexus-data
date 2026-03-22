// ============================================================
// Nexus Data — Price Provider Types
// Shared interfaces for multi-provider price fetching strategy.
// See ADR-003 for architecture decisions.
// ============================================================

/** Result from a single price fetch operation. */
export interface PriceResult {
  ticker: string;
  price: number;
  currency: string;
  source: string;
  fetched_at: string; // ISO 8601 timestamp
}

/** Standardized error info for failed ticker fetches. */
export interface PriceFetchError {
  ticker: string;
  provider: string;
  status: number | null;
  error_message: string;
  created_at: string; // ISO 8601 timestamp
}

/**
 * Common interface for all price providers.
 * ADR-003 Obligation 1: Each API provider MUST be behind this interface.
 */
export interface PriceProvider {
  readonly name: string;
  fetchPrices(tickers: string[]): Promise<PriceResult[]>;
}
