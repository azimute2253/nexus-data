// ============================================================
// Nexus Data — Aportes Tab Component
// Combines RebalanceCalculator (pre-filled with last contribution)
// and ContributionHistory. All data filtered by wallet_id (ADR-014).
// [Story 15.2, F-030]
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import type { RebalanceResult, Contribution } from '../../lib/nexus/types.js';
import { RebalanceCalculator } from './RebalanceCalculator.js';
import { ContributionHistory } from './ContributionHistory.js';
import { getContributions } from '../../lib/nexus/contributions.js';

// ---------- Props ----------

export interface AportesTabProps {
  /** Active wallet ID for data filtering */
  walletId: string;
  /** Pre-computed rebalance result from server-side data layer */
  initialResult: RebalanceResult | null;
  /** Callback to re-run rebalance with a new contribution amount */
  onCalculate: (contribution: number) => Promise<RebalanceResult>;
  /** Error from initial load */
  initialError?: string | null;
}

// ---------- Constants ----------

const DEFAULT_CONTRIBUTION = 12000;

// ---------- Main component ----------

export function AportesTab({
  walletId,
  initialResult,
  onCalculate,
  initialError = null,
}: AportesTabProps) {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [defaultContribution, setDefaultContribution] = useState(DEFAULT_CONTRIBUTION);

  // Fetch contributions for the active wallet
  const loadContributions = useCallback(async (wid: string) => {
    setIsLoadingHistory(true);
    try {
      const data = await getContributions(wid);
      setContributions(data);

      // Pre-fill with last contribution amount, or default
      if (data.length > 0 && data[0].amount !== null && data[0].amount > 0) {
        setDefaultContribution(data[0].amount);
      } else {
        setDefaultContribution(DEFAULT_CONTRIBUTION);
      }
    } catch {
      setContributions([]);
      setDefaultContribution(DEFAULT_CONTRIBUTION);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Reload when wallet changes
  useEffect(() => {
    loadContributions(walletId);
  }, [walletId, loadContributions]);

  return (
    <div className="space-y-6">
      {/* Calculator section */}
      <RebalanceCalculator
        key={`calc-${walletId}-${defaultContribution}`}
        initialResult={initialResult}
        defaultContribution={defaultContribution}
        onCalculate={onCalculate}
        initialError={initialError}
      />

      {/* History section */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Histórico de Aportes
        </h2>
        <ContributionHistory
          contributions={contributions}
          isLoading={isLoadingHistory}
        />
      </div>
    </div>
  );
}
