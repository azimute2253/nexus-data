import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ============================================================
// Nexus Data — Aportes Tab Component
// Combines RebalanceCalculator (pre-filled with last contribution)
// and ContributionHistory. All data filtered by wallet_id (ADR-014).
// Self-contained: fetches own data and computes rebalance internally.
// [Story 15.2, F-030]
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { RebalanceCalculator } from './RebalanceCalculator.js';
import { ContributionHistory } from './ContributionHistory.js';
import { getContributions } from '../../lib/nexus/contributions.js';
import { getWalletRebalanceRecommendations } from '../../lib/dashboard/wallet-data.js';
import { getAnonClient } from '../../lib/supabase.js';
// ---------- Constants ----------
const DEFAULT_CONTRIBUTION = 12000;
// ---------- Main component ----------
export function AportesTab({ walletId, userId }) {
    const [contributions, setContributions] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [defaultContribution, setDefaultContribution] = useState(DEFAULT_CONTRIBUTION);
    const [initialResult, setInitialResult] = useState(null);
    const [initialError, setInitialError] = useState(null);
    // Compute rebalance result for a given contribution amount
    const handleCalculate = useCallback(async (contribution) => {
        if (!walletId)
            throw new Error('Nenhuma carteira selecionada');
        const client = getAnonClient();
        const result = await getWalletRebalanceRecommendations(client, walletId, contribution);
        if (result.error)
            throw new Error(result.error.message);
        if (!result.data)
            throw new Error('Sem resultado de rebalanceamento');
        return result.data;
    }, [walletId]);
    // Fetch contributions for the active wallet
    const loadData = useCallback(async (wid) => {
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
            }
            catch (err) {
                setInitialError(err instanceof Error ? err.message : 'Erro ao calcular rebalanceamento');
                setInitialResult(null);
            }
        }
        catch {
            setContributions([]);
            setDefaultContribution(DEFAULT_CONTRIBUTION);
        }
        finally {
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
        return (_jsx("div", { className: "flex items-center justify-center h-32 text-gray-400", children: "Selecione uma carteira para ver os aportes" }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx(RebalanceCalculator, { initialResult: initialResult, defaultContribution: defaultContribution, onCalculate: handleCalculate, initialError: initialError }, `calc-${walletId}-${defaultContribution}`), _jsxs("div", { children: [_jsx("h2", { className: "mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500", children: "Hist\u00F3rico de Aportes" }), _jsx(ContributionHistory, { contributions: contributions, isLoading: isLoadingHistory })] })] }));
}
