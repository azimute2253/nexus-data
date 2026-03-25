import type { Asset, AssetScore, L3AssetInput } from './types.js';
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
export declare function buildL3Input(asset: Asset, assetScore: AssetScore | null, priceBrl: number): L3AssetInput;
//# sourceMappingURL=data.d.ts.map