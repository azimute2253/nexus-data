import type { TypePerformance } from '../../lib/dashboard/types.js';
export interface AllocationChartProps {
    /** Performance data per asset type from getPerformanceMetrics() */
    types: TypePerformance[];
    /** Total portfolio value in BRL */
    totalValueBrl: number;
    /** Whether data is currently loading */
    isLoading?: boolean;
    /** Error message to display instead of chart */
    error?: string | null;
    /** Callback for retry on error */
    onRetry?: () => void;
}
export declare function getColor(index: number): string;
export interface ChartSlice {
    name: string;
    value: number;
    valueBrl: number;
    fill: string;
}
export declare function buildActualSlices(types: TypePerformance[]): ChartSlice[];
export declare function buildTargetSlices(types: TypePerformance[], totalValueBrl: number): ChartSlice[];
export declare function AllocationChart({ types, totalValueBrl, isLoading, error, onRetry, }: AllocationChartProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=AllocationChart.d.ts.map