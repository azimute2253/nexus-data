import type { TypePerformance } from './types.js';
export type SortKey = 'asset_type_name' | 'target_pct' | 'actual_pct' | 'deviation_pct' | 'total_value_brl';
export type SortDir = 'asc' | 'desc';
export interface SortState {
    key: SortKey;
    dir: SortDir;
}
export declare function sortTypes(types: TypePerformance[], sort: SortState): TypePerformance[];
export declare function formatBrl(value: number): string;
export declare function formatPct(value: number): string;
export type AllocationStatus = 'Overweight' | 'Underweight' | 'Aligned';
export declare function getStatus(deviationPct: number): AllocationStatus;
//# sourceMappingURL=allocation-utils.d.ts.map