// ============================================================
// Nexus Data — Contribution History Component
// Displays a reverse-chronological list of past contributions
// with date, value, and distribution snapshot.
// Filtered by wallet_id (ADR-014).
// [Story 15.2]
// ============================================================

import type { Contribution } from '../../lib/nexus/types.js';
import { formatBrl } from '../../lib/dashboard/calculator-utils.js';

// ---------- Props ----------

export interface ContributionHistoryProps {
  /** Contributions for the active wallet, already sorted DESC by contributed_at */
  contributions: Contribution[];
  /** Whether data is loading */
  isLoading?: boolean;
}

// ---------- Date formatting ----------

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ---------- Distribution snapshot summary ----------

function DistributionSummary({ distribution }: { distribution: unknown }) {
  if (!distribution || typeof distribution !== 'object') return null;

  const result = distribution as {
    total_spent?: number;
    types?: Array<{ name: string; allocated: number }>;
  };

  if (!result.types || result.types.length === 0) return null;

  const allocatedTypes = result.types.filter((t) => t.allocated > 0);
  if (allocatedTypes.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {allocatedTypes.map((t) => (
        <span
          key={t.name}
          className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
        >
          {t.name}: {formatBrl(t.allocated)}
        </span>
      ))}
    </div>
  );
}

// ---------- Loading skeleton ----------

function HistorySkeleton() {
  return (
    <div className="animate-pulse space-y-3" role="status" aria-label="Carregando histórico">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-16 rounded-lg bg-gray-200" />
      ))}
    </div>
  );
}

// ---------- Main component ----------

export function ContributionHistory({
  contributions,
  isLoading = false,
}: ContributionHistoryProps) {
  if (isLoading) return <HistorySkeleton />;

  if (contributions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">
        Nenhum aporte registrado ainda
      </p>
    );
  }

  return (
    <div className="space-y-2" role="list" aria-label="Histórico de aportes">
      {contributions.map((contribution) => (
        <div
          key={contribution.id}
          role="listitem"
          className="flex items-start justify-between rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">
                {contribution.amount !== null ? formatBrl(contribution.amount) : '—'}
              </span>
              <span className="text-xs text-gray-400">
                {formatDate(contribution.contributed_at)}
              </span>
            </div>
            {contribution.distribution !== null && contribution.distribution !== undefined && (
              <DistributionSummary distribution={contribution.distribution} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
