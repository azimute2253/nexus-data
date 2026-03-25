import type { TypePerformance } from '../../lib/dashboard/types.js';
export interface AllocationTableProps {
    /** Performance data per asset type from getPerformanceMetrics() */
    types: TypePerformance[];
    /** Total portfolio value in BRL for context */
    totalValueBrl: number;
    /** Whether data is currently loading */
    isLoading?: boolean;
    /** Error message to display instead of data */
    error?: string | null;
    /** Callback for retry on error */
    onRetry?: () => void;
}
export declare function AllocationTable({ types, totalValueBrl, isLoading, error, onRetry, }: AllocationTableProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=AllocationTable.d.ts.map