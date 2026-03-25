// ============================================================
// Nexus Data — Rebalance Calculator Component
// Input for contribution amount + "Calcular" button → hierarchical
// result display (L1 Type → L2 Group → L3 Asset) with expand/collapse.
// Uses client-side rebalance() for < 500ms execution.
// [Story 5.5, ADR-004, ADR-006]
// ============================================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import type {
  RebalanceResult,
  RebalanceTypeResult,
  RebalanceGroupResult,
  L3Result,
} from '../../lib/nexus/types.js';
import {
  formatBrl,
  formatShares,
  isValidContribution,
  parseContribution,
} from '../../lib/dashboard/calculator-utils.js';

// ---------- Props ----------

export interface RebalanceCalculatorProps {
  /** Pre-computed rebalance result from server-side data layer */
  initialResult: RebalanceResult | null;
  /** Default contribution amount in BRL */
  defaultContribution?: number;
  /** Callback to re-run rebalance with a new contribution amount */
  onCalculate: (contribution: number) => Promise<RebalanceResult>;
  /** Error from initial server-side load */
  initialError?: string | null;
}

// ---------- Expand/Collapse chevron ----------

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ---------- L3 Asset Row ----------

function AssetRow({ asset }: { asset: L3Result }) {
  if (asset.shares_to_buy === 0 && asset.allocated_brl === 0) return null;

  return (
    <div className="flex items-center justify-between py-1.5 pl-10 pr-4 text-sm md:pl-14">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
          COMPRAR
        </span>
        <span className="font-medium text-gray-900">{asset.ticker}</span>
        {asset.weight_mode && (
          <span className="text-xs text-gray-400">
            ({asset.weight_mode === 'manual' ? 'manual' : 'questionário'})
          </span>
        )}
      </div>
      <div className="text-right text-xs text-gray-600 md:text-sm">
        <span className="font-medium text-gray-900">
          {asset.shares_to_buy > 0
            ? `${formatShares(asset.shares_to_buy)} cotas`
            : '0 cotas'}
        </span>
        <span className="mx-1.5 text-gray-400">&mdash;</span>
        <span className="font-medium text-green-700">{formatBrl(asset.estimated_cost_brl)}</span>
      </div>
    </div>
  );
}

// ---------- L2 Group Section ----------

