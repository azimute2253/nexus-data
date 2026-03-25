// ============================================================
// Nexus Data — Aportes Tab Component
// Combines RebalanceCalculator (pre-filled with last contribution)
// and ContributionHistory. All data filtered by wallet_id (ADR-014).
// Self-contained: fetches own data and computes rebalance internally.
// [Story 15.2, F-030]
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import type { RebalanceResult, Contribution } from '../../lib/nexus/types.js';
import { RebalanceCalculator } from './RebalanceCalculator.js';
import { ContributionHistory } from './ContributionHistory.js';
import { getContributions } from '../../lib/nexus/contributions.js';
import { getWalletRebalanceRecommendations } from '../../lib/dashboard/wallet-data.js';
import { getAnonClient } from '../../lib/supabase.js';

// ---------- Props ----------

export interface AportesTabProps {
  /** Active wallet ID for data filtering */
  walletId: string | null;
  /** User ID for data filtering */
  userId: string;
}

// ---------- Constants ----------

const DEFAULT_CONTRIBUTION = 12000;

// ---------- Main component ----------

export function AportesTab({ walletId, userId }: AportesTabProps) {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [defaultContribution, setDefaultContribution] = useState(DEFAULT_CONTRIBUTION);
  const [initialResult, setInitialResult] = useState<RebalanceResult | null>(null);
  const [initialError, setInitialError] = useState<string | null>(null);

  // Compute rebalance result for a given contribution amount
  const handleCalculate = useCallback(async (contribution: number): Promise<RebalanceResult> => {
    if (!walletId) throw new Error('Nenhuma carteira selecionada');
    const client = getAnonClient();
    const result = await getWalletRebalanceRecommendations(client, walletId, contribution);
    if (result.error) throw new Error(result.error.message);
    if (!result.data) throw new Error('Sem resultado de rebalanceamento');
    return result.data;
  }, [walletId]);

  // Fetch contributions for the active wallet
  const loadData = useCallback(async (wid: string) => {
    setIsLoadingHistory(true);
    setInitialError(null);
    try {
      const data = await getContributions(wid);
      setContributions(data);

      // Pre-fill with last contribution amount, or default
      const lastAmount = data.length > 0 && data[0].amount !== null && data[0].amount > 0
        ? data[0].amount
        : DEFAULT_CONTRIBUTION;
      setDefaultContribution(lastAmount);

      // Pre-compute initial rebalance result
      try {
        const result = await handleCalculate(lastAmount);
        setInitialResult(result);
      } catch (err) {
        setInitialError(err instanceof Error ? err.message : 'Erro ao calcular rebalanceamento');
        setInitialResult(null);
      }
    } catch {
      setContributions([]);
      setDefaultContribution(DEFAULT_CONTRIBUTION);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [handleCalculate]);

  // Reload when wallet changes
  useEffect(() => {
    if (!walletId) {
      setContributions([]);
      setInitialResult(null);
      setIsLoadingHistory(false);
      return;
    }
    loadData(walletId);
  }, [walletId, loadData]);

  if (!walletId) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400">
        Selecione uma carteira para ver os aportes
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Calculator section */}
      <RebalanceCalculator
        key={`calc-${walletId}-${defaultContribution}`}
        initialResult={initialResult}
        defaultContribution={defaultContribution}
        onCalculate={handleCalculate}
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
