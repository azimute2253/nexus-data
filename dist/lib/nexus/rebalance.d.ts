import type { L1TypeInput, L1Result, L2GroupInput, L2Result, L3AssetInput, L3GroupSummary, PortfolioInput, RebalanceResult } from './types.js';
/**
 * L1 Distribution — Type-Level Rebalancing
 *
 * Distributes a contribution (aporte) across asset types based on
 * target % vs actual allocation. Overweight types receive R$0;
 * underweight types receive proportionally to their deficit.
 *
 * Graceful degradation: if ALL types are overweight, the entire
 * contribution goes to the least-overweight type.
 *
 * Pure function — no DB calls, no API calls, no Date.now().
 */
export declare function distributeL1(types: L1TypeInput[], contribution: number): L1Result[];
export declare function distributeL2(l1Results: L1Result[], groups: L2GroupInput[]): L2Result[];
/**
 * Score Normalization — Converts raw scores to proportional percentages.
 *
 * Handles negative scores by shifting the minimum to zero before computing
 * proportions. Used by L3 distribution to determine asset weights within
 * a group based on questionnaire results.
 *
 * Edge cases:
 * - Empty array → returns []
 * - Single score → returns [100]
 * - All scores equal (or all zero after shift) → equal distribution (1/N * 100)
 *
 * Pure function — no side effects.
 * [ADR-004 Obligation 4]
 */
export declare function distributeL3(l2Results: L2Result[], assets: L3AssetInput[]): L3GroupSummary[];
export declare function normalizeScores(rawScores: number[]): number[];
export declare function rebalance(portfolio: PortfolioInput, contribution: number): RebalanceResult;
//# sourceMappingURL=rebalance.d.ts.map