function GroupSection({ group, expanded, onToggle }: {
  group: RebalanceGroupResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  const buyableAssets = group.assets.filter((a) => a.shares_to_buy > 0 || a.allocated_brl > 0);

  if (buyableAssets.length === 0 && group.allocated <= 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 py-2 pl-5 pr-4 text-left text-sm hover:bg-gray-50 transition-colors md:pl-7"
        aria-expanded={expanded}
      >
        <Chevron expanded={expanded} />
        <span className="font-medium text-gray-700">{group.name}</span>
        <span className="ml-auto text-xs text-gray-500">{formatBrl(group.spent)}</span>
      </button>

      {expanded && (
        <div className="border-l-2 border-gray-100 ml-7 md:ml-9">
          {buyableAssets.length > 0 ? (
            buyableAssets.map((asset) => (
              <AssetRow key={asset.asset_id} asset={asset} />
            ))
          ) : (
            <p className="py-1.5 pl-10 text-xs text-gray-400 md:pl-14">Nenhuma compra neste grupo</p>
          )}
          {group.remainder > 0.01 && (
            <div className="py-1 pl-10 text-xs text-gray-400 md:pl-14">
              Troco: {formatBrl(group.remainder)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- L1 Type Section ----------

function TypeSection({ type, expandedGroups, onToggleGroup }: {
  type: RebalanceTypeResult;
  expandedGroups: Set<string>;
  onToggleGroup: (groupId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true); // L1 expanded by default

  if (type.allocated <= 0) return null;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-2 bg-gray-50 px-4 py-3 text-left hover:bg-gray-100 transition-colors"
        aria-expanded={expanded}
      >
        <Chevron expanded={expanded} />
        <span className="text-sm font-semibold text-gray-900">{type.name}</span>
        <span className="ml-auto text-sm font-medium text-gray-700">{formatBrl(type.allocated)}</span>
      </button>

      {expanded && (
        <div className="divide-y divide-gray-50">
          {type.groups.map((group) => (
            <GroupSection
              key={group.group_id}
              group={group}
              expanded={expandedGroups.has(group.group_id)}
              onToggle={() => onToggleGroup(group.group_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Loading state ----------

function CalculatingOverlay() {
  return (
    <div className="flex items-center justify-center gap-2 py-8" role="status" aria-label="Calculando rebalanceamento">
      <svg className="h-5 w-5 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span className="text-sm text-gray-600">Calculando...</span>
    </div>
  );
}

// ---------- Error state ----------

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-center" role="alert">
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}

// ---------- Summary bar ----------

function SummaryBar({ result }: { result: RebalanceResult }) {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-4 text-sm md:grid-cols-4">
      <div>
        <dt className="text-xs text-gray-500">Aporte</dt>
        <dd className="font-semibold text-gray-900">{formatBrl(result.contribution)}</dd>
      </div>
      <div>
        <dt className="text-xs text-gray-500">Alocado</dt>
        <dd className="font-semibold text-gray-900">{formatBrl(result.total_allocated)}</dd>
      </div>
      <div>
        <dt className="text-xs text-gray-500">Investido</dt>
        <dd className="font-semibold text-green-700">{formatBrl(result.total_spent)}</dd>
      </div>
      <div>
        <dt className="text-xs text-gray-500">Troco</dt>
        <dd className="font-semibold text-amber-600">{formatBrl(result.total_remainder)}</dd>
      </div>
    </div>
  );
}

// ---------- Main component ----------

export function RebalanceCalculator({
  initialResult,
  defaultContribution = 12000,
  onCalculate,
  initialError = null,
}: RebalanceCalculatorProps) {
  const [inputValue, setInputValue] = useState(defaultContribution.toLocaleString('pt-BR'));
  const [result, setResult] = useState<RebalanceResult | null>(initialResult);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  // Sync with async-loaded initialResult (e.g. when parent fetches after mount)
  useEffect(() => {
    if (initialResult !== null) setResult(initialResult);
  }, [initialResult]);

  useEffect(() => {
    if (initialError !== null) setError(initialError);
  }, [initialError]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [executionTime, setExecutionTime] = useState<number | null>(null);

  const contribution = useMemo(() => {
    return parseContribution(inputValue);
  }, [inputValue]);

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
    setExpandedGroups(new Set());

    const t0 = performance.now();
    try {
      const newResult = await onCalculate(contribution);
      const t1 = performance.now();
      setExecutionTime(t1 - t0);
      setResult(newResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao calcular rebalanceamento');
      setResult(null);
    } finally {
      setIsCalculating(false);
    }
  }, [canCalculate, contribution, onCalculate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && canCalculate) {
        handleCalculate();
      }
    },
    [canCalculate, handleCalculate],
  );

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  return (
    <div className="space-y-4">
      {/* Input section */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <label htmlFor="contribution-input" className="block text-sm font-medium text-gray-700 mb-2">
          Valor do Aporte (R$)
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 text-sm">
                R$
              </span>
              <input
                id="contribution-input"
                type="text"
                inputMode="decimal"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="12.000"
                className={`block w-full rounded-md border py-2.5 pl-9 pr-3 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                  validationMessage
                    ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500'
                }`}
                aria-invalid={!!validationMessage}
                aria-describedby={validationMessage ? 'contribution-error' : undefined}
              />
            </div>
            {validationMessage && (
              <p id="contribution-error" className="mt-1 text-xs text-red-600" role="alert">
                {validationMessage}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleCalculate}
            disabled={!canCalculate}
            className="rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
          >
            Calcular
          </button>
        </div>
      </div>

      {/* Calculating state */}
      {isCalculating && <CalculatingOverlay />}

      {/* Error state */}
      {error && !isCalculating && (
        <ErrorBanner message={error} onRetry={canCalculate ? handleCalculate : undefined} />
      )}

      {/* Results */}
      {result && !isCalculating && !error && (
        <div className="space-y-3">
          {/* Summary */}
          <SummaryBar result={result} />

          {/* Execution time badge */}
          {executionTime !== null && (
            <p className="text-xs text-gray-400 text-right">
              Calculado em {executionTime.toFixed(0)}ms
            </p>
          )}

          {/* Hierarchical results */}
          <div className="space-y-2" role="tree" aria-label="Resultado do rebalanceamento">
            {result.types.map((type) => (
              <TypeSection
                key={type.type_id}
                type={type}
                expandedGroups={expandedGroups}
                onToggleGroup={toggleGroup}
              />
            ))}
          </div>

          {/* Empty state — all types have 0 allocation */}
          {result.types.every((t) => t.allocated <= 0) && (
            <p className="py-8 text-center text-sm text-gray-500">
              Nenhuma ordem de compra gerada. Todas as classes estão acima da meta.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
