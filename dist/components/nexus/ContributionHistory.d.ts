import type { Contribution } from '../../lib/nexus/types.js';
export interface ContributionHistoryProps {
    /** Contributions for the active wallet, already sorted DESC by contributed_at */
    contributions: Contribution[];
    /** Whether data is loading */
    isLoading?: boolean;
}
export declare function ContributionHistory({ contributions, isLoading, }: ContributionHistoryProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=ContributionHistory.d.ts.map