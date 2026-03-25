// ============================================================
// Nexus Data — Wallet-Scoped Dashboard Data
// Data fetching filtered by wallet_id (ADR-014).
// The portfolio_summary view does not include wallet_id, so
// we query asset_types directly with wallet filter and compute
// performance metrics from the raw tables.
// [Story 15.1, ADR-014, ADR-012]
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PortfolioSummary,
  PortfolioSummaryItem,
  PerformanceMetrics,
  TypePerformance,
  DataResult,
  DataError,
} from './types.js';
import type {
  AssetType,
  AssetGroup,
  Asset,
  AssetScore,
  PriceCache,
  ExchangeRate,
  L1TypeInput,
  L2GroupInput,
  L3AssetInput,
  RebalanceResult,
  WeightMode,
} from '../nexus/types.js';
import { rebalance } from '../nexus/rebalance.js';

// ---------- Helpers ----------

function makeError(
  code: DataError['code'],
  message: string,
  details?: unknown,
): DataError {
  return { code, message, details };
}

// ---------- Price map builder ----------

/** Build ticker → BRL price map using exchange rates for conversion */
export function buildPriceMapBrl(
  prices: PriceCache[],
  rates: ExchangeRate[],
): Map<string, number> {
  const rateMap = new Map<string, number>();
  for (const r of rates) {
    if (r.rate !== null) rateMap.set(r.pair, r.rate);
  }

  const priceMap = new Map<string, number>();
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
  return priceMap;
}

// ---------- Compute type values ----------

/** Compute total BRL value per asset type from raw tables */
export function computeTypeValues(
  types: AssetType[],
  groups: AssetGroup[],
  assets: Asset[],
  priceMap: Map<string, number>,
): Map<string, number> {
  // Group assets by group_id
  const assetsByGroup = new Map<string, Asset[]>();
  for (const a of assets) {
    if (!a.is_active) continue;
    const list = assetsByGroup.get(a.group_id) ?? [];
    list.push(a);
    assetsByGroup.set(a.group_id, list);
  }

  // Group groups by type_id
  const groupsByType = new Map<string, AssetGroup[]>();
  for (const g of groups) {
    const list = groupsByType.get(g.type_id) ?? [];
    list.push(g);
    groupsByType.set(g.type_id, list);
  }

  // Compute total per type
  const typeValues = new Map<string, number>();
  for (const t of types) {
    let typeValue = 0;
    const typeGroups = groupsByType.get(t.id) ?? [];
    for (const g of typeGroups) {
      const groupAssets = assetsByGroup.get(g.id) ?? [];
      for (const a of groupAssets) {
        const priceBrl = priceMap.get(a.ticker) ?? 0;
        typeValue += a.quantity * priceBrl;
      }
    }
    typeValues.set(t.id, typeValue);
  }

  return typeValues;
}

// ---------- getWalletPortfolioSummary ----------

/**
 * Fetches portfolio summary scoped to a wallet.
 * Queries raw tables with wallet_id filter instead of the view.
 */
