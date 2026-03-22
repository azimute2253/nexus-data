// ============================================================
// Nexus Data — Dashboard Data Layer Types
// TypeScript interfaces for portfolio dashboard data.
// [Story 5.1, ADR-005, ADR-006]
// ============================================================

import type {
  PortfolioSummaryRow,
  PriceCache,
  ExchangeRate,
  RebalanceResult,
} from '../nexus/types.js';

// ---------- Portfolio Summary ----------

/** Enriched portfolio summary row with currency-converted total */
export interface PortfolioSummaryItem {
  asset_type_id: string;
  asset_type_name: string;
  target_pct: number;
  total_value_brl: number;
  asset_count: number;
}

/** Aggregated portfolio overview */
export interface PortfolioSummary {
  items: PortfolioSummaryItem[];
  total_value_brl: number;
  exchange_rate_usd_brl: number | null;
  fetched_at: string;
}

// ---------- Asset Prices ----------

/** A cached price entry with staleness info */
export interface AssetPriceEntry {
  ticker: string;
  price: number | null;
  currency: string;
  source: string | null;
  fetched_at: string;
  is_stale: boolean;
}

/** Batch price result */
export interface AssetPricesResult {
  prices: AssetPriceEntry[];
  stale_count: number;
  missing_count: number;
}

// ---------- Performance Metrics ----------

/** Per-asset-type performance (value vs target) */
export interface TypePerformance {
  asset_type_id: string;
  asset_type_name: string;
  target_pct: number;
  actual_pct: number;
  deviation_pct: number;
  total_value_brl: number;
}

/** Portfolio-level performance metrics */
export interface PerformanceMetrics {
  total_value_brl: number;
  types: TypePerformance[];
  max_deviation_type: string;
}

// ---------- Dashboard Data ----------

/** Complete dashboard data bundle for Astro frontmatter → React props */
export interface DashboardData {
  portfolio: PortfolioSummary;
  prices: AssetPricesResult;
  performance: PerformanceMetrics;
  rebalance: RebalanceResult | null;
}

// ---------- Error handling ----------

/** Standardized data layer error */
export interface DataError {
  code: 'DB_ERROR' | 'PRICE_ERROR' | 'REBALANCE_ERROR' | 'EXCHANGE_RATE_ERROR';
  message: string;
  details?: unknown;
}

/** Result wrapper for error handling */
export type DataResult<T> = { data: T; error: null } | { data: null; error: DataError };
