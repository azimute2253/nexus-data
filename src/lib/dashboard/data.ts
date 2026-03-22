// ============================================================
// Nexus Data — Dashboard Data Layer
// Server-side data fetching for Astro frontmatter → React props.
// Queries portfolio_summary view, price_cache, exchange_rates,
// and pipes data through the L1→L2→L3 rebalancing algorithm.
// [Story 5.1, ADR-005, ADR-006]
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PortfolioSummaryRow,
  PriceCache,
  ExchangeRate,
  Asset,
  AssetType,
  AssetGroup,
  AssetScore,
  L1TypeInput,
  L2GroupInput,
  L3AssetInput,
  RebalanceResult,
} from '../nexus/types.js';
import { rebalance } from '../nexus/rebalance.js';
import type {
  PortfolioSummary,
  PortfolioSummaryItem,
  AssetPricesResult,
  AssetPriceEntry,
  PerformanceMetrics,
  TypePerformance,
  DashboardData,
  DataResult,
  DataError,
} from './types.js';

// ---------- Staleness threshold (ADR-005 Obligation 3) ----------

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------- Helpers ----------

function makeError(
  code: DataError['code'],
  message: string,
  details?: unknown,
): DataError {
  return { code, message, details };
}

function isStale(fetchedAt: string, now: Date): boolean {
  return now.getTime() - new Date(fetchedAt).getTime() > STALE_THRESHOLD_MS;
}

// ---------- getPortfolioSummary ----------

/**
 * Fetches the portfolio_summary view and exchange rate,
 * returning aggregated values per asset type with BRL totals.
 * The view already handles currency conversion via SQL JOINs.
 */
export async function getPortfolioSummary(
  client: SupabaseClient,
): Promise<DataResult<PortfolioSummary>> {
  // Fetch portfolio summary view and USD/BRL rate in parallel
  const [summaryRes, rateRes] = await Promise.all([
    client
      .from('portfolio_summary')
      .select('*'),
    client
      .from('exchange_rates')
      .select('*')
      .eq('pair', 'USD/BRL')
      .maybeSingle(),
  ]);

  if (summaryRes.error) {
    return {
      data: null,
      error: makeError('DB_ERROR', 'Failed to fetch portfolio summary', summaryRes.error),
    };
  }

  if (rateRes.error) {
    return {
      data: null,
      error: makeError('EXCHANGE_RATE_ERROR', 'Failed to fetch exchange rate', rateRes.error),
    };
  }

  const rows = summaryRes.data as PortfolioSummaryRow[];
  const exchangeRate = rateRes.data as ExchangeRate | null;

  const items: PortfolioSummaryItem[] = rows.map((row) => ({
    asset_type_id: row.asset_type_id,
    asset_type_name: row.asset_type_name,
    target_pct: row.target_pct ?? 0,
    total_value_brl: row.total_value,
    asset_count: row.asset_count,
  }));

  const totalValue = items.reduce((sum, item) => sum + item.total_value_brl, 0);

  return {
    data: {
      items,
      total_value_brl: totalValue,
      exchange_rate_usd_brl: exchangeRate?.rate ?? null,
      fetched_at: new Date().toISOString(),
    },
    error: null,
  };
}

// ---------- getAssetPrices ----------

/**
 * Fetches all cached prices from price_cache, enriching each entry
 * with staleness info (ADR-005 Obligation 3: 24h threshold).
 */
export async function getAssetPrices(
  client: SupabaseClient,
  now: Date = new Date(),
): Promise<DataResult<AssetPricesResult>> {
  const { data, error } = await client
    .from('price_cache')
    .select('*');

  if (error) {
    return {
      data: null,
      error: makeError('PRICE_ERROR', 'Failed to fetch asset prices', error),
    };
  }

  const rows = data as PriceCache[];

  const prices: AssetPriceEntry[] = rows.map((row) => ({
    ticker: row.ticker,
    price: row.price,
    currency: row.currency,
    source: row.source,
    fetched_at: row.fetched_at,
    is_stale: isStale(row.fetched_at, now),
  }));

  const staleCount = prices.filter((p) => p.is_stale).length;
  const missingCount = prices.filter((p) => p.price === null).length;

  return {
    data: { prices, stale_count: staleCount, missing_count: missingCount },
    error: null,
  };
}

