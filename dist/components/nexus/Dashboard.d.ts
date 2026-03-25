import type { PerformanceMetrics } from '../../lib/dashboard/types.js';
export interface DashboardProps {
    /** Performance metrics (total value + per-type breakdown) */
    performance: PerformanceMetrics | null;
    /** Whether data is loading */
    isLoading?: boolean;
    /** Error message */
    error?: string | null;
    /** Retry callback */
    onRetry?: () => void;
}
export declare function Dashboard({ performance, isLoading, error, onRetry, }: DashboardProps): import("react/jsx-runtime").JSX.Element | null;
//# sourceMappingURL=Dashboard.d.ts.map