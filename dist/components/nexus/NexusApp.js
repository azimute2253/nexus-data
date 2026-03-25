import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ============================================================
// Nexus Data — NexusApp (Root Integration Component)
// Composes: Onboarding | WalletSelector | TabNavigation | Tab content
// [V2 Integration Layer]
// ============================================================
import { useState, useEffect } from 'react';
import { getWallets } from '../../lib/nexus/wallets.js';
import { initSupabase } from '../../lib/supabase.js';
import { NEXUS_ACTIVE_WALLET_KEY } from '../../lib/nexus/constants.js';
import { OnboardingScreen } from './OnboardingScreen.js';
import { WalletSelector } from './WalletSelector.js';
import { WalletManagement } from './WalletManagement.js';
import { TabNavigation } from './TabNavigation.js';
import { DashboardTab } from './DashboardTab.js';
import { AportesTab } from './AportesTab.js';
import { AtivosTab } from './AtivosTab.js';
function readStoredWalletId() {
    if (typeof window === 'undefined')
        return null;
    try {
        return localStorage.getItem(NEXUS_ACTIVE_WALLET_KEY);
    }
    catch {
        return null;
    }
}
// ---------- Component ----------
export function NexusApp({ userId, userEmail, supabaseUrl, supabaseAnonKey }) {
    const [wallets, setWallets] = useState([]);
    const [activeWalletId, setActiveWalletId] = useState(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showManage, setShowManage] = useState(false);
    const [supabaseReady, setSupabaseReady] = useState(false);
    // Initialize Supabase ONLY in browser (useEffect = client-side only)
    // This prevents SSR from trying to create a Supabase client without env vars
    useEffect(() => {
        if (supabaseUrl && supabaseAnonKey) {
            initSupabase(supabaseUrl, supabaseAnonKey);
        }
        setSupabaseReady(true);
    }, [supabaseUrl, supabaseAnonKey]);
    // Read active tab from URL param
    useEffect(() => {
        if (typeof window === 'undefined')
            return;
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab === 'aportes' || tab === 'ativos')
            setActiveTab(tab);
    }, []);
    // Load wallets (only after Supabase is initialized)
    useEffect(() => {
        if (!supabaseReady)
            return;
        setLoading(true);
        getWallets(userId)
            .then((list) => {
            setWallets(list);
            if (list.length > 0) {
                const stored = readStoredWalletId();
                const valid = stored && list.find((w) => w.id === stored);
                setActiveWalletId(valid ? stored : list[0].id);
            }
            else {
                setActiveWalletId(null);
            }
            setLoading(false);
        })
            .catch((err) => {
            console.error('[NexusApp] error loading wallets:', err);
            setError('Erro ao carregar carteiras. Tente recarregar a página.');
            setLoading(false);
        });
    }, [userId, supabaseReady]);
    // Handle wallet switch
    function handleWalletChange(id) {
        setActiveWalletId(id);
        try {
            localStorage.setItem(NEXUS_ACTIVE_WALLET_KEY, id);
        }
        catch { /* ignore */ }
    }
    // Handle tab change (update URL param)
    function handleTabChange(tab) {
        setActiveTab(tab);
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (tab === 'dashboard')
                params.delete('tab');
            else
                params.set('tab', tab);
            const qs = params.toString();
            history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
        }
    }
    // Handle wallets change from WalletManagement (expects Wallet | null for activeWallet)
    function handleWalletsChange(updated, newActiveWallet) {
        setWallets(updated);
        const newActiveId = newActiveWallet?.id ?? null;
        setActiveWalletId(newActiveId);
        if (newActiveId) {
            try {
                localStorage.setItem(NEXUS_ACTIVE_WALLET_KEY, newActiveId);
            }
            catch { /* ignore */ }
        }
        setShowManage(false);
        // If no wallets left, onboarding shows automatically
    }
    // Get the active wallet object from the ID
    const activeWallet = wallets.find((w) => w.id === activeWalletId) ?? null;
    // --- Loading ---
    if (loading) {
        return (_jsx("div", { style: { padding: '2rem', color: 'var(--az-text-muted)' }, children: "Carregando Nexus Data\u2026" }));
    }
    // --- Error ---
    if (error) {
        return (_jsx("div", { style: { padding: '2rem', color: 'var(--az-danger, #e55)' }, children: error }));
    }
    // --- Onboarding: no wallets ---
    // OnboardingScreen only accepts userId; it handles wallet creation + page reload internally
    if (wallets.length === 0 || !activeWalletId) {
        return _jsx(OnboardingScreen, { userId: userId });
    }
    // --- Main app ---
    return (_jsxs("div", { className: "nexus-app", children: [_jsxs("div", { className: "nexus-app__header", children: [_jsx(WalletSelector, { userId: userId, onWalletChange: (wallet) => handleWalletChange(wallet.id), onCreateWallet: () => setShowManage(true) }), wallets.length > 0 && (_jsx("button", { className: "nexus-app__manage-btn", onClick: () => setShowManage(true), title: "Gerenciar carteiras", children: "\u2699\uFE0F" }))] }), showManage && (_jsx(WalletManagement, { wallets: wallets, activeWallet: activeWallet, userId: userId, onWalletsChange: handleWalletsChange })), _jsx(TabNavigation, { activeTab: activeTab, onTabChange: handleTabChange, children: (currentTab) => (_jsxs("div", { className: "nexus-app__content", children: [currentTab === 'dashboard' && (_jsx(DashboardTab, { walletId: activeWalletId, userId: userId })), currentTab === 'aportes' && (_jsx(AportesTab, { walletId: activeWalletId, userId: userId })), currentTab === 'ativos' && (_jsx(AtivosTab, { walletId: activeWalletId, userId: userId }))] })) }), _jsx("style", { children: `
        .nexus-app { display: flex; flex-direction: column; gap: 1rem; }
        .nexus-app__header { display: flex; align-items: center; gap: 0.75rem; }
        .nexus-app__manage-btn {
          background: none; border: 1px solid var(--az-border, #333);
          border-radius: 6px; padding: 0.35rem 0.5rem;
          cursor: pointer; font-size: 1rem; line-height: 1;
          color: var(--az-text-muted);
          transition: border-color 0.15s, color 0.15s;
        }
        .nexus-app__manage-btn:hover { border-color: var(--az-accent, #7c6af7); color: var(--az-text); }
        .nexus-app__content { min-height: 400px; }
      ` })] }));
}