// ---------- getRebalanceRecommendations ----------

/**
 * Fetches all data needed for rebalancing and runs the L1→L2→L3 algorithm.
 * Requires: asset_types, asset_groups, assets, asset_scores, price_cache,
 * and exchange_rates to build the PortfolioInput.
 */
export async function getRebalanceRecommendations(
  client: SupabaseClient,
  contribution: number,
): Promise<DataResult<RebalanceResult>> {
  if (contribution < 0) {
    return {
      data: null,
      error: makeError('REBALANCE_ERROR', 'Contribution must not be negative'),
    };
  }

  // Fetch all required data in parallel
  const [typesRes, groupsRes, assetsRes, scoresRes, pricesRes, ratesRes] = await Promise.all([
    client.from('asset_types').select('*').order('sort_order', { ascending: true }),
    client.from('asset_groups').select('*'),
    client.from('assets').select('*').eq('is_active', true),
    client.from('asset_scores').select('*'),
    client.from('price_cache').select('*'),
    client.from('exchange_rates').select('*'),
  ]);

  // Check for any DB errors
  const dbError = [typesRes, groupsRes, assetsRes, scoresRes, pricesRes, ratesRes]
    .find((r) => r.error);
  if (dbError?.error) {
    return {
      data: null,
      error: makeError('DB_ERROR', 'Failed to fetch rebalancing data', dbError.error),
    };
  }

  const types = typesRes.data as AssetType[];
  const groups = groupsRes.data as AssetGroup[];
  const assets = assetsRes.data as Asset[];
  const scores = scoresRes.data as AssetScore[];
  const prices = pricesRes.data as PriceCache[];
  const rates = ratesRes.data as ExchangeRate[];

  // Build price map: ticker → price in BRL
  const priceMap = new Map<string, number>();
  const rateMap = new Map<string, number>();
  for (const r of rates) {
    if (r.rate !== null) rateMap.set(r.pair, r.rate);
  }
  for (const p of prices) {
    if (p.price === null) continue;
    if (p.currency === 'BRL') {
      priceMap.set(p.ticker, p.price);
    } else {
      const ratePair = `${p.currency}/BRL`;
      const rate = rateMap.get(ratePair);
      if (rate) {
        priceMap.set(p.ticker, p.price * rate);
      }
    }
  }

  // Build score map: asset_id → total_score
  const scoreMap = new Map<string, number>();
  for (const s of scores) {
    scoreMap.set(s.asset_id, s.total_score);
  }

  // Build L1 inputs: each type with its current total value in BRL
  const assetsByGroup = new Map<string, Asset[]>();
  for (const a of assets) {
    const list = assetsByGroup.get(a.group_id) ?? [];
    list.push(a);
    assetsByGroup.set(a.group_id, list);
  }

  const groupsByType = new Map<string, AssetGroup[]>();
  for (const g of groups) {
    const list = groupsByType.get(g.type_id) ?? [];
    list.push(g);
    groupsByType.set(g.type_id, list);
  }

  const l1Inputs: L1TypeInput[] = types
    .filter((t) => t.target_pct !== null && t.target_pct > 0)
    .map((t) => {
      // Sum current value of all assets under this type
      const typeGroups = groupsByType.get(t.id) ?? [];
      let typeValue = 0;
      for (const g of typeGroups) {
        const groupAssets = assetsByGroup.get(g.id) ?? [];
        for (const a of groupAssets) {
          const priceBrl = priceMap.get(a.ticker) ?? 0;
          typeValue += a.quantity * priceBrl;
        }
      }

      return {
        type_id: t.id,
        name: t.name,
        target_pct: t.target_pct! / 100, // DB stores as %, algorithm expects decimal
        actual_value_brl: typeValue,
      };
    });

  // Build L2 inputs
  const l2Inputs: L2GroupInput[] = groups
    .filter((g) => g.target_pct !== null)
    .map((g) => ({
      group_id: g.id,
      name: g.name ?? '',
      type_id: g.type_id,
      target_pct: g.target_pct! / 100,
    }));

  // Build L3 inputs
  const l3Inputs: L3AssetInput[] = assets.map((a) => ({
    asset_id: a.id,
    ticker: a.ticker,
    group_id: a.group_id,
    score: scoreMap.get(a.id) ?? 0,
    price_brl: priceMap.get(a.ticker) ?? 0,
    is_active: a.is_active,
    manual_override: a.manual_override,
    whole_shares: a.whole_shares,
  }));

  if (l1Inputs.length === 0) {
    return {
      data: null,
      error: makeError('REBALANCE_ERROR', 'No asset types with target allocations found'),
    };
  }

  if (l2Inputs.length === 0) {
    return {
      data: null,
      error: makeError('REBALANCE_ERROR', 'No asset groups with target allocations found'),
    };
  }

  try {
    const result = rebalance(
      { types: l1Inputs, groups: l2Inputs, assets: l3Inputs },
      contribution,
    );
    return { data: result, error: null };
  } catch (err) {
    return {
      data: null,
      error: makeError(
        'REBALANCE_ERROR',
        err instanceof Error ? err.message : 'Rebalance calculation failed',
        err,
      ),
    };
  }
}

