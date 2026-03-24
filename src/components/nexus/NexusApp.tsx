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

type Tab = 'dashboard' | 'aportes' | 'ativos';

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

  // Handle wallets change from WalletManagement
  function handleWalletsChange(updated: Wallet[], newActive: string | null) {
    setWallets(updated);
    setActiveWalletId(newActive);
    if (newActive) {
      try { localStorage.setItem(NEXUS_ACTIVE_WALLET_KEY, newActive); } catch { /* ignore */ }
    }
    setShowManage(false);
    // If no wallets left, onboarding shows automatically
  }

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
  if (wallets.length === 0 || !activeWalletId) {
    return (
      <OnboardingScreen
        userId={userId}
        onWalletCreated={(wallet) => {
          setWallets([wallet]);
          setActiveWalletId(wallet.id);
          try { localStorage.setItem(NEXUS_ACTIVE_WALLET_KEY, wallet.id); } catch { /* ignore */ }
        }}
      />
    );
  }

  // --- Main app ---
  return (
    <div className="nexus-app">
      {/* Wallet selector + manage button */}
      <div className="nexus-app__header">
        <WalletSelector
          wallets={wallets}
          activeWalletId={activeWalletId}
          onWalletChange={handleWalletChange}
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
          activeWalletId={activeWalletId}
          userId={userId}
          onWalletsChange={handleWalletsChange}
          onClose={() => setShowManage(false)}
        />
      )}

      {/* Tabs */}
      <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Tab content */}
      <div className="nexus-app__content">
        {activeTab === 'dashboard' && (
          <DashboardTab walletId={activeWalletId} userId={userId} />
        )}
        {activeTab === 'aportes' && (
          <AportesTab walletId={activeWalletId} userId={userId} />
        )}
        {activeTab === 'ativos' && (
          <AtivosTab walletId={activeWalletId} userId={userId} />
        )}
      </div>

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
