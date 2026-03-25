// ============================================================
// Nexus Data — Data Layer (XOR Resolution)
// Bridges DB schema to the pure L3 algorithm.
// ADR-015: Dual Weight Mode — resolution happens HERE, not in L3.
// ============================================================
/**
 * buildL3Input — XOR Resolution for Dual Weight Mode
 *
 * Converts a DB asset + optional questionnaire score into an L3AssetInput
 * that the pure distributeL3 algorithm consumes.
 *
 * Resolution logic:
 * - weight_mode = 'manual'        → score = asset.manual_weight
 * - weight_mode = 'questionnaire'  → score = assetScore.total_score (or 0)
 *
 * This keeps the L3 algorithm pure and unchanged (ADR-015).
 */
export function buildL3Input(asset, assetScore, priceBrl) {
    const score = asset.weight_mode === 'manual'
        ? asset.manual_weight
        : (assetScore?.total_score ?? 0);
    return {
        asset_id: asset.id,
        ticker: asset.ticker,
        group_id: asset.group_id,
        score,
        price_brl: priceBrl,
        is_active: asset.is_active,
        manual_override: asset.manual_override,
        whole_shares: asset.whole_shares,
    };
}
