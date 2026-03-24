// ============================================================
// Nexus Data — Wallet Selector Component
// Dropdown in app header to switch between wallets.
// Single wallet → static text. Multiple → dropdown.
// Active wallet persisted in localStorage (ADR-012).
// Resolution: localStorage → validate against server → fallback to first.
// [Story 12.1, ADR-012]
// ============================================================

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import type { Wallet } from '../../lib/nexus/types.js';
import { getWallets } from '../../lib/nexus/wallets.js';

// ---------- Constants ----------

import { NEXUS_ACTIVE_WALLET_KEY as STORAGE_KEY } from '../../lib/nexus/constants';

// ---------- localStorage helpers ----------

function readStoredWalletId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredWalletId(walletId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, walletId);
  } catch {
    // Silently ignore (private browsing, full storage, etc.)
  }
}

// ---------- Resolve active wallet ----------

function resolveActiveWallet(wallets: Wallet[], storedId: string | null): Wallet | null {
  if (wallets.length === 0) return null;
  if (storedId) {
    const found = wallets.find((w) => w.id === storedId);
    if (found) return found;
  }
  return wallets[0];
}

// ---------- SVG Icons ----------

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconWallet({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconPlus({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

// ---------- Props ----------

export interface WalletSelectorProps {
  /** User ID to fetch wallets for */
  userId: string;
  /** Callback when active wallet changes */
  onWalletChange?: (wallet: Wallet) => void;
  /** Callback for "Nova carteira" button */
  onCreateWallet?: () => void;
}

// ---------- Main component ----------

export function WalletSelector({
  userId,
  onWalletChange,
  onCreateWallet,
}: WalletSelectorProps) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [activeWallet, setActiveWallet] = useState<Wallet | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Fetch wallets and resolve active ──

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const data = await getWallets(userId);
        if (cancelled) return;

        setWallets(data);

        const storedId = readStoredWalletId();
        const resolved = resolveActiveWallet(data, storedId);

        if (resolved) {
          setActiveWallet(resolved);
          writeStoredWalletId(resolved.id);
          onWalletChange?.(resolved);
        }
      } catch {
        // Silently handle — component will show loading/empty state
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
    // onWalletChange intentionally omitted to avoid re-fetch loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Close dropdown on outside click ──

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // ── Close dropdown on Escape ──

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  // ── Switch wallet ──

  const handleSelect = useCallback(
    (wallet: Wallet) => {
      setActiveWallet(wallet);
      writeStoredWalletId(wallet.id);
      setIsOpen(false);
      onWalletChange?.(wallet);
    },
    [onWalletChange],
  );

  // ── Loading state ──

  if (isLoading) {
    return (
      <div className="flex items-center gap-2" role="status" aria-label="Carregando carteiras">
        <div className="h-5 w-5 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  // ── No wallets ──

  if (wallets.length === 0 || !activeWallet) {
    return (
      <div className="flex items-center gap-2">
        {onCreateWallet && (
          <button
            type="button"
            onClick={onCreateWallet}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <IconPlus className="h-4 w-4" />
            Nova carteira
          </button>
        )}
      </div>
    );
  }

  // ── Single wallet → static text ──

  if (wallets.length === 1) {
    return (
      <div className="flex items-center gap-2" data-testid="wallet-selector-static">
        <IconWallet className="h-5 w-5 text-gray-500" />
        <span className="text-sm font-medium text-gray-900">{activeWallet.name}</span>
        {onCreateWallet && (
          <button
            type="button"
            onClick={onCreateWallet}
            className="ml-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Nova carteira"
          >
            <IconPlus className="h-3.5 w-3.5" />
            Nova carteira
          </button>
        )}
      </div>
    );
  }

  // ── Multiple wallets → dropdown ──

  return (
    <div ref={dropdownRef} className="relative" data-testid="wallet-selector-dropdown">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Selecionar carteira"
      >
        <IconWallet className="h-4 w-4 text-gray-500" />
        <span className="max-w-[160px] truncate">{activeWallet.name}</span>
        <IconChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className="absolute left-0 z-50 mt-1 w-56 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
          role="listbox"
          aria-label="Carteiras disponíveis"
        >
          {wallets.map((wallet) => {
            const isActive = wallet.id === activeWallet.id;
            return (
              <button
                key={wallet.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => handleSelect(wallet)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-50 font-medium text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {isActive ? (
                  <IconCheck className="h-4 w-4 shrink-0 text-blue-600" />
                ) : (
                  <span className="h-4 w-4 shrink-0" />
                )}
                <span className="truncate">{wallet.name}</span>
              </button>
            );
          })}

          {/* Divider + Nova carteira */}
          {onCreateWallet && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onCreateWallet();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50"
              >
                <IconPlus className="h-4 w-4 shrink-0" />
                <span>Nova carteira</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
