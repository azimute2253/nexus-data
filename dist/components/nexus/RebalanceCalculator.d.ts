import type { RebalanceResult } from '../../lib/nexus/types.js';
export interface RebalanceCalculatorProps {
    /** Pre-computed rebalance result from server-side data layer */
    initialResult: RebalanceResult | null;
    /** Default contribution amount in BRL */
    defaultContribution?: number;
    /** Callback to re-run rebalance with a new contribution amount */
    onCalculate: (contribution: number) => Promise<RebalanceResult>;
    /** Error from initial server-side load */
    initialError?: string | null;
}
export declare function RebalanceCalculator({ initialResult, defaultContribution, onCalculate, initialError, }: RebalanceCalculatorProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=RebalanceCalculator.d.ts.map