export async function getWalletPortfolioSummary(
  client: SupabaseClient,
  walletId: string,
): Promise<DataResult<PortfolioSummary>> {
  const [typesRes, groupsRes, assetsRes, pricesRes, ratesRes] = await Promise.all([
    client.from('asset_types').select('*').eq('wallet_id', walletId),
    client.from('asset_groups').select('*').eq('wallet_id', walletId),
    client.from('assets').select('*').eq('wallet_id', walletId).eq('is_active', true),
    client.from('price_cache').select('*'),
    client.from('exchange_rates').select('*'),
  ]);

  const dbError = [typesRes, groupsRes, assetsRes, pricesRes, ratesRes].find((r) => r.error);
  if (dbError?.error) {
    return {
      data: null,
      error: makeError('DB_ERROR', 'Failed to fetch wallet portfolio data', dbError.error),
    };
  }

  const types = typesRes.data as AssetType[];
  const groups = groupsRes.data as AssetGroup[];
  const assets = assetsRes.data as Asset[];
  const prices = pricesRes.data as PriceCache[];
  const rates = ratesRes.data as ExchangeRate[];

  const priceMap = buildPriceMapBrl(prices, rates);
  const typeValues = computeTypeValues(types, groups, assets, priceMap);

  const items: PortfolioSummaryItem[] = types.map((t) => ({
    asset_type_id: t.id,
    asset_type_name: t.name,
    target_pct: t.target_pct ?? 0,
    total_value_brl: typeValues.get(t.id) ?? 0,
    asset_count: assets.filter((a) =>
      groups.some((g) => g.id === a.group_id && g.type_id === t.id),
    ).length,
  }));

  const totalValue = items.reduce((sum, item) => sum + item.total_value_brl, 0);

  const exchangeRate = rates.find((r) => r.pair === 'USD/BRL');

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

// ---------- getWalletPerformanceMetrics ----------

/**
 * Calculates per-type performance metrics scoped to a wallet.
 */
export async function getWalletPerformanceMetrics(
  client: SupabaseClient,
  walletId: string,
): Promise<DataResult<PerformanceMetrics>> {
  const summaryResult = await getWalletPortfolioSummary(client, walletId);

  if (summaryResult.error) {
    return { data: null, error: summaryResult.error };
  }

  const { items, total_value_brl: totalValue } = summaryResult.data;

  const types: TypePerformance[] = items.map((item) => {
    const actualPct = totalValue > 0 ? (item.total_value_brl / totalValue) * 100 : 0;
    return {
      asset_type_id: item.asset_type_id,
      asset_type_name: item.asset_type_name,
      target_pct: item.target_pct,
      actual_pct: Math.round(actualPct * 100) / 100,
      deviation_pct: Math.round((actualPct - item.target_pct) * 100) / 100,
      total_value_brl: item.total_value_brl,
    };
  });

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

// ---------- getWalletDashboardData (orchestrator) ----------

/**
 * Fetches all wallet-scoped dashboard data.
 * Returns portfolio summary and performance metrics.
 */
export async function getWalletDashboardData(
  client: SupabaseClient,
  walletId: string,
): Promise<{
  portfolio: DataResult<PortfolioSummary>;
  performance: DataResult<PerformanceMetrics>;
}> {
  // Portfolio summary already fetches everything we need;
  // performance metrics reuses the same data internally
  const portfolio = await getWalletPortfolioSummary(client, walletId);

  // Compute performance from the portfolio result to avoid double-fetching
  if (portfolio.error) {
    return {
      portfolio,
      performance: { data: null, error: portfolio.error },
    };
  }

  const { items, total_value_brl: totalValue } = portfolio.data;

  const types: TypePerformance[] = items.map((item) => {
    const actualPct = totalValue > 0 ? (item.total_value_brl / totalValue) * 100 : 0;
    return {
      asset_type_id: item.asset_type_id,
      asset_type_name: item.asset_type_name,
      target_pct: item.target_pct,
      actual_pct: Math.round(actualPct * 100) / 100,
      deviation_pct: Math.round((actualPct - item.target_pct) * 100) / 100,
      total_value_brl: item.total_value_brl,
    };
  });

  let maxDevType = '';
  let maxDev = 0;
  for (const t of types) {
    if (Math.abs(t.deviation_pct) > maxDev) {
      maxDev = Math.abs(t.deviation_pct);
      maxDevType = t.asset_type_name;
    }
  }

  return {
    portfolio,
    performance: {
      data: {
        total_value_brl: totalValue,
        types,
        max_deviation_type: maxDevType,
      },
      error: null,
    },
  };
}

// ---------- getWalletRebalanceRecommendations ----------

/**
 * Fetches all data needed for rebalancing, scoped to a wallet.
 * Runs the L1→L2→L3 algorithm with wallet-filtered data.
 */
export async function getWalletRebalanceRecommendations(
  client: SupabaseClient,
  walletId: string,
  contribution: number,
): Promise<DataResult<RebalanceResult>> {
  if (contribution < 0) {
    return {
      data: null,
      error: makeError('REBALANCE_ERROR', 'Contribution must not be negative'),
    };
  }

  // Fetch all required data in parallel, filtered by wallet_id
  const [typesRes, groupsRes, assetsRes, scoresRes, pricesRes, ratesRes] = await Promise.all([
    client.from('asset_types').select('*').eq('wallet_id', walletId).order('sort_order', { ascending: true }),
    client.from('asset_groups').select('*').eq('wallet_id', walletId),
    client.from('assets').select('*').eq('wallet_id', walletId).eq('is_active', true),
    client.from('asset_scores').select('*').eq('wallet_id', walletId),
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
  const priceMap = buildPriceMapBrl(prices, rates);

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

  // Build weight_mode map: asset_id → weight_mode (for UI display, ADR-015)
  const weightModeMap = new Map<string, WeightMode>();
  for (const a of assets) {
    weightModeMap.set(a.id, a.weight_mode);
  }

  try {
    const result = rebalance(
      { types: l1Inputs, groups: l2Inputs, assets: l3Inputs },
      contribution,
    );

    // Enrich L3 results with weight_mode for UI indicator (Story 15.2)
    for (const type of result.types) {
      for (const group of type.groups) {
        for (const asset of group.assets) {
          asset.weight_mode = weightModeMap.get(asset.asset_id);
        }
      }
    }

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