// ---------- getPerformanceMetrics ----------

/**
 * Calculates deviation of actual allocation vs target for each asset type.
 * Uses the portfolio_summary view which already includes current values.
 */
export async function getPerformanceMetrics(
  client: SupabaseClient,
): Promise<DataResult<PerformanceMetrics>> {
  const { data, error } = await client
    .from('portfolio_summary')
    .select('*');

  if (error) {
    return {
      data: null,
      error: makeError('DB_ERROR', 'Failed to fetch performance data', error),
    };
  }

  const rows = data as PortfolioSummaryRow[];
  const totalValue = rows.reduce((sum, r) => sum + r.total_value, 0);

  const types: TypePerformance[] = rows.map((row) => {
    const targetPct = row.target_pct ?? 0;
    const actualPct = totalValue > 0 ? (row.total_value / totalValue) * 100 : 0;

    return {
      asset_type_id: row.asset_type_id,
      asset_type_name: row.asset_type_name,
      target_pct: targetPct,
      actual_pct: Math.round(actualPct * 100) / 100,
      deviation_pct: Math.round((actualPct - targetPct) * 100) / 100,
      total_value_brl: row.total_value,
    };
  });

  // Find the type with the largest absolute deviation
  let maxDevType = '';
  let maxDev = 0;
  for (const t of types) {
    if (Math.abs(t.deviation_pct) > maxDev) {
      maxDev = Math.abs(t.deviation_pct);
      maxDevType = t.asset_type_name;
    }
  }

  return {
    data: {
      total_value_brl: totalValue,
      types,
      max_deviation_type: maxDevType,
    },
    error: null,
  };
}

// ---------- getDashboardData (orchestrator) ----------

/**
 * Fetches all dashboard data in parallel. Individual failures are
 * returned as null with an error in the result, so the UI can
 * degrade gracefully per section.
 */
export async function getDashboardData(
  client: SupabaseClient,
  contribution: number = 0,
): Promise<{
  portfolio: DataResult<PortfolioSummary>;
  prices: DataResult<AssetPricesResult>;
  performance: DataResult<PerformanceMetrics>;
  rebalance: DataResult<RebalanceResult>;
}> {
  const [portfolio, prices, performance, rebalanceResult] = await Promise.all([
    getPortfolioSummary(client),
    getAssetPrices(client),
    getPerformanceMetrics(client),
    getRebalanceRecommendations(client, contribution),
  ]);

  return { portfolio, prices, performance, rebalance: rebalanceResult };
}
