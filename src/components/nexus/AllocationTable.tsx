// ============================================================
// Nexus Data — Allocation Table Component
// Displays portfolio breakdown by asset type with target/current
// allocation, deviation badges, and sortable columns.
// Desktop: HTML table | Mobile (< 768px): card layout.
// [Story 5.2, ADR-006]
// ============================================================

import { useState, useMemo } from 'react';
import type { TypePerformance } from '../../lib/dashboard/types.js';
import {
  sortTypes,
  formatBrl,
  formatPct,
  getStatus,
} from '../../lib/dashboard/allocation-utils.js';
import type { SortKey, SortState, AllocationStatus } from '../../lib/dashboard/allocation-utils.js';
import { DeviationBar } from './DeviationBar.js';

// ---------- Props ----------

export interface AllocationTableProps {
  /** Performance data per asset type from getPerformanceMetrics() */
  types: TypePerformance[];
  /** Total portfolio value in BRL for context */
  totalValueBrl: number;
  /** Whether data is currently loading */
  isLoading?: boolean;
  /** Error message to display instead of data */
  error?: string | null;
  /** Callback for retry on error */
  onRetry?: () => void;
}

// ---------- Status badge ----------

const STATUS_STYLES: Record<AllocationStatus, string> = {
  Overweight: 'bg-red-100 text-red-800',
  Underweight: 'bg-amber-100 text-amber-800',
  Aligned: 'bg-green-100 text-green-800',
};

function StatusBadge({ deviation }: { deviation: number }) {
  const status = getStatus(deviation);
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
      role="status"
      aria-label={`${status}: ${formatPct(deviation)} deviation`}
    >
      {status}
    </span>
  );
}

// ---------- Sort header ----------

function SortHeader({
  label,
  sortKey,
  current,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  current: SortState;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const isActive = current.key === sortKey;
  const arrow = isActive ? (current.dir === 'asc' ? ' ▲' : ' ▼') : '';
  return (
    <th
      className={`cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-800 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
      onClick={() => onSort(sortKey)}
      aria-sort={isActive ? (current.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      role="columnheader"
    >
      {label}{arrow}
    </th>
  );
}

// ---------- Loading skeleton ----------

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-3 p-4" role="status" aria-label="Carregando alocação">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4">
          <div className="h-4 w-24 rounded bg-gray-200" />
          <div className="h-4 w-16 rounded bg-gray-200" />
          <div className="h-4 w-16 rounded bg-gray-200" />
          <div className="h-4 w-16 rounded bg-gray-200" />
          <div className="h-4 w-20 rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

// ---------- Error state ----------

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 p-6 text-center" role="alert">
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          type="button"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}

// ---------- Mobile card ----------

function AllocationCard({ item }: { item: TypePerformance }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">{item.asset_type_name}</span>
        <StatusBadge deviation={item.deviation_pct} />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-gray-500">Meta</dt>
        <dd className="text-right font-medium text-gray-900">{formatPct(item.target_pct)}</dd>
        <dt className="text-gray-500">Atual</dt>
        <dd className="text-right font-medium text-gray-900">{formatPct(item.actual_pct)}</dd>
        <dt className="text-gray-500">Desvio</dt>
        <dd className={`text-right font-medium ${item.deviation_pct > 2 ? 'text-red-600' : item.deviation_pct < -2 ? 'text-amber-600' : 'text-green-600'}`}>
          {item.deviation_pct > 0 ? '+' : ''}{formatPct(item.deviation_pct)}
        </dd>
        <dt className="text-gray-500">Valor</dt>
        <dd className="text-right font-medium text-gray-900">{formatBrl(item.total_value_brl)}</dd>
      </dl>
      <div className="mt-2">
        <DeviationBar deviationPct={item.deviation_pct} />
      </div>
    </div>
  );
}

// ---------- Main component ----------

export function AllocationTable({
  types,
  totalValueBrl,
  isLoading = false,
  error = null,
  onRetry,
}: AllocationTableProps) {
  const [sort, setSort] = useState<SortState>({ key: 'asset_type_name', dir: 'asc' });

  const sorted = useMemo(() => sortTypes(types, sort), [types, sort]);

  function handleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    );
  }

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  return (
    <div>
      {/* Mobile: card layout (< 768px) */}
      <div className="flex flex-col gap-3 md:hidden" role="list" aria-label="Alocação por tipo de ativo">
        {sorted.map((item) => (
          <AllocationCard key={item.asset_type_id} item={item} />
        ))}
      </div>

      {/* Desktop: table layout (>= 768px) */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[600px] table-auto" role="table" aria-label="Alocação por tipo de ativo">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <SortHeader label="Tipo" sortKey="asset_type_name" current={sort} onSort={handleSort} />
              <SortHeader label="Meta %" sortKey="target_pct" current={sort} onSort={handleSort} align="right" />
              <SortHeader label="Atual %" sortKey="actual_pct" current={sort} onSort={handleSort} align="right" />
              <SortHeader label="Desvio" sortKey="deviation_pct" current={sort} onSort={handleSort} align="right" />
              <SortHeader label="Valor (BRL)" sortKey="total_value_brl" current={sort} onSort={handleSort} align="right" />
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500" style={{ minWidth: '140px' }}>Indicador</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((item) => (
              <tr key={item.asset_type_id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.asset_type_name}</td>
                <td className="px-4 py-3 text-right text-sm text-gray-700">{formatPct(item.target_pct)}</td>
                <td className="px-4 py-3 text-right text-sm text-gray-700">{formatPct(item.actual_pct)}</td>
                <td className={`px-4 py-3 text-right text-sm font-medium ${
                  item.deviation_pct > 2 ? 'text-red-600' : item.deviation_pct < -2 ? 'text-amber-600' : 'text-green-600'
                }`}>
                  {item.deviation_pct > 0 ? '+' : ''}{formatPct(item.deviation_pct)}
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-700">{formatBrl(item.total_value_brl)}</td>
                <td className="px-4 py-3">
                  <DeviationBar deviationPct={item.deviation_pct} />
                </td>
                <td className="px-4 py-3 text-right">
                  <StatusBadge deviation={item.deviation_pct} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {types.length === 0 && !isLoading && !error && (
        <p className="py-8 text-center text-sm text-gray-500">Nenhum tipo de ativo encontrado.</p>
      )}
    </div>
  );
}
