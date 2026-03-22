import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  PortfolioSummaryRow,
  PriceCache,
  ExchangeRate,
  AssetType,
  AssetGroup,
  Asset,
  AssetScore,
} from '../../src/lib/nexus/types.js';

// ── Mock Supabase client ────────────────────────────────────
// Each from() call creates an isolated chain that captures its table.

const { createMockClient } = vi.hoisted(() => {
  type TableDataMap = Record<string, { data: unknown; error: unknown }>;

  function createMockClient(tableData: TableDataMap = {}) {
    const client = {
      from(table: string) {
        const result = tableData[table] ?? { data: null, error: null };
        const chain: Record<string, unknown> = {};

        const chainMethods = ['select', 'eq', 'order', 'insert', 'update', 'delete'];

        for (const method of chainMethods) {
          chain[method] = vi.fn((..._args: unknown[]) => chain);
        }

        // Terminal methods: extract first element for maybeSingle/single
        chain.single = vi.fn(() => {
          const d = result.data;
          const singleData = Array.isArray(d) ? (d[0] ?? null) : d;
          return { data: singleData, error: result.error };
        });
        chain.maybeSingle = vi.fn(() => {
          const d = result.data;
          const singleData = Array.isArray(d) ? (d[0] ?? null) : d;
          return { data: singleData, error: result.error };
        });

        // Make chain thenable for non-terminal awaits
        chain.then = (resolve: (val: unknown) => void) =>
          Promise.resolve(result).then(resolve);

        return chain;
      },
    };

    return client;
  }

  return { createMockClient };
});

// Mock the rebalance module to isolate data layer tests
vi.mock('../../src/lib/nexus/rebalance.js', () => ({
  rebalance: vi.fn(),
}));

// ── Import modules under test ───────────────────────────────

import {
  getPortfolioSummary,
  getAssetPrices,
  getRebalanceRecommendations,
  getPerformanceMetrics,
  getDashboardData,
} from '../../src/lib/dashboard/data.js';
import { rebalance } from '../../src/lib/nexus/rebalance.js';

const mockedRebalance = vi.mocked(rebalance);

// ── Fixtures ────────────────────────────────────────────────

const USER_ID = '00000000-0000-0000-0000-000000000001';

const SUMMARY_ROWS: PortfolioSummaryRow[] = [
  { asset_type_id: 't1', asset_type_name: 'FIIs', target_pct: 15, user_id: USER_ID, total_value: 36000, asset_count: 20 },
  { asset_type_id: 't2', asset_type_name: 'Ações BR', target_pct: 20, user_id: USER_ID, total_value: 50000, asset_count: 30 },
  { asset_type_id: 't3', asset_type_name: 'ETFs Int.', target_pct: 10, user_id: USER_ID, total_value: 24000, asset_count: 5 },
];

const USD_BRL_RATE: ExchangeRate = {
  pair: 'USD/BRL',
  rate: 5.0,
  fetched_at: new Date().toISOString(),
  user_id: USER_ID,
};

const NOW = new Date();
const STALE_DATE = new Date(NOW.getTime() - 25 * 60 * 60 * 1000).toISOString();
const FRESH_DATE = NOW.toISOString();

const PRICE_CACHE: PriceCache[] = [
  { ticker: 'HGLG11', price: 160.5, currency: 'BRL', source: 'brapi', fetched_at: FRESH_DATE, user_id: USER_ID },
  { ticker: 'PETR4', price: 38.2, currency: 'BRL', source: 'brapi', fetched_at: FRESH_DATE, user_id: USER_ID },
  { ticker: 'VT', price: 100.0, currency: 'USD', source: 'yahoo', fetched_at: STALE_DATE, user_id: USER_ID },
  { ticker: 'MISSING', price: null, currency: 'BRL', source: null, fetched_at: FRESH_DATE, user_id: USER_ID },
];

// ── Setup ───────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests: getPortfolioSummary (AC1, AC2) ───────────────────

