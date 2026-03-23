// ============================================================
// Nexus Data — Asset Table Component
// Displays individual assets with ticker, quantity, price, value.
// Desktop: HTML table with sortable columns.
// Mobile (< 768px): card layout with touch-friendly spacing.
// Null/missing data displays "—" placeholder.
// [Story 8.1, ADR-006]
// ============================================================

import { useState, useMemo } from 'react';
import type { Asset, PriceCache } from '../../lib/nexus/types.js';
import { formatBrl } from '../../lib/dashboard/allocation-utils.js';

// ---------- Props ----------

export interface AssetTableProps {
  /** Active assets to display */
  assets: Asset[];
  /** Price cache entries keyed by ticker for price lookup */
  prices: Map<string, PriceCache>;
  /** USD/BRL exchange rate for currency conversion */
  exchangeRateBrl: number | null;
  /** Whether data is currently loading */
  isLoading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Callback for retry on error */
  onRetry?: () => void;
}

// ---------- Sorting ----------

type AssetSortKey = 'ticker' | 'quantity' | 'price' | 'value';
type SortDir = 'asc' | 'desc';

interface SortState {
  key: AssetSortKey;
  dir: SortDir;
}

// ---------- Derived asset row ----------

interface AssetRow {
  id: string;
  ticker: string;
  name: string | null;
  quantity: number;
  priceBrl: number | null;
  valueBrl: number | null;
  currency: string | null;
  bought: boolean;
  sold: boolean;
}

function deriveRows(
  assets: Asset[],
  prices: Map<string, PriceCache>,
  exchangeRateBrl: number | null,
): AssetRow[] {
  return assets.map((a) => {
    const cached = prices.get(a.ticker);
    let priceBrl: number | null = null;

    if (cached?.price != null) {
      if (cached.currency === 'BRL') {
        priceBrl = cached.price;
      } else if (exchangeRateBrl != null) {
        priceBrl = cached.price * exchangeRateBrl;
      }
    }

    return {
      id: a.id,
      ticker: a.ticker,
      name: a.name,
      quantity: a.quantity,
      priceBrl,
      valueBrl: priceBrl != null ? a.quantity * priceBrl : null,
      currency: cached?.currency ?? null,
      bought: a.bought,
      sold: a.sold,
    };
  });
}

function sortRows(rows: AssetRow[], sort: SortState): AssetRow[] {
  return [...rows].sort((a, b) => {
    let diff = 0;
    switch (sort.key) {
      case 'ticker':
        diff = a.ticker.localeCompare(b.ticker, 'pt-BR');
        break;
      case 'quantity':
        diff = a.quantity - b.quantity;
        break;
      case 'price':
        diff = (a.priceBrl ?? -Infinity) - (b.priceBrl ?? -Infinity);
        break;
      case 'value':
        diff = (a.valueBrl ?? -Infinity) - (b.valueBrl ?? -Infinity);
        break;
    }
    return sort.dir === 'asc' ? diff : -diff;
  });
}

// ---------- Placeholder for null values ----------

const PLACEHOLDER = '—';

function formatPrice(value: number | null): string {
  if (value == null) return PLACEHOLDER;
  return formatBrl(value);
}

function formatQuantity(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString('pt-BR');
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

// ---------- Status badge ----------

function AssetStatusBadge({ bought, sold }: { bought: boolean; sold: boolean }) {
  if (sold) {
    return (
      <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
        Vendido
      </span>
    );
  }
  if (bought) {
    return (
      <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        Comprado
      </span>
    );
  }
  return null;
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
  sortKey: AssetSortKey;
  current: SortState;
  onSort: (key: AssetSortKey) => void;
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
    <div className="animate-pulse space-y-3 p-4" role="status" aria-label="Carregando ativos">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-16 rounded-lg bg-gray-200" />
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
          className="min-h-[44px] min-w-[44px] rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          type="button"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}

// ---------- Mobile card ----------

function AssetCard({ row }: { row: AssetRow }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="min-w-0">
          <span className="text-sm font-semibold text-gray-900">{row.ticker}</span>
          {row.name && (
            <span className="ml-2 truncate text-xs text-gray-500">{row.name}</span>
          )}
        </div>
        <AssetStatusBadge bought={row.bought} sold={row.sold} />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-gray-500">Qtd</dt>
        <dd className="text-right font-medium text-gray-900">{formatQuantity(row.quantity)}</dd>
        <dt className="text-gray-500">Preço</dt>
        <dd className="text-right font-medium text-gray-900">{formatPrice(row.priceBrl)}</dd>
        <dt className="text-gray-500">Valor</dt>
        <dd className="text-right font-medium text-gray-900">{formatPrice(row.valueBrl)}</dd>
      </dl>
    </div>
  );
}

// ---------- Main component ----------

export function AssetTable({
  assets,
  prices,
  exchangeRateBrl,
  isLoading = false,
  error = null,
  onRetry,
}: AssetTableProps) {
  const [sort, setSort] = useState<SortState>({ key: 'ticker', dir: 'asc' });

  const rows = useMemo(
    () => deriveRows(assets, prices, exchangeRateBrl),
    [assets, prices, exchangeRateBrl],
  );

  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);

  function handleSort(key: AssetSortKey) {
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
      <div className="flex flex-col gap-3 md:hidden" role="list" aria-label="Lista de ativos">
        {sorted.map((row) => (
          <AssetCard key={row.id} row={row} />
        ))}
      </div>

      {/* Desktop: table layout (>= 768px) */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[600px] table-auto" role="table" aria-label="Lista de ativos">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <SortHeader label="Ticker" sortKey="ticker" current={sort} onSort={handleSort} />
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Nome</th>
              <SortHeader label="Qtd" sortKey="quantity" current={sort} onSort={handleSort} align="right" />
              <SortHeader label="Preço (BRL)" sortKey="price" current={sort} onSort={handleSort} align="right" />
              <SortHeader label="Valor (BRL)" sortKey="value" current={sort} onSort={handleSort} align="right" />
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((row) => (
              <tr key={row.id} className="transition-colors hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.ticker}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{row.name ?? PLACEHOLDER}</td>
                <td className="px-4 py-3 text-right text-sm text-gray-700">{formatQuantity(row.quantity)}</td>
                <td className="px-4 py-3 text-right text-sm text-gray-700">{formatPrice(row.priceBrl)}</td>
                <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{formatPrice(row.valueBrl)}</td>
                <td className="px-4 py-3 text-right">
                  <AssetStatusBadge bought={row.bought} sold={row.sold} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {assets.length === 0 && !isLoading && !error && (
        <p className="py-8 text-center text-sm text-gray-500">Nenhum ativo encontrado.</p>
      )}
    </div>
  );
}
