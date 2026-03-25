// ============================================================
// Nexus Data — Dashboard Tab Content (Portfolio Overview)
// Composes: Dashboard (total + deviations), AllocationChart,
// AllocationTable, PriceRefreshButton, EmptyDashboard.
// All data filtered by active wallet_id (ADR-014).
// Wallet switch triggers full data refresh (ADR-012).
// Self-contained: fetches own data using walletId + userId.
// [Story 15.1, ADR-006, ADR-012, ADR-013, ADR-014]
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import type { PerformanceMetrics, PortfolioSummary } from '../../lib/dashboard/types.js';
import { getWalletDashboardData } from '../../lib/dashboard/wallet-data.js';
import { getAnonClient, getSession } from '../../lib/supabase.js';
import { Dashboard } from './Dashboard.js';
import { AllocationChart } from './AllocationChart.js';
import { AllocationTable } from './AllocationTable.js';
import { PriceRefreshButton } from './PriceRefreshButton.js';
import { EmptyDashboard } from './EmptyDashboard.js';

// ---------- Props ----------

export interface DashboardTabProps {
  /** Active wallet ID from WalletSelector */
  walletId: string | null;
  /** User ID for data filtering */
  userId: string;
  /** Callback to navigate to Ativos tab */
  onNavigateAtivos?: () => void;
}

// ---------- Last refresh timestamp ----------

function LastRefreshTimestamp({ fetchedAt }: { fetchedAt: string | null }) {
  if (!fetchedAt) return null;

  const date = new Date(fetchedAt);
  const formatted = date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <p className="text-xs text-gray-400">
      Última atualização: {formatted}
    </p>
  );
}

// ---------- Loading skeleton ----------

function DashboardTabSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-4 md:p-6" role="status" aria-label="Carregando dashboard">
      {/* Portfolio header skeleton */}
      <div className="rounded-lg bg-gray-200 p-6">
        <div className="h-4 w-32 rounded bg-gray-300" />
        <div className="mt-2 h-8 w-48 rounded bg-gray-300" />
      </div>
      {/* Chart skeleton */}
      <div className="flex flex-col gap-4 rounded-lg bg-gray-200 p-6 md:flex-row">
        <div className="mx-auto h-48 w-48 rounded-full bg-gray-300" />
        <div className="mx-auto h-48 w-48 rounded-full bg-gray-300" />
      </div>
      {/* Table skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-gray-200" />
        ))}
      </div>
    </div>
  );
}

// ---------- Main component ----------

export function DashboardTab({
  walletId,
  userId,
  onNavigateAtivos,
}: DashboardTabProps) {
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshUrl, setRefreshUrl] = useState<string>('');
  const [authToken, setAuthToken] = useState<string>('');

  // Build refresh URL and auth token from Supabase client
  useEffect(() => {
    async function initRefreshConfig() {
      try {
        const client = getAnonClient();
        // Extract Supabase URL from the client's internal config
        const url = (client as unknown as { supabaseUrl?: string }).supabaseUrl;
        if (url) {
          setRefreshUrl(`${url}/functions/v1/refresh-prices`);
        }
        // Get auth token from session
        const session = await getSession();
        if (session?.access_token) {
          setAuthToken(session.access_token);
        }
      } catch {
        // Silently fail - price refresh will be disabled
      }
    }
    initRefreshConfig();
  }, []);

  const fetchData = useCallback(async () => {
    if (!walletId) return;

    setIsLoading(true);
    setError(null);

    try {
      const client = getAnonClient();
      const result = await getWalletDashboardData(client, walletId);

      if (result.portfolio.error) {
        setError(result.portfolio.error.message);
        setPerformance(null);
        setPortfolio(null);
        return;
      }

      if (result.performance.error) {
        setError(result.performance.error.message);
        setPerformance(null);
        setPortfolio(null);
        return;
      }

      setPortfolio(result.portfolio.data);
      setPerformance(result.performance.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dashboard');
      setPerformance(null);
      setPortfolio(null);
    } finally {
      setIsLoading(false);
    }
  }, [walletId]);

  // Fetch on mount and when wallet changes (AC6)
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // No wallet selected
  if (!walletId) {
    return (
      <div className="p-4 md:p-6">
        <EmptyDashboard onNavigateAtivos={onNavigateAtivos} />
      </div>
    );
  }

  // Loading state
  if (isLoading) return <DashboardTabSkeleton />;

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 p-6 text-center" role="alert">
        <p className="text-sm text-red-700">{error}</p>
        <button
          onClick={fetchData}
          className="min-h-[44px] min-w-[44px] rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          type="button"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // Empty state (AC5): wallet has no asset types
  const isEmpty = !performance || performance.types.length === 0;
  if (isEmpty) {
    return (
      <div className="p-4 md:p-6">
        <EmptyDashboard onNavigateAtivos={onNavigateAtivos} />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6" data-testid="dashboard-tab">
      {/* AC1: Total consolidated value + top deviations */}
      <Dashboard
        performance={performance}
      />

      {/* AC1: Price refresh button + last refresh timestamp */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {refreshUrl && authToken && (
          <PriceRefreshButton
            refreshUrl={refreshUrl}
            authToken={authToken}
            onRefreshComplete={fetchData}
          />
        )}
        <LastRefreshTimestamp fetchedAt={portfolio?.fetched_at ?? null} />
      </div>

      {/* AC4: Allocation chart — current vs target pie/donut */}
      <AllocationChart
        types={performance.types}
        totalValueBrl={performance.total_value_brl}
      />

      {/* AC1: Allocation table with deviation indicators */}
      <AllocationTable
        types={performance.types}
        totalValueBrl={performance.total_value_brl}
      />
    </div>
  );
}