describe('getPortfolioSummary', () => {
  it('T5.1.1 — fetches and aggregates portfolio summary by asset type', async () => {
    const client = createMockClient({
      portfolio_summary: { data: SUMMARY_ROWS, error: null },
      exchange_rates: { data: USD_BRL_RATE, error: null },
    });

    const result = await getPortfolioSummary(client as any);

    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    expect(result.data!.items).toHaveLength(3);
    // 36000 + 50000 + 24000 = 110000
    expect(result.data!.total_value_brl).toBe(110000);
    expect(result.data!.exchange_rate_usd_brl).toBe(5.0);
  });

  it('returns items with correct asset type data', async () => {
    const client = createMockClient({
      portfolio_summary: { data: SUMMARY_ROWS, error: null },
      exchange_rates: { data: USD_BRL_RATE, error: null },
    });

    const result = await getPortfolioSummary(client as any);

    expect(result.data!.items[0]).toEqual({
      asset_type_id: 't1',
      asset_type_name: 'FIIs',
      target_pct: 15,
      total_value_brl: 36000,
      asset_count: 20,
    });
  });

  it('handles null exchange rate gracefully', async () => {
    const client = createMockClient({
      portfolio_summary: { data: SUMMARY_ROWS, error: null },
      exchange_rates: { data: null, error: null },
    });

    const result = await getPortfolioSummary(client as any);

    expect(result.error).toBeNull();
    expect(result.data!.exchange_rate_usd_brl).toBeNull();
  });

  it('returns DB_ERROR when portfolio_summary query fails', async () => {
    const dbErr = { message: 'connection refused', code: '500' };
    const client = createMockClient({
      portfolio_summary: { data: null, error: dbErr },
      exchange_rates: { data: null, error: null },
    });

    const result = await getPortfolioSummary(client as any);

    expect(result.data).toBeNull();
    expect(result.error!.code).toBe('DB_ERROR');
  });

  it('returns EXCHANGE_RATE_ERROR when exchange rate query fails', async () => {
    const rateErr = { message: 'rate error', code: '500' };
    const client = createMockClient({
      portfolio_summary: { data: SUMMARY_ROWS, error: null },
      exchange_rates: { data: null, error: rateErr },
    });

    const result = await getPortfolioSummary(client as any);

    expect(result.data).toBeNull();
    expect(result.error!.code).toBe('EXCHANGE_RATE_ERROR');
  });
});

// ── Tests: getAssetPrices (AC2, AC5 staleness) ──────────────

describe('getAssetPrices', () => {
  it('T5.1.2 — fetches all cached prices', async () => {
    const client = createMockClient({
      price_cache: { data: PRICE_CACHE, error: null },
    });

    const result = await getAssetPrices(client as any, NOW);

    expect(result.error).toBeNull();
    expect(result.data!.prices).toHaveLength(4);
  });

  it('detects stale prices older than 24 hours', async () => {
    const client = createMockClient({
      price_cache: { data: PRICE_CACHE, error: null },
    });

    const result = await getAssetPrices(client as any, NOW);

    // VT was fetched 25h ago → stale
    const vtPrice = result.data!.prices.find((p) => p.ticker === 'VT');
    expect(vtPrice!.is_stale).toBe(true);

    // HGLG11 was fetched just now → fresh
    const hglgPrice = result.data!.prices.find((p) => p.ticker === 'HGLG11');
    expect(hglgPrice!.is_stale).toBe(false);

    expect(result.data!.stale_count).toBe(1);
  });

  it('counts missing prices (null price)', async () => {
    const client = createMockClient({
      price_cache: { data: PRICE_CACHE, error: null },
    });

    const result = await getAssetPrices(client as any, NOW);

    // MISSING has price: null
    expect(result.data!.missing_count).toBe(1);
  });

  it('returns PRICE_ERROR on DB failure', async () => {
    const dbErr = { message: 'timeout', code: '500' };
    const client = createMockClient({
      price_cache: { data: null, error: dbErr },
    });

    const result = await getAssetPrices(client as any, NOW);

    expect(result.data).toBeNull();
    expect(result.error!.code).toBe('PRICE_ERROR');
  });
});

// ── Tests: getRebalanceRecommendations (AC3) ────────────────

