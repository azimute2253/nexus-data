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

export interface Questionnaire {
  id: string;
  name: string | null;
  asset_type_id: string | null;
  questions: unknown[];
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
