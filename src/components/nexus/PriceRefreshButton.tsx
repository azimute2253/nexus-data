// ============================================================
// Nexus Data — Manual Price Refresh Button
// "Atualizar precos" button with 1-minute debounce, loading
// state, and error feedback.
// Story 3.5, ADR-005 Obligation 4, ADR-006 (client:idle).
// ============================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { createManualRefreshGuard } from '../../lib/dashboard/refresh.js';

// ---------- Props ----------

export interface PriceRefreshButtonProps {
  /** Supabase Edge Function URL for refresh-prices */
  refreshUrl: string;
  /** Auth token for the Edge Function call */
  authToken: string;
  /** Callback when refresh completes successfully */
  onRefreshComplete?: () => void;
  /** Callback when refresh fails */
  onRefreshError?: (error: string) => void;
}

// ---------- Component ----------

export function PriceRefreshButton({
  refreshUrl,
  authToken,
  onRefreshComplete,
  onRefreshError,
}: PriceRefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const guardRef = useRef(createManualRefreshGuard());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer for debounce
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCooldownTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      const remaining = guardRef.current.getTimeUntilNextMs();
      const secs = Math.ceil(remaining / 1000);
      setCooldownSeconds(secs);
      if (secs <= 0 && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }, 1000);
  }, []);

  const handleRefresh = useCallback(async () => {
    // Debounce check: max 1 manual refresh per minute
    if (!guardRef.current.canRefresh()) {
      return;
    }

    setIsRefreshing(true);
    setError(null);

    try {
      const response = await fetch(refreshUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ trigger: 'manual' }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      guardRef.current.markRefreshed();
      setCooldownSeconds(60);
      startCooldownTimer();
      onRefreshComplete?.();
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : 'Falha ao atualizar precos';
      setError(message);
      onRefreshError?.(message);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshUrl, authToken, onRefreshComplete, onRefreshError, startCooldownTimer]);

  const isDisabled = isRefreshing || cooldownSeconds > 0;

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleRefresh}
        disabled={isDisabled}
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          isDisabled
            ? 'cursor-not-allowed bg-gray-100 text-gray-400'
            : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
        }`}
        aria-label={
          isRefreshing
            ? 'Atualizando precos...'
            : cooldownSeconds > 0
              ? `Aguarde ${cooldownSeconds}s para atualizar novamente`
              : 'Atualizar precos'
        }
        aria-busy={isRefreshing}
      >
        {isRefreshing ? (
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          <svg
            className="h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
            />
          </svg>
        )}
        {isRefreshing
          ? 'Atualizando...'
          : cooldownSeconds > 0
            ? `Aguarde ${cooldownSeconds}s`
            : 'Atualizar precos'}
      </button>

      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
