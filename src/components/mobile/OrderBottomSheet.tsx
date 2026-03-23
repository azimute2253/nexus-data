// ============================================================
// Nexus Data — Order Bottom Sheet Component
// Slide-up bottom sheet displaying BUY order cards after
// rebalance calculation. Mobile-optimized with card layout,
// font >= 14px, line-height >= 1.4, and summary bar.
// [Story 8.2, ADR-006]
// ============================================================

import { useMemo } from 'react';
import type { RebalanceResult, L3Result } from '../../lib/nexus/types.js';
import {
  formatBrl,
  formatShares,
  flattenBuyOrders,
  countBuyOrders,
} from '../../lib/dashboard/calculator-utils.js';

// ---------- Props ----------

export interface OrderBottomSheetProps {
  result: RebalanceResult;
  open: boolean;
  onClose: () => void;
}

// ---------- Types ----------

interface FlatOrder extends L3Result {
  type_name: string;
  group_name: string;
}

// ---------- Order Card ----------

function OrderCard({ order }: { order: FlatOrder }) {
  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      role="listitem"
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className="font-semibold text-gray-900"
          style={{ fontSize: '16px', lineHeight: '1.4' }}
        >
          {order.ticker}
        </span>
        <span
          className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 font-medium text-green-700"
          style={{ fontSize: '12px' }}
        >
          COMPRAR
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        <dt className="text-gray-500" style={{ fontSize: '14px', lineHeight: '1.4' }}>
          Cotas
        </dt>
        <dd
          className="text-right font-medium text-gray-900"
          style={{ fontSize: '14px', lineHeight: '1.4' }}
        >
          {formatShares(order.shares_to_buy)}
        </dd>

        <dt className="text-gray-500" style={{ fontSize: '14px', lineHeight: '1.4' }}>
          Custo
        </dt>
        <dd
          className="text-right font-medium text-green-700"
          style={{ fontSize: '14px', lineHeight: '1.4' }}
        >
          {formatBrl(order.estimated_cost_brl)}
        </dd>

        <dt className="text-gray-500" style={{ fontSize: '14px', lineHeight: '1.4' }}>
          Grupo
        </dt>
        <dd
          className="truncate text-right text-gray-600"
          style={{ fontSize: '14px', lineHeight: '1.4' }}
        >
          {order.group_name}
        </dd>
      </dl>
    </div>
  );
}

// ---------- Summary Bar ----------

function SummaryBar({ result }: { result: RebalanceResult }) {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3">
      <div>
        <dt className="text-gray-500" style={{ fontSize: '12px' }}>Aporte</dt>
        <dd className="font-semibold text-gray-900" style={{ fontSize: '14px', lineHeight: '1.4' }}>
          {formatBrl(result.contribution)}
        </dd>
      </div>
      <div>
        <dt className="text-gray-500" style={{ fontSize: '12px' }}>Investido</dt>
        <dd className="font-semibold text-green-700" style={{ fontSize: '14px', lineHeight: '1.4' }}>
          {formatBrl(result.total_spent)}
        </dd>
      </div>
      <div>
        <dt className="text-gray-500" style={{ fontSize: '12px' }}>Alocado</dt>
        <dd className="font-semibold text-gray-900" style={{ fontSize: '14px', lineHeight: '1.4' }}>
          {formatBrl(result.total_allocated)}
        </dd>
      </div>
      <div>
        <dt className="text-gray-500" style={{ fontSize: '12px' }}>Troco</dt>
        <dd className="font-semibold text-amber-600" style={{ fontSize: '14px', lineHeight: '1.4' }}>
          {formatBrl(result.total_remainder)}
        </dd>
      </div>
    </div>
  );
}

// ---------- Main component ----------

export function OrderBottomSheet({ result, open, onClose }: OrderBottomSheetProps) {
  const orders = useMemo(() => flattenBuyOrders(result), [result]);
  const orderCount = useMemo(() => countBuyOrders(result), [result]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Ordens de compra"
      >
        {/* Drag handle */}
        <div className="flex justify-center pb-2 pt-3">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 pb-3">
          <h2
            className="font-semibold text-gray-900"
            style={{ fontSize: '18px', lineHeight: '1.4' }}
          >
            {orderCount} {orderCount === 1 ? 'ordem' : 'ordens'} de compra
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 active:bg-gray-100"
            style={{ minHeight: '44px', minWidth: '44px' }}
            aria-label="Fechar"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          {/* Summary */}
          <SummaryBar result={result} />

          {/* Order cards */}
          {orders.length > 0 ? (
            <div className="mt-3 flex flex-col gap-3" role="list" aria-label="Lista de ordens">
              {orders.map((order) => (
                <OrderCard key={order.asset_id} order={order} />
              ))}
            </div>
          ) : (
            <p
              className="py-8 text-center text-gray-500"
              style={{ fontSize: '14px', lineHeight: '1.4' }}
            >
              Nenhuma ordem de compra gerada.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
