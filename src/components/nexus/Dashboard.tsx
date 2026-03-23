// ============================================================
// Nexus Data — Dashboard Component
// Mobile-optimized overview composing AllocationChart, AllocationTable,
// and a summary header showing total portfolio value + top deviations.
// Total value and top 5 deviations are visible without scroll on mobile.
// Desktop: standard layout | Mobile (< 768px): card-based, stacked.
// [Story 8.1, ADR-006]
// ============================================================

import { useMemo } from 'react';
import type { TypePerformance, PerformanceMetrics } from '../../lib/dashboard/types.js';
import { formatBrl, formatPct, getStatus } from '../../lib/dashboard/allocation-utils.js';
import { DeviationBar } from './DeviationBar.js';

// ---------- Props ----------

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

// ---------- Loading skeleton ----------

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4" role="status" aria-label="Carregando dashboard">
      <div className="rounded-lg bg-gray-200 p-6">
        <div className="h-8 w-40 rounded bg-gray-300" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-gray-200" />
        ))}
      </div>
    </div>
  );
}

// ---------- Error state ----------

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 p-6 text-center" role="alert">
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="min-h-[44px] min-w-[44px] rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          type="button"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}

// ---------- Portfolio total header ----------

function PortfolioHeader({ totalValueBrl }: { totalValueBrl: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
        Valor Total do Portfólio
      </p>
      <p className="mt-1 text-2xl font-bold text-gray-900 md:text-3xl">
        {formatBrl(totalValueBrl)}
      </p>
    </div>
  );
}

// ---------- Top deviations (mobile-first: visible without scroll) ----------

const STATUS_STYLES: Record<string, string> = {
  Overweight: 'bg-red-100 text-red-800',
  Underweight: 'bg-amber-100 text-amber-800',
  Aligned: 'bg-green-100 text-green-800',
};

function DeviationCard({ item }: { item: TypePerformance }) {
  const status = getStatus(item.deviation_pct);
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-gray-900">{item.asset_type_name}</span>
          <span
            className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
            role="status"
          >
            {status}
          </span>
        </div>
        <div className="mt-1">
          <DeviationBar deviationPct={item.deviation_pct} />
        </div>
      </div>
      <span className={`ml-3 shrink-0 text-sm font-semibold ${
        item.deviation_pct > 2 ? 'text-red-600' : item.deviation_pct < -2 ? 'text-amber-600' : 'text-green-600'
      }`}>
        {item.deviation_pct > 0 ? '+' : ''}{formatPct(item.deviation_pct)}
      </span>
    </div>
  );
}

// ---------- Main component ----------

export function Dashboard({
  performance,
  isLoading = false,
  error = null,
  onRetry,
}: DashboardProps) {
  // Top 5 deviations sorted by absolute deviation (largest first)
  const topDeviations = useMemo(() => {
    if (!performance) return [];
    return [...performance.types]
      .sort((a, b) => Math.abs(b.deviation_pct) - Math.abs(a.deviation_pct))
      .slice(0, 5);
  }, [performance]);

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!performance) return null;

  return (
    <div className="space-y-4">
      {/* Total portfolio value — always visible at top */}
      <PortfolioHeader totalValueBrl={performance.total_value_brl} />

      {/* Top deviations — visible without scroll on mobile */}
      {topDeviations.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Maiores Desvios
          </h2>
          <div className="flex flex-col gap-2">
            {topDeviations.map((item) => (
              <DeviationCard key={item.asset_type_id} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
