import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ============================================================
// Nexus Data — Asset Table Component
// Displays individual assets with ticker, quantity, price, value.
// Desktop: HTML table with sortable columns.
// Mobile (< 768px): card layout with touch-friendly spacing.
// Null/missing data displays "—" placeholder.
// [Story 8.1, ADR-006]
// ============================================================
import { useState, useMemo } from 'react';
import { formatBrl } from '../../lib/dashboard/allocation-utils.js';
function deriveRows(assets, prices, exchangeRateBrl) {
    return assets.map((a) => {
        const cached = prices.get(a.ticker);
        let priceBrl = null;
        if (cached?.price != null) {
            if (cached.currency === 'BRL') {
                priceBrl = cached.price;
            }
            else if (exchangeRateBrl != null) {
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
function sortRows(rows, sort) {
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
function formatPrice(value) {
    if (value == null)
        return PLACEHOLDER;
    return formatBrl(value);
}
function formatQuantity(value) {
    if (Number.isInteger(value))
        return value.toLocaleString('pt-BR');
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}
// ---------- Status badge ----------
function AssetStatusBadge({ bought, sold }) {
    if (sold) {
        return (_jsx("span", { className: "inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600", children: "Vendido" }));
    }
    if (bought) {
        return (_jsx("span", { className: "inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700", children: "Comprado" }));
    }
    return null;
}
// ---------- Sort header ----------
function SortHeader({ label, sortKey, current, onSort, align = 'left', }) {
    const isActive = current.key === sortKey;
    const arrow = isActive ? (current.dir === 'asc' ? ' ▲' : ' ▼') : '';
    return (_jsxs("th", { className: `cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-800 ${align === 'right' ? 'text-right' : 'text-left'}`, onClick: () => onSort(sortKey), "aria-sort": isActive ? (current.dir === 'asc' ? 'ascending' : 'descending') : 'none', role: "columnheader", children: [label, arrow] }));
}
// ---------- Loading skeleton ----------
function LoadingSkeleton() {
    return (_jsx("div", { className: "animate-pulse space-y-3 p-4", role: "status", "aria-label": "Carregando ativos", children: Array.from({ length: 5 }).map((_, i) => (_jsx("div", { className: "h-16 rounded-lg bg-gray-200" }, i))) }));
}
// ---------- Error state ----------
function ErrorState({ message, onRetry }) {
    return (_jsxs("div", { className: "flex flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 p-6 text-center", role: "alert", children: [_jsx("p", { className: "text-sm text-red-700", children: message }), onRetry && (_jsx("button", { onClick: onRetry, className: "min-h-[44px] min-w-[44px] rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2", type: "button", children: "Tentar novamente" }))] }));
}
// ---------- Mobile card ----------
function AssetCard({ row }) {
    return (_jsxs("div", { className: "rounded-lg border border-gray-200 bg-white p-4 shadow-sm", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("span", { className: "text-sm font-semibold text-gray-900", children: row.ticker }), row.name && (_jsx("span", { className: "ml-2 truncate text-xs text-gray-500", children: row.name }))] }), _jsx(AssetStatusBadge, { bought: row.bought, sold: row.sold })] }), _jsxs("dl", { className: "grid grid-cols-2 gap-x-4 gap-y-1 text-sm", children: [_jsx("dt", { className: "text-gray-500", children: "Qtd" }), _jsx("dd", { className: "text-right font-medium text-gray-900", children: formatQuantity(row.quantity) }), _jsx("dt", { className: "text-gray-500", children: "Pre\u00E7o" }), _jsx("dd", { className: "text-right font-medium text-gray-900", children: formatPrice(row.priceBrl) }), _jsx("dt", { className: "text-gray-500", children: "Valor" }), _jsx("dd", { className: "text-right font-medium text-gray-900", children: formatPrice(row.valueBrl) })] })] }));
}
// ---------- Main component ----------
export function AssetTable({ assets, prices, exchangeRateBrl, isLoading = false, error = null, onRetry, }) {
    const [sort, setSort] = useState({ key: 'ticker', dir: 'asc' });
    const rows = useMemo(() => deriveRows(assets, prices, exchangeRateBrl), [assets, prices, exchangeRateBrl]);
    const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);
    function handleSort(key) {
        setSort((prev) => prev.key === key
            ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
            : { key, dir: 'asc' });
    }
    if (isLoading)
        return _jsx(LoadingSkeleton, {});
    if (error)
        return _jsx(ErrorState, { message: error, onRetry: onRetry });
    return (_jsxs("div", { children: [_jsx("div", { className: "flex flex-col gap-3 md:hidden", role: "list", "aria-label": "Lista de ativos", children: sorted.map((row) => (_jsx(AssetCard, { row: row }, row.id))) }), _jsx("div", { className: "hidden overflow-x-auto md:block", children: _jsxs("table", { className: "w-full min-w-[600px] table-auto", role: "table", "aria-label": "Lista de ativos", children: [_jsx("thead", { className: "border-b border-gray-200 bg-gray-50", children: _jsxs("tr", { children: [_jsx(SortHeader, { label: "Ticker", sortKey: "ticker", current: sort, onSort: handleSort }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500", children: "Nome" }), _jsx(SortHeader, { label: "Qtd", sortKey: "quantity", current: sort, onSort: handleSort, align: "right" }), _jsx(SortHeader, { label: "Pre\u00E7o (BRL)", sortKey: "price", current: sort, onSort: handleSort, align: "right" }), _jsx(SortHeader, { label: "Valor (BRL)", sortKey: "value", current: sort, onSort: handleSort, align: "right" }), _jsx("th", { className: "px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500", children: "Status" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-100", children: sorted.map((row) => (_jsxs("tr", { className: "transition-colors hover:bg-gray-50", children: [_jsx("td", { className: "px-4 py-3 text-sm font-medium text-gray-900", children: row.ticker }), _jsx("td", { className: "px-4 py-3 text-sm text-gray-500", children: row.name ?? PLACEHOLDER }), _jsx("td", { className: "px-4 py-3 text-right text-sm text-gray-700", children: formatQuantity(row.quantity) }), _jsx("td", { className: "px-4 py-3 text-right text-sm text-gray-700", children: formatPrice(row.priceBrl) }), _jsx("td", { className: "px-4 py-3 text-right text-sm font-medium text-gray-900", children: formatPrice(row.valueBrl) }), _jsx("td", { className: "px-4 py-3 text-right", children: _jsx(AssetStatusBadge, { bought: row.bought, sold: row.sold }) })] }, row.id))) })] }) }), assets.length === 0 && !isLoading && !error && (_jsx("p", { className: "py-8 text-center text-sm text-gray-500", children: "Nenhum ativo encontrado." }))] }));
}
