// ============================================================
// Nexus Data — Deviation Bar Component
// Visual deviation indicator with proportional colored bars.
// Red = overweight (>10pp), orange = underweight (>10pp),
// green = minor (2-10pp), hidden = aligned (±2pp).
// Bar width scales linearly with |deviation| up to max.
// [Story 5.4, ADR-006]
// ============================================================

// ---------- Pure logic (exported for testing) ----------

/** Maximum deviation (pp) that maps to 100% bar width */
export const MAX_DEVIATION_PP = 50;

/** Threshold below which no bar is shown (aligned) */
export const ALIGNED_THRESHOLD_PP = 2;

/** Threshold for minor vs significant deviation */
export const SIGNIFICANT_THRESHOLD_PP = 10;

export type DeviationLevel = 'aligned' | 'minor-over' | 'minor-under' | 'significant-over' | 'significant-under';

/**
 * Classify a deviation value into a visual level.
 * Returns null target handling is done by the caller (renders "—").
 */
export function getDeviationLevel(deviationPct: number): DeviationLevel {
  const abs = Math.abs(deviationPct);
  if (abs <= ALIGNED_THRESHOLD_PP) return 'aligned';
  if (deviationPct > SIGNIFICANT_THRESHOLD_PP) return 'significant-over';
  if (deviationPct < -SIGNIFICANT_THRESHOLD_PP) return 'significant-under';
  if (deviationPct > 0) return 'minor-over';
  return 'minor-under';
}

/**
 * Compute bar width as percentage (0-100), scaled linearly.
 * |deviation| / MAX_DEVIATION clamped to [0, 1].
 */
export function getBarWidthPct(deviationPct: number): number {
  const abs = Math.abs(deviationPct);
  if (abs <= ALIGNED_THRESHOLD_PP) return 0;
  return Math.min((abs / MAX_DEVIATION_PP) * 100, 100);
}

// ---------- Style mapping ----------

const LEVEL_STYLES: Record<Exclude<DeviationLevel, 'aligned'>, { bar: string; text: string }> = {
  'significant-over': { bar: 'bg-red-500', text: 'text-red-700' },
  'significant-under': { bar: 'bg-amber-400', text: 'text-amber-700' },
  'minor-over': { bar: 'bg-green-400', text: 'text-green-700' },
  'minor-under': { bar: 'bg-green-400', text: 'text-green-700' },
};

// ---------- Component ----------

export interface DeviationBarProps {
  /** Deviation in percentage points (actual_pct - target_pct) */
  deviationPct: number;
  /** Whether the target_pct is null/missing (renders "—" with no bar) */
  targetMissing?: boolean;
}

export function DeviationBar({ deviationPct, targetMissing = false }: DeviationBarProps) {
  if (targetMissing) {
    return (
      <span className="text-sm text-gray-400" aria-label="Sem meta definida">
        —
      </span>
    );
  }

  const level = getDeviationLevel(deviationPct);

  if (level === 'aligned') {
    return null;
  }

  const widthPct = getBarWidthPct(deviationPct);
  const styles = LEVEL_STYLES[level];
  const sign = deviationPct > 0 ? '+' : '';
  const label = deviationPct > 0 ? 'acima da meta' : 'abaixo da meta';

  return (
    <div
      className="flex items-center gap-2"
      title={`${sign}${deviationPct.toFixed(2)}pp ${label}`}
      role="meter"
      aria-valuenow={Math.abs(deviationPct)}
      aria-valuemin={0}
      aria-valuemax={MAX_DEVIATION_PP}
      aria-label={`Desvio: ${sign}${deviationPct.toFixed(2)}pp`}
    >
      <div className="h-2 flex-1 rounded-full bg-gray-100" aria-hidden="true">
        <div
          className={`h-full rounded-full transition-all ${styles.bar}`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <span className={`shrink-0 text-xs font-medium ${styles.text}`}>
        {sign}{deviationPct.toFixed(1)}pp
      </span>
    </div>
  );
}
