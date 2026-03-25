import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
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
import { getWalletDashboardData } from '../../lib/dashboard/wallet-data.js';
import { getAnonClient, getSession } from '../../lib/supabase.js';
import { Dashboard } from './Dashboard.js';
import { AllocationChart } from './AllocationChart.js';
import { AllocationTable } from './AllocationTable.js';
import { PriceRefreshButton } from './PriceRefreshButton.js';
import { EmptyDashboard } from './EmptyDashboard.js';
// ---------- Last refresh timestamp ----------
function LastRefreshTimestamp({ fetchedAt }) {
    if (!fetchedAt)
        return null;
    const date = new Date(fetchedAt);
    const formatted = date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
    return (_jsxs("p", { className: "text-xs text-gray-400", children: ["\u00DAltima atualiza\u00E7\u00E3o: ", formatted] }));
}
// ---------- Loading skeleton ----------
function DashboardTabSkeleton() {
    return (_jsxs("div", { className: "animate-pulse space-y-6 p-4 md:p-6", role: "status", "aria-label": "Carregando dashboard", children: [_jsxs("div", { className: "rounded-lg bg-gray-200 p-6", children: [_jsx("div", { className: "h-4 w-32 rounded bg-gray-300" }), _jsx("div", { className: "mt-2 h-8 w-48 rounded bg-gray-300" })] }), _jsxs("div", { className: "flex flex-col gap-4 rounded-lg bg-gray-200 p-6 md:flex-row", children: [_jsx("div", { className: "mx-auto h-48 w-48 rounded-full bg-gray-300" }), _jsx("div", { className: "mx-auto h-48 w-48 rounded-full bg-gray-300" })] }), _jsx("div", { className: "space-y-3", children: Array.from({ length: 4 }).map((_, i) => (_jsx("div", { className: "h-14 rounded-lg bg-gray-200" }, i))) })] }));
}
// ---------- Main component ----------
export function DashboardTab({ walletId, userId, onNavigateAtivos, }) {
    const [performance, setPerformance] = useState(null);
    const [portfolio, setPortfolio] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshUrl, setRefreshUrl] = useState('');
    const [authToken, setAuthToken] = useState('');
    // Build refresh URL and auth token from Supabase client
    useEffect(() => {
        async function initRefreshConfig() {
            try {
                const client = getAnonClient();
                // Extract Supabase URL from the client's internal config
                const url = client.supabaseUrl;
                if (url) {
                    setRefreshUrl(`${url}/functions/v1/refresh-prices`);
                }
                // Get auth token from session
                const session = await getSession();
                if (session?.access_token) {
                    setAuthToken(session.access_token);
                }
            }
            catch {
                // Silently fail - price refresh will be disabled
            }
        }
        initRefreshConfig();
    }, []);
    const fetchData = useCallback(async () => {
        if (!walletId)
            return;
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
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar dashboard');
            setPerformance(null);
            setPortfolio(null);
        }
        finally {
            setIsLoading(false);
        }
    }, [walletId]);
    // Fetch on mount and when wallet changes (AC6)
    useEffect(() => {
        fetchData();
    }, [fetchData]);
    // No wallet selected
    if (!walletId) {
        return (_jsx("div", { className: "p-4 md:p-6", children: _jsx(EmptyDashboard, { onNavigateAtivos: onNavigateAtivos }) }));
    }
    // Loading state
    if (isLoading)
        return _jsx(DashboardTabSkeleton, {});
    // Error state
    if (error) {
        return (_jsxs("div", { className: "flex flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 p-6 text-center", role: "alert", children: [_jsx("p", { className: "text-sm text-red-700", children: error }), _jsx("button", { onClick: fetchData, className: "min-h-[44px] min-w-[44px] rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2", type: "button", children: "Tentar novamente" })] }));
    }
    // Empty state (AC5): wallet has no asset types
    const isEmpty = !performance || performance.types.length === 0;
    if (isEmpty) {
        return (_jsx("div", { className: "p-4 md:p-6", children: _jsx(EmptyDashboard, { onNavigateAtivos: onNavigateAtivos }) }));
    }
    return (_jsxs("div", { className: "space-y-6 p-4 md:p-6", "data-testid": "dashboard-tab", children: [_jsx(Dashboard, { performance: performance }), _jsxs("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", children: [refreshUrl && authToken && (_jsx(PriceRefreshButton, { refreshUrl: refreshUrl, authToken: authToken, onRefreshComplete: fetchData })), _jsx(LastRefreshTimestamp, { fetchedAt: portfolio?.fetched_at ?? null })] }), _jsx(AllocationChart, { types: performance.types, totalValueBrl: performance.total_value_brl }), _jsx(AllocationTable, { types: performance.types, totalValueBrl: performance.total_value_brl })] }));
}
