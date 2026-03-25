// ============================================================
// Nexus Data — NexusApp (Root Integration Component)
// Composes: Onboarding | WalletSelector | TabNavigation | Tab content
// [V2 Integration Layer]
// ============================================================

import { useState, useEffect } from 'react';
import type { Wallet } from '../../lib/nexus/types.js';
import { getWallets } from '../../lib/nexus/wallets.js';
import { initSupabase } from '../../lib/supabase.js';
import { NEXUS_ACTIVE_WALLET_KEY } from '../../lib/nexus/constants.js';
import { OnboardingScreen } from './OnboardingScreen.js';
import { WalletSelector } from './WalletSelector.js';
import { WalletManagement } from './WalletManagement.js';
import type { TabId } from './TabNavigation.js';
import { TabNavigation } from './TabNavigation.js';
import { DashboardTab } from './DashboardTab.js';
import { AportesTab } from './AportesTab.js';
import { AtivosTab } from './AtivosTab.js';

// ---------- Types ----------

export interface NexusAppProps {
  /** User ID from Astro server-side */
  userId: string;
  /** Email for display */
  userEmail: string;
  /** Supabase project URL (pass from import.meta.env.PUBLIC_SUPABASE_URL) */
  supabaseUrl?: string;
  /** Supabase anon key (pass from import.meta.env.PUBLIC_SUPABASE_ANON_KEY) */
  supabaseAnonKey?: string;
}

// Use TabId from TabNavigation for type alignment
type Tab = TabId;

function readStoredWalletId(): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(NEXUS_ACTIVE_WALLET_KEY); } catch { return null; }
}

// ---------- Component ----------

export function NexusApp({ userId, userEmail, supabaseUrl, supabaseAnonKey }: NexusAppProps) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'aportes' || tab === 'ativos') setActiveTab(tab);
  }, []);

  // Load wallets (only after Supabase is initialized)
  useEffect(() => {
    if (!supabaseReady) return;
    setLoading(true);
    getWallets(userId)
      .then((list) => {
        setWallets(list);
        if (list.length > 0) {
          const stored = readStoredWalletId();
          const valid = stored && list.find((w) => w.id === stored);
          setActiveWalletId(valid ? stored : list[0].id);
        } else {
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
  function handleWalletChange(id: string) {
    setActiveWalletId(id);
    try { localStorage.setItem(NEXUS_ACTIVE_WALLET_KEY, id); } catch { /* ignore */ }
  }

  // Handle tab change (update URL param)
  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (tab === 'dashboard') params.delete('tab');
      else params.set('tab', tab);
      const qs = params.toString();
      history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
    }
  }

  // Handle wallets change from WalletManagement (expects Wallet | null for activeWallet)
  function handleWalletsChange(updated: Wallet[], newActiveWallet: Wallet | null) {
    setWallets(updated);
    const newActiveId = newActiveWallet?.id ?? null;
    setActiveWalletId(newActiveId);
    if (newActiveId) {
      try { localStorage.setItem(NEXUS_ACTIVE_WALLET_KEY, newActiveId); } catch { /* ignore */ }
    }
    setShowManage(false);
    // If no wallets left, onboarding shows automatically
  }

  // Get the active wallet object from the ID
  const activeWallet = wallets.find((w) => w.id === activeWalletId) ?? null;

  // --- Loading ---
  if (loading) {
    return (
      <div style={{ padding: '2rem', color: 'var(--az-text-muted)' }}>
        Carregando Nexus Data…
      </div>
    );
  }

  // --- Error ---
  if (error) {
    return (
      <div style={{ padding: '2rem', color: 'var(--az-danger, #e55)' }}>
        {error}
      </div>
    );
  }

  // --- Onboarding: no wallets ---
  // OnboardingScreen only accepts userId; it handles wallet creation + page reload internally
  if (wallets.length === 0 || !activeWalletId) {
    return <OnboardingScreen userId={userId} />;
  }

  // --- Main app ---
  return (
    <div className="nexus-app">
      {/* Wallet selector + manage button */}
      <div className="nexus-app__header">
        <WalletSelector
          userId={userId}
          onWalletChange={(wallet) => handleWalletChange(wallet.id)}
          onCreateWallet={() => setShowManage(true)}
        />
        {wallets.length > 0 && (
          <button
            className="nexus-app__manage-btn"
            onClick={() => setShowManage(true)}
            title="Gerenciar carteiras"
          >
            ⚙️
          </button>
        )}
      </div>

      {/* Wallet management modal */}
      {showManage && (
        <WalletManagement
          wallets={wallets}
          activeWallet={activeWallet}
          userId={userId}
          onWalletsChange={handleWalletsChange}
        />
      )}

      {/* Tabs + Tab content (TabNavigation uses render prop pattern) */}
      <TabNavigation activeTab={activeTab} onTabChange={handleTabChange}>
        {(currentTab) => (
          <div className="nexus-app__content">
            {currentTab === 'dashboard' && (
              <DashboardTab walletId={activeWalletId} userId={userId} />
            )}
            {currentTab === 'aportes' && (
              <AportesTab walletId={activeWalletId} userId={userId} />
            )}
            {currentTab === 'ativos' && (
              <AtivosTab walletId={activeWalletId} userId={userId} />
            )}
          </div>
        )}
      </TabNavigation>

      <style>{`
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
      `}</style>
    </div>
  );
}
