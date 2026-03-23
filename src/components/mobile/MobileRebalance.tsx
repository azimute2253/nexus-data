// ============================================================
// Nexus Data — Mobile Rebalance Component
// Mobile-optimized 2-tap rebalance flow: input aporte → tap
// "Calcular" → bottom sheet with buy/sell order cards.
// Numeric keyboard via inputmode="decimal", thumb-friendly
// button (min 44x44px), card font >= 14px, line-height >= 1.4.
// [Story 8.2, ADR-006]
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import type { RebalanceResult } from '../../lib/nexus/types.js';
import {
  formatBrl,
  formatShares,
  isValidContribution,
  parseContribution,
  flattenBuyOrders,
  countBuyOrders,
} from '../../lib/dashboard/calculator-utils.js';
import { OrderBottomSheet } from './OrderBottomSheet.js';

// ---------- Props ----------

export interface MobileRebalanceProps {
  /** Pre-computed rebalance result from server-side data layer */
  initialResult: RebalanceResult | null;
  /** Default contribution amount in BRL */
  defaultContribution?: number;
  /** Callback to re-run rebalance with a new contribution amount */
  onCalculate: (contribution: number) => Promise<RebalanceResult>;
  /** Error from initial server-side load */
  initialError?: string | null;
}

// ---------- Main component ----------

export function MobileRebalance({
  initialResult,
  defaultContribution = 12000,
  onCalculate,
  initialError = null,
}: MobileRebalanceProps) {
  const [inputValue, setInputValue] = useState(defaultContribution.toLocaleString('pt-BR'));
  const [result, setResult] = useState<RebalanceResult | null>(initialResult);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [sheetOpen, setSheetOpen] = useState(false);

  const contribution = useMemo(() => parseContribution(inputValue), [inputValue]);
  const isValid = useMemo(() => isValidContribution(inputValue), [inputValue]);

  const validationMessage = useMemo(() => {
    if (inputValue === '') return null;
    if (!isValid) return 'Digite um valor numérico válido (positivo)';
    if (contribution === 0) return 'O aporte deve ser maior que zero';
    return null;
  }, [inputValue, isValid, contribution]);

  const canCalculate = isValid && contribution > 0 && !isCalculating;

  const handleCalculate = useCallback(async () => {
    if (!canCalculate) return;

    setIsCalculating(true);
    setError(null);

    try {
      const newResult = await onCalculate(contribution);
      setResult(newResult);
      setSheetOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao calcular rebalanceamento');
      setResult(null);
    } finally {
      setIsCalculating(false);
    }
  }, [canCalculate, contribution, onCalculate]);

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      {/* Input section — always above the fold */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label
          htmlFor="mobile-contribution-input"
          className="mb-2 block text-base font-medium text-gray-700"
          style={{ fontSize: '16px', lineHeight: '1.4' }}
        >
          Valor do Aporte (R$)
        </label>

        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500"
            style={{ fontSize: '16px' }}
          >
            R$
          </span>
          <input
            id="mobile-contribution-input"
            type="text"
            inputMode="decimal"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="12.000"
            className={`block w-full rounded-lg border py-3 pl-10 pr-4 text-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
              validationMessage
                ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500'
            }`}
            style={{ fontSize: '18px' }}
            aria-invalid={!!validationMessage}
            aria-describedby={validationMessage ? 'mobile-contribution-error' : undefined}
          />
        </div>

        {validationMessage && (
          <p
            id="mobile-contribution-error"
            className="mt-2 text-sm text-red-600"
            role="alert"
            style={{ fontSize: '14px', lineHeight: '1.4' }}
          >
            {validationMessage}
          </p>
        )}

        {/* Thumb-friendly "Calcular" button — min 44x44px */}
        <button
          type="button"
          onClick={handleCalculate}
          disabled={!canCalculate}
          className="mt-4 w-full rounded-lg bg-blue-600 font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 active:bg-blue-800"
          style={{ minHeight: '48px', minWidth: '44px', fontSize: '16px' }}
        >
          {isCalculating ? (
            <span className="inline-flex items-center gap-2">
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Calculando...
            </span>
          ) : (
            'Calcular'
          )}
        </button>
      </div>

      {/* Error state */}
      {error && !isCalculating && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
          <p className="text-red-700" style={{ fontSize: '14px', lineHeight: '1.4' }}>
            {error}
          </p>
          {canCalculate && (
            <button
              type="button"
              onClick={handleCalculate}
              className="mt-3 w-full rounded-lg bg-red-600 py-3 font-medium text-white hover:bg-red-700"
              style={{ minHeight: '44px', fontSize: '14px' }}
            >
              Tentar novamente
            </button>
          )}
        </div>
      )}

      {/* Bottom sheet with orders */}
      {result && !isCalculating && !error && (
        <OrderBottomSheet
          result={result}
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
        />
      )}

      {/* Peek summary when sheet is closed but result exists */}
      {result && !sheetOpen && !isCalculating && !error && (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm text-left transition-colors active:bg-gray-50"
          style={{ minHeight: '44px' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900" style={{ fontSize: '16px', lineHeight: '1.4' }}>
                {countBuyOrders(result)} ordens de compra
              </p>
              <p className="text-gray-500" style={{ fontSize: '14px', lineHeight: '1.4' }}>
                Total: {formatBrl(result.total_spent)}
              </p>
            </div>
            <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </div>
        </button>
      )}
    </div>
  );
}
