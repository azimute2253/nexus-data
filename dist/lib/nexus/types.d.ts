export interface AssetType {
    id: string;
    name: string;
    target_pct: number | null;
    sort_order: number | null;
    user_id: string;
    wallet_id: string;
    created_at: string;
    updated_at: string;
}
export type AssetTypeInsert = Omit<AssetType, 'id' | 'created_at' | 'updated_at'>;
export type AssetTypeUpdate = Partial<Omit<AssetType, 'id' | 'created_at' | 'updated_at'>>;
export interface AssetGroup {
    id: string;
    type_id: string;
    name: string | null;
    target_pct: number | null;
    scoring_method: string;
    user_id: string;
    wallet_id: string;
    created_at: string;
    updated_at: string;
}
export type AssetGroupInsert = Omit<AssetGroup, 'id' | 'created_at' | 'updated_at'>;
export type AssetGroupUpdate = Partial<Omit<AssetGroup, 'id' | 'created_at' | 'updated_at'>>;
export type PriceSource = 'brapi' | 'yahoo' | 'manual' | 'crypto' | 'exchange';
export type WeightMode = 'manual' | 'questionnaire';
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
    bought: boolean;
    sold: boolean;
    weight_mode: WeightMode;
    manual_weight: number;
    user_id: string;
    wallet_id: string;
    created_at: string;
    updated_at: string;
}
export type AssetInsert = Omit<Asset, 'id' | 'created_at' | 'updated_at'>;
export type AssetUpdate = Partial<Omit<Asset, 'id' | 'created_at' | 'updated_at'>>;
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
    wallet_id: string;
    created_at: string;
    updated_at: string;
}
export type QuestionnaireInsert = Omit<Questionnaire, 'id' | 'created_at' | 'updated_at'>;
export type QuestionnaireUpdate = Partial<Omit<Questionnaire, 'id' | 'created_at' | 'updated_at'>>;
/** A single Sim/Nao answer stored in the asset_scores JSONB column. */
export interface ScoreAnswer {
    question_id: string;
    value: boolean;
}
export interface AssetScore {
    id: string;
    asset_id: string;
    questionnaire_id: string;
    answers: ScoreAnswer[];
    total_score: number;
    user_id: string;
    wallet_id: string;
    created_at: string;
    updated_at: string;
}
export type AssetScoreInsert = Omit<AssetScore, 'id' | 'created_at' | 'updated_at'>;
export type AssetScoreUpdate = Partial<Omit<AssetScore, 'id' | 'created_at' | 'updated_at'>>;
export interface Contribution {
    id: string;
    contributed_at: string | null;
    amount: number | null;
    distribution: unknown | null;
    user_id: string;
    wallet_id: string;
    created_at: string;
}
export type ContributionInsert = Omit<Contribution, 'id' | 'created_at'>;
export type ContributionUpdate = Partial<Omit<Contribution, 'id' | 'created_at'>>;
export interface ExchangeRate {
    pair: string;
    rate: number | null;
    fetched_at: string;
    user_id: string;
}
export type ExchangeRateInsert = ExchangeRate;
export type ExchangeRateUpdate = Partial<Omit<ExchangeRate, 'pair'>>;
export interface PortfolioSummaryRow {
    asset_type_id: string;
    asset_type_name: string;
    target_pct: number | null;
    user_id: string;
    total_value: number;
    asset_count: number;
}
/** ticker → price in original currency */
export type PriceMap = Record<string, number>;
/** currency pair (e.g. "USD/BRL") → conversion rate */
export type RateMap = Record<string, number>;
/** Input for L1: one asset type with its current value in BRL */
export interface L1TypeInput {
    type_id: string;
    name: string;
    target_pct: number;
    actual_value_brl: number;
}
/** Output from L1: distribution result per asset type */
export interface L1Result {
    type_id: string;
    name: string;
    target_pct: number;
    desired_value: number;
    actual_value: number;
    deviation: number;
    deficit: number;
    allocated: number;
}
/** Input for L2: one group within an asset type */
export interface L2GroupInput {
    group_id: string;
    name: string;
    type_id: string;
    target_pct: number;
}
/** Output from L2: distribution result per group */
export interface L2Result {
    group_id: string;
    name: string;
    type_id: string;
    target_pct: number;
    allocated: number;
}
/** Input for L3: one asset within a group */
export interface L3AssetInput {
    asset_id: string;
    ticker: string;
    group_id: string;
    score: number;
    price_brl: number;
    is_active: boolean;
    manual_override: boolean;
    whole_shares: boolean;
}
/** Output from L3: per-asset allocation result */
export interface L3Result {
    asset_id: string;
    ticker: string;
    group_id: string;
    ideal_pct: number;
    allocated_brl: number;
    shares_to_buy: number;
    estimated_cost_brl: number;
    remainder_brl: number;
    weight_mode?: WeightMode;
}
/** Summary of L3 distribution for a group */
export interface L3GroupSummary {
    group_id: string;
    allocated_brl: number;
    spent_brl: number;
    remainder_brl: number;
    assets: L3Result[];
}
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
export interface Wallet {
    id: string;
    user_id: string;
    name: string;
    created_at: string;
}
export type WalletInsert = Omit<Wallet, 'id' | 'created_at'>;
export type WalletUpdate = Partial<Omit<Wallet, 'id' | 'created_at'>>;
export interface FeatureFlag {
    name: string;
    enabled: boolean;
    description: string | null;
}
export type PriceRefreshTrigger = 'manual' | 'auto';
export interface PriceRefreshLog {
    id: string;
    refreshed_at: string;
    trigger: PriceRefreshTrigger;
    user_id: string | null;
}
export type PriceRefreshLogInsert = Omit<PriceRefreshLog, 'id'>;
//# sourceMappingURL=types.d.ts.map