/** Maximum deviation (pp) that maps to 100% bar width */
export declare const MAX_DEVIATION_PP = 50;
/** Threshold below which no bar is shown (aligned) */
export declare const ALIGNED_THRESHOLD_PP = 2;
/** Threshold for minor vs significant deviation */
export declare const SIGNIFICANT_THRESHOLD_PP = 10;
export type DeviationLevel = 'aligned' | 'minor-over' | 'minor-under' | 'significant-over' | 'significant-under';
/**
 * Classify a deviation value into a visual level.
 * Returns null target handling is done by the caller (renders "—").
 */
export declare function getDeviationLevel(deviationPct: number): DeviationLevel;
/**
 * Compute bar width as percentage (0-100), scaled linearly.
 * |deviation| / MAX_DEVIATION clamped to [0, 1].
 */
export declare function getBarWidthPct(deviationPct: number): number;
export interface DeviationBarProps {
    /** Deviation in percentage points (actual_pct - target_pct) */
    deviationPct: number;
    /** Whether the target_pct is null/missing (renders "—" with no bar) */
    targetMissing?: boolean;
}
export declare function DeviationBar({ deviationPct, targetMissing }: DeviationBarProps): import("react/jsx-runtime").JSX.Element | null;
//# sourceMappingURL=DeviationBar.d.ts.map