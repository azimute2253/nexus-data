import type { SupabaseClient } from '@supabase/supabase-js';
import type { RebalanceResult } from '../nexus/types.js';
import type { PortfolioSummary, AssetPricesResult, PerformanceMetrics, DataResult } from './types.js';
/**
 * Fetches the portfolio_summary view and exchange rate,
 * returning aggregated values per asset type with BRL totals.
 * The view already handles currency conversion via SQL JOINs.
 */
export declare function getPortfolioSummary(client: SupabaseClient): Promise<DataResult<PortfolioSummary>>;
/**
 * Fetches all cached prices from price_cache, enriching each entry
 * with staleness info (ADR-005 Obligation 3: 24h threshold).
 */
export declare function getAssetPrices(client: SupabaseClient, now?: Date): Promise<DataResult<AssetPricesResult>>;
/**
 * Fetches all data needed for rebalancing and runs the L1→L2→L3 algorithm.
 * Requires: asset_types, asset_groups, assets, asset_scores, price_cache,
 * and exchange_rates to build the PortfolioInput.
 */
export declare function getRebalanceRecommendations(client: SupabaseClient, contribution: number): Promise<DataResult<RebalanceResult>>;
/**
 * Calculates deviation of actual allocation vs target for each asset type.
 * Uses the portfolio_summary view which already includes current values.
 */
export declare function getPerformanceMetrics(client: SupabaseClient): Promise<DataResult<PerformanceMetrics>>;
/**
 * Fetches all dashboard data in parallel. Individual failures are
 * returned as null with an error in the result, so the UI can
 * degrade gracefully per section.
 */
export declare function getDashboardData(client: SupabaseClient, contribution?: number): Promise<{
    portfolio: DataResult<PortfolioSummary>;
    prices: DataResult<AssetPricesResult>;
    performance: DataResult<PerformanceMetrics>;
    rebalance: DataResult<RebalanceResult>;
}>;
//# sourceMappingURL=data.d.ts.map