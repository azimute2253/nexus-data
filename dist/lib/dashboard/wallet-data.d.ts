import type { SupabaseClient } from '@supabase/supabase-js';
import type { PortfolioSummary, PerformanceMetrics, DataResult } from './types.js';
import type { AssetType, AssetGroup, Asset, PriceCache, ExchangeRate, RebalanceResult } from '../nexus/types.js';
/** Build ticker → BRL price map using exchange rates for conversion */
export declare function buildPriceMapBrl(prices: PriceCache[], rates: ExchangeRate[]): Map<string, number>;
/** Compute total BRL value per asset type from raw tables */
export declare function computeTypeValues(types: AssetType[], groups: AssetGroup[], assets: Asset[], priceMap: Map<string, number>): Map<string, number>;
/**
 * Fetches portfolio summary scoped to a wallet.
 * Queries raw tables with wallet_id filter instead of the view.
 */
export declare function getWalletPortfolioSummary(client: SupabaseClient, walletId: string): Promise<DataResult<PortfolioSummary>>;
/**
 * Calculates per-type performance metrics scoped to a wallet.
 */
export declare function getWalletPerformanceMetrics(client: SupabaseClient, walletId: string): Promise<DataResult<PerformanceMetrics>>;
/**
 * Fetches all wallet-scoped dashboard data.
 * Returns portfolio summary and performance metrics.
 */
export declare function getWalletDashboardData(client: SupabaseClient, walletId: string): Promise<{
    portfolio: DataResult<PortfolioSummary>;
    performance: DataResult<PerformanceMetrics>;
}>;
/**
 * Fetches all data needed for rebalancing, scoped to a wallet.
 * Runs the L1→L2→L3 algorithm with wallet-filtered data.
 */
export declare function getWalletRebalanceRecommendations(client: SupabaseClient, walletId: string, contribution: number): Promise<DataResult<RebalanceResult>>;
//# sourceMappingURL=wallet-data.d.ts.map