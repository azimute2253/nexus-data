// ============================================================
// Nexus Data — Database Types
// TypeScript interfaces matching all Supabase tables + view.
// ============================================================

// ---------- asset_types ----------

export interface AssetType {
  id: string;
  name: string;
  target_pct: number | null;
  sort_order: number | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export type AssetTypeInsert = Omit<AssetType, 'id' | 'created_at' | 'updated_at'>;
export type AssetTypeUpdate = Partial<Omit<AssetType, 'id' | 'created_at' | 'updated_at'>>;

// ---------- asset_groups ----------

export interface AssetGroup {
  id: string;
  type_id: string;
  name: string | null;
  target_pct: number | null;
  scoring_method: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export type AssetGroupInsert = Omit<AssetGroup, 'id' | 'created_at' | 'updated_at'>;
export type AssetGroupUpdate = Partial<Omit<AssetGroup, 'id' | 'created_at' | 'updated_at'>>;

// ---------- assets ----------

export type PriceSource = 'brapi' | 'yahoo' | 'manual' | 'crypto' | 'exchange';

export interface Asset {
  id: string;
  ticker: string;
  name: string | null;
  sector: string | null;
  quantity: number;
  group_id: string;
  price_source: PriceSource;
  is_active: boolean;
  manual_override: boolean;
  whole_shares: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export type AssetInsert = Omit<Asset, 'id' | 'created_at' | 'updated_at'>;
export type AssetUpdate = Partial<Omit<Asset, 'id' | 'created_at' | 'updated_at'>>;

// ---------- price_cache ----------

export interface PriceCache {
  ticker: string;
  price: number | null;
  currency: string;
  source: string | null;
  fetched_at: string;
  user_id: string;
}

export type PriceCacheInsert = PriceCache;
export type PriceCacheUpdate = Partial<Omit<PriceCache, 'ticker'>>;

// ---------- questionnaires ----------

/** Weight for Sim/Nao questions: +1 (positive signal) or -1 (negative signal). */
export type QuestionWeight = 1 | -1;

/** A single Sim/Nao question stored inside the questionnaire's JSONB column. */
export interface QuestionnaireQuestion {
  id: string;
  text: string;
  weight: QuestionWeight;
  sort_order: number;
}

export interface Questionnaire {
  id: string;
  name: string | null;
  asset_type_id: string | null;
  questions: QuestionnaireQuestion[];
  user_id: string;
  created_at: string;
  updated_at: string;
}

export type QuestionnaireInsert = Omit<Questionnaire, 'id' | 'created_at' | 'updated_at'>;
export type QuestionnaireUpdate = Partial<Omit<Questionnaire, 'id' | 'created_at' | 'updated_at'>>;

// ---------- asset_scores ----------

export interface AssetScore {
  id: string;
  asset_id: string;
  questionnaire_id: string;
  answers: unknown[];
  total_score: number;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export type AssetScoreInsert = Omit<AssetScore, 'id' | 'created_at' | 'updated_at'>;
export type AssetScoreUpdate = Partial<Omit<AssetScore, 'id' | 'created_at' | 'updated_at'>>;

// ---------- contributions ----------

export interface Contribution {
  id: string;
  contributed_at: string | null;
  amount: number | null;
  distribution: unknown | null;
  user_id: string;
  created_at: string;
}

export type ContributionInsert = Omit<Contribution, 'id' | 'created_at'>;
export type ContributionUpdate = Partial<Omit<Contribution, 'id' | 'created_at'>>;

// ---------- exchange_rates ----------

export interface ExchangeRate {
  pair: string;
  rate: number | null;
  fetched_at: string;
  user_id: string;
}

export type ExchangeRateInsert = ExchangeRate;
export type ExchangeRateUpdate = Partial<Omit<ExchangeRate, 'pair'>>;

// ---------- portfolio_summary (VIEW) ----------

export interface PortfolioSummaryRow {
  asset_type_id: string;
  asset_type_name: string;
  target_pct: number | null;
  user_id: string;
  total_value: number;
  asset_count: number;
}

// ---------- rebalancing algorithm types ----------

/** ticker → price in original currency */
export type PriceMap = Record<string, number>;

/** currency pair (e.g. "USD/BRL") → conversion rate */
export type RateMap = Record<string, number>;

/** Input for L1: one asset type with its current value in BRL */
export interface L1TypeInput {
  type_id: string;
  name: string;
  target_pct: number;       // decimal 0..1 (e.g. 0.15 for 15%)
  actual_value_brl: number; // current total value in BRL
}

/** Output from L1: distribution result per asset type */
export interface L1Result {
  type_id: string;
  name: string;
  target_pct: number;
  desired_value: number;    // total_portfolio * target_pct
  actual_value: number;     // current value in BRL
  deviation: number;        // actual_value - desired_value (positive = overweight)
  deficit: number;          // max(0, desired_value - actual_value)
  allocated: number;        // how much of the contribution this type receives
}

/** Input for L2: one group within an asset type */
export interface L2GroupInput {
  group_id: string;
  name: string;
  type_id: string;
  target_pct: number;       // decimal 0..1 — share within its type (e.g. 0.60 for 60%)
}

/** Output from L2: distribution result per group */
export interface L2Result {
  group_id: string;
  name: string;
  type_id: string;
  target_pct: number;
  allocated: number;        // how much of the type's allocation this group receives
}

/** Input for L3: one asset within a group */
export interface L3AssetInput {
  asset_id: string;
  ticker: string;
  group_id: string;
  score: number;            // raw score from questionnaire (can be negative)
  price_brl: number;        // current price in BRL
  is_active: boolean;
  manual_override: boolean;
  whole_shares: boolean;    // true = Math.floor (stocks/FIIs), false = fractional (ETFs)
}

/** Output from L3: per-asset allocation result */
export interface L3Result {
  asset_id: string;
  ticker: string;
  group_id: string;
  ideal_pct: number;        // normalized score as % within group (0..100)
  allocated_brl: number;    // amount in BRL allocated to this asset
  shares_to_buy: number;    // quantity (integer for whole_shares, fractional otherwise)
  estimated_cost_brl: number; // shares_to_buy * price_brl
  remainder_brl: number;    // allocated - estimated_cost (due to FLOOR rounding)
}

/** Summary of L3 distribution for a group */
export interface L3GroupSummary {
  group_id: string;
  allocated_brl: number;    // total amount received from L2
  spent_brl: number;        // sum of estimated_cost_brl across assets
  remainder_brl: number;    // allocated - spent (unspent due to rounding)
  assets: L3Result[];
}

// ---------- Orchestrator types (Story 4.4) ----------

/** Top-level portfolio input for the rebalance() orchestrator */
export interface PortfolioInput {
  types: L1TypeInput[];
  groups: L2GroupInput[];
  assets: L3AssetInput[];
}

/** Nested result from type → group → asset level */
export interface RebalanceTypeResult {
  type_id: string;
  name: string;
  allocated: number;
  groups: RebalanceGroupResult[];
}

export interface RebalanceGroupResult {
  group_id: string;
  name: string;
  allocated: number;
  spent: number;
  remainder: number;
  assets: L3Result[];
}

/** Complete rebalance output — per-asset allocations nested by type/group */
export interface RebalanceResult {
  contribution: number;
  total_allocated: number;
  total_spent: number;
  total_remainder: number;
  types: RebalanceTypeResult[];
}

// ---------- feature_flags ----------

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description: string | null;
}