describe('getRebalanceRecommendations', () => {
  const mockTypes: AssetType[] = [
    { id: 't1', name: 'FIIs', target_pct: 15, sort_order: 1, user_id: USER_ID, created_at: '', updated_at: '' },
  ];
  const mockGroups: AssetGroup[] = [
    { id: 'g1', type_id: 't1', name: 'FIIs Logísticos', target_pct: 100, scoring_method: 'questionnaire', user_id: USER_ID, created_at: '', updated_at: '' },
  ];
  const mockAssets: Asset[] = [
    { id: 'a1', ticker: 'HGLG11', name: 'CSHG Logística', sector: 'Logística', quantity: 10, group_id: 'g1', price_source: 'brapi', is_active: true, manual_override: false, whole_shares: true, user_id: USER_ID, created_at: '', updated_at: '' },
  ];
  const mockScores: AssetScore[] = [
    { id: 's1', asset_id: 'a1', questionnaire_id: 'q1', answers: [], total_score: 5, user_id: USER_ID, created_at: '', updated_at: '' },
  ];
  const mockPrices: PriceCache[] = [
    { ticker: 'HGLG11', price: 160.0, currency: 'BRL', source: 'brapi', fetched_at: FRESH_DATE, user_id: USER_ID },
  ];

  function makeRebalanceClient(overrides: Record<string, { data: unknown; error: unknown }> = {}) {
    return createMockClient({
      asset_types: { data: mockTypes, error: null },
      asset_groups: { data: mockGroups, error: null },
      assets: { data: mockAssets, error: null },
      asset_scores: { data: mockScores, error: null },
      price_cache: { data: mockPrices, error: null },
      exchange_rates: { data: [], error: null },
      ...overrides,
    });
  }

  it('T5.1.3 — calls rebalance with assembled portfolio data', async () => {
    const client = makeRebalanceClient();

    const mockResult = {
      contribution: 1000,
      total_allocated: 1000,
      total_spent: 960,
      total_remainder: 40,
      types: [],
    };
    mockedRebalance.mockReturnValue(mockResult);

    const result = await getRebalanceRecommendations(client as any, 1000);

    expect(result.error).toBeNull();
    expect(result.data).toEqual(mockResult);
    expect(mockedRebalance).toHaveBeenCalledTimes(1);

    // Verify the portfolio input passed to rebalance
    const [portfolioArg, contributionArg] = mockedRebalance.mock.calls[0];
    expect(contributionArg).toBe(1000);
    expect(portfolioArg.types).toHaveLength(1);
    expect(portfolioArg.types[0].target_pct).toBe(0.15); // converted from 15 to 0.15
    expect(portfolioArg.assets[0].price_brl).toBe(160.0);
    expect(portfolioArg.assets[0].score).toBe(5);
  });

  it('T5.1.2b — converts USD prices to BRL using exchange rate', async () => {
    const usdPrices: PriceCache[] = [
      { ticker: 'VT', price: 100.0, currency: 'USD', source: 'yahoo', fetched_at: '', user_id: USER_ID },
    ];
    const usdAssets: Asset[] = [
      { id: 'a2', ticker: 'VT', name: 'Vanguard Total', sector: 'ETF', quantity: 5, group_id: 'g1', price_source: 'yahoo', is_active: true, manual_override: false, whole_shares: false, user_id: USER_ID, created_at: '', updated_at: '' },
    ];
    const rates: ExchangeRate[] = [
      { pair: 'USD/BRL', rate: 5.0, fetched_at: '', user_id: USER_ID },
    ];

    const client = makeRebalanceClient({
      assets: { data: usdAssets, error: null },
      price_cache: { data: usdPrices, error: null },
      exchange_rates: { data: rates, error: null },
    });

    mockedRebalance.mockReturnValue({
      contribution: 1000, total_allocated: 1000, total_spent: 500,
      total_remainder: 500, types: [],
    });

    const result = await getRebalanceRecommendations(client as any, 1000);

    expect(result.error).toBeNull();
    const [portfolioArg] = mockedRebalance.mock.calls[0];
    // VT: $100 * 5.0 = R$500
    expect(portfolioArg.assets[0].price_brl).toBe(500);
  });

  it('rejects negative contribution', async () => {
    const client = makeRebalanceClient();

    const result = await getRebalanceRecommendations(client as any, -100);

    expect(result.data).toBeNull();
    expect(result.error!.code).toBe('REBALANCE_ERROR');
    expect(result.error!.message).toContain('negative');
  });

  it('returns error when no types with target allocations exist', async () => {
    const emptyTypes: AssetType[] = [
      { id: 't1', name: 'Empty', target_pct: null, sort_order: 1, user_id: USER_ID, created_at: '', updated_at: '' },
    ];

    const client = makeRebalanceClient({
      asset_types: { data: emptyTypes, error: null },
      assets: { data: [], error: null },
    });

    const result = await getRebalanceRecommendations(client as any, 1000);

    expect(result.data).toBeNull();
    expect(result.error!.code).toBe('REBALANCE_ERROR');
    expect(result.error!.message).toContain('No asset types');
  });

  it('returns DB_ERROR when any table query fails', async () => {
    const dbErr = { message: 'connection error', code: '500' };
    const client = makeRebalanceClient({
      assets: { data: null, error: dbErr },
    });

    const result = await getRebalanceRecommendations(client as any, 1000);

    expect(result.data).toBeNull();
    expect(result.error!.code).toBe('DB_ERROR');
  });

  it('catches rebalance algorithm errors', async () => {
    const client = makeRebalanceClient();

    mockedRebalance.mockImplementation(() => {
      throw new Error('Group targets sum mismatch');
    });

    const result = await getRebalanceRecommendations(client as any, 1000);

    expect(result.data).toBeNull();
    expect(result.error!.code).toBe('REBALANCE_ERROR');
    expect(result.error!.message).toContain('Group targets sum mismatch');
  });
});

// ── Tests: getPerformanceMetrics (AC4) ──────────────────────

