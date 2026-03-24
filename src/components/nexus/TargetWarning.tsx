// ============================================================
// Nexus Data — Target Percentage Warning Component
// Displays a warning when target % sums deviate from 100%.
// Non-blocking: visual indicator only (AC9, AC10).
// [Story 15.3]
// ============================================================

export interface TargetWarningProps {
  /** Current sum of target percentages */
  sum: number;
  /** Label for the context (e.g. "classes de ativo", "grupos em Ações BR") */
  label: string;
  /** Tolerance in percentage points before showing warning (default: 0 for classes, 1 for groups) */
  tolerancePp?: number;
}

export function TargetWarning({ sum, label, tolerancePp = 0 }: TargetWarningProps) {
  const diff = Math.abs(sum - 100);
  if (diff <= tolerancePp) return null;

  const direction = sum < 100 ? 'abaixo' : 'acima';

  return (
    <div
      className="mt-1 flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700"
      role="alert"
      data-testid="target-warning"
    >
      <svg
        className="h-3.5 w-3.5 flex-shrink-0"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
      <span>
        Soma de target % {label}: <strong>{sum.toFixed(1)}%</strong> ({direction} de 100%)
      </span>
    </div>
  );
}