describe('getPerformanceMetrics', () => {
  it('T5.1.4 — calculates deviation per asset type', async () => {
    const client = createMockClient({
      portfolio_summary: { data: SUMMARY_ROWS, error: null },
    });

    const result = await getPerformanceMetrics(client as any);

    expect(result.error).toBeNull();
    expect(result.data!.total_value_brl).toBe(110000);
    expect(result.data!.types).toHaveLength(3);

    // FIIs: actual 36000/110000 = 32.73%, target 15% → deviation +17.73%
    const fiis = result.data!.types.find((t) => t.asset_type_name === 'FIIs')!;
    expect(fiis.target_pct).toBe(15);
    expect(fiis.actual_pct).toBeCloseTo(32.73, 1);
    expect(fiis.deviation_pct).toBeCloseTo(17.73, 1);
  });

  it('identifies the type with max deviation', async () => {
    const client = createMockClient({
      portfolio_summary: { data: SUMMARY_ROWS, error: null },
    });

    const result = await getPerformanceMetrics(client as any);

    // Ações BR: 50000/110000 = 45.45%, target 20% → deviation +25.45% (largest)
    expect(result.data!.max_deviation_type).toBe('Ações BR');
  });

  it('handles zero total portfolio value', async () => {
    const emptyRows: PortfolioSummaryRow[] = [
      { asset_type_id: 't1', asset_type_name: 'FIIs', target_pct: 15, user_id: USER_ID, total_value: 0, asset_count: 0 },
    ];

    const client = createMockClient({
      portfolio_summary: { data: emptyRows, error: null },
    });

    const result = await getPerformanceMetrics(client as any);

    expect(result.error).toBeNull();
    expect(result.data!.total_value_brl).toBe(0);
    expect(result.data!.types[0].actual_pct).toBe(0);
  });

  it('returns DB_ERROR on query failure', async () => {
    const dbErr = { message: 'timeout', code: '500' };
    const client = createMockClient({
      portfolio_summary: { data: null, error: dbErr },
    });

    const result = await getPerformanceMetrics(client as any);

    expect(result.data).toBeNull();
    expect(result.error!.code).toBe('DB_ERROR');
  });
});

// ── Tests: getDashboardData (orchestrator) ──────────────────

describe('getDashboardData', () => {
  const defaultTypes: AssetType[] = [
    { id: 't1', name: 'FIIs', target_pct: 15, sort_order: 1, user_id: USER_ID, created_at: '', updated_at: '' },
  ];
  const defaultGroups: AssetGroup[] = [
    { id: 'g1', type_id: 't1', name: 'FIIs', target_pct: 100, scoring_method: 'questionnaire', user_id: USER_ID, created_at: '', updated_at: '' },
  ];

  it('fetches all dashboard sections in parallel', async () => {
    const client = createMockClient({
      portfolio_summary: { data: SUMMARY_ROWS, error: null },
      exchange_rates: { data: [USD_BRL_RATE], error: null },
      price_cache: { data: PRICE_CACHE, error: null },
      asset_types: { data: defaultTypes, error: null },
      asset_groups: { data: defaultGroups, error: null },
      assets: { data: [], error: null },
      asset_scores: { data: [], error: null },
    });

    mockedRebalance.mockReturnValue({
      contribution: 0, total_allocated: 0, total_spent: 0,
      total_remainder: 0, types: [],
    });

    const result = await getDashboardData(client as any, 0);

    expect(result.portfolio).toBeDefined();
    expect(result.prices).toBeDefined();
    expect(result.performance).toBeDefined();
    expect(result.rebalance).toBeDefined();

    // portfolio and prices should succeed
    expect(result.portfolio.data).not.toBeNull();
    expect(result.prices.data).not.toBeNull();
    expect(result.performance.data).not.toBeNull();
  });

  it('returns individual errors per section without failing globally', async () => {
    const dbErr = { message: 'price_cache down', code: '500' };

    const client = createMockClient({
      portfolio_summary: { data: SUMMARY_ROWS, error: null },
      exchange_rates: { data: [USD_BRL_RATE], error: null },
      price_cache: { data: null, error: dbErr },
      asset_types: { data: defaultTypes, error: null },
      asset_groups: { data: defaultGroups, error: null },
      assets: { data: [], error: null },
      asset_scores: { data: [], error: null },
    });

    mockedRebalance.mockReturnValue({
      contribution: 0, total_allocated: 0, total_spent: 0,
      total_remainder: 0, types: [],
    });

    const result = await getDashboardData(client as any, 0);

    // prices should have error
    expect(result.prices.error).not.toBeNull();
    expect(result.prices.error!.code).toBe('PRICE_ERROR');

    // portfolio should succeed
    expect(result.portfolio.data).not.toBeNull();
    expect(result.portfolio.error).toBeNull();
  });
});
