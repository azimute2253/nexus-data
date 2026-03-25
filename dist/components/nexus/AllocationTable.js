import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ============================================================
// Nexus Data — Allocation Table Component
// Displays portfolio breakdown by asset type with target/current
// allocation, deviation badges, and sortable columns.
// Desktop: HTML table | Mobile (< 768px): card layout.
// [Story 5.2, ADR-006]
// ============================================================
import { useState, useMemo } from 'react';
import { sortTypes, formatBrl, formatPct, getStatus, } from '../../lib/dashboard/allocation-utils.js';
import { DeviationBar } from './DeviationBar.js';
// ---------- Status badge ----------
const STATUS_STYLES = {
    Overweight: 'bg-red-100 text-red-800',
    Underweight: 'bg-amber-100 text-amber-800',
    Aligned: 'bg-green-100 text-green-800',
};
function StatusBadge({ deviation }) {
    const status = getStatus(deviation);
    return (_jsx("span", { className: `inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`, role: "status", "aria-label": `${status}: ${formatPct(deviation)} deviation`, children: status }));
}
// ---------- Sort header ----------
function SortHeader({ label, sortKey, current, onSort, align = 'left', }) {
    const isActive = current.key === sortKey;
    const arrow = isActive ? (current.dir === 'asc' ? ' ▲' : ' ▼') : '';
    return (_jsxs("th", { className: `cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-800 ${align === 'right' ? 'text-right' : 'text-left'}`, onClick: () => onSort(sortKey), "aria-sort": isActive ? (current.dir === 'asc' ? 'ascending' : 'descending') : 'none', role: "columnheader", children: [label, arrow] }));
}
// ---------- Loading skeleton ----------
function LoadingSkeleton() {
    return (_jsx("div", { className: "animate-pulse space-y-3 p-4", role: "status", "aria-label": "Carregando aloca\u00E7\u00E3o", children: Array.from({ length: 5 }).map((_, i) => (_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("div", { className: "h-4 w-24 rounded bg-gray-200" }), _jsx("div", { className: "h-4 w-16 rounded bg-gray-200" }), _jsx("div", { className: "h-4 w-16 rounded bg-gray-200" }), _jsx("div", { className: "h-4 w-16 rounded bg-gray-200" }), _jsx("div", { className: "h-4 w-20 rounded bg-gray-200" })] }, i))) }));
}
// ---------- Error state ----------
function ErrorState({ message, onRetry }) {
    return (_jsxs("div", { className: "flex flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 p-6 text-center", role: "alert", children: [_jsx("p", { className: "text-sm text-red-700", children: message }), onRetry && (_jsx("button", { onClick: onRetry, className: "rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2", type: "button", children: "Tentar novamente" }))] }));
}
// ---------- Mobile card ----------
function AllocationCard({ item }) {
    return (_jsxs("div", { className: "rounded-lg border border-gray-200 bg-white p-4 shadow-sm", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("span", { className: "text-sm font-semibold text-gray-900", children: item.asset_type_name }), _jsx(StatusBadge, { deviation: item.deviation_pct })] }), _jsxs("dl", { className: "grid grid-cols-2 gap-x-4 gap-y-1 text-sm", children: [_jsx("dt", { className: "text-gray-500", children: "Meta" }), _jsx("dd", { className: "text-right font-medium text-gray-900", children: formatPct(item.target_pct) }), _jsx("dt", { className: "text-gray-500", children: "Atual" }), _jsx("dd", { className: "text-right font-medium text-gray-900", children: formatPct(item.actual_pct) }), _jsx("dt", { className: "text-gray-500", children: "Desvio" }), _jsxs("dd", { className: `text-right font-medium ${item.deviation_pct > 2 ? 'text-red-600' : item.deviation_pct < -2 ? 'text-amber-600' : 'text-green-600'}`, children: [item.deviation_pct > 0 ? '+' : '', formatPct(item.deviation_pct)] }), _jsx("dt", { className: "text-gray-500", children: "Valor" }), _jsx("dd", { className: "text-right font-medium text-gray-900", children: formatBrl(item.total_value_brl) })] }), _jsx("div", { className: "mt-2", children: _jsx(DeviationBar, { deviationPct: item.deviation_pct }) })] }));
}
// ---------- Main component ----------
export function AllocationTable({ types, totalValueBrl, isLoading = false, error = null, onRetry, }) {
    const [sort, setSort] = useState({ key: 'asset_type_name', dir: 'asc' });
    const sorted = useMemo(() => sortTypes(types, sort), [types, sort]);
    function handleSort(key) {
        setSort((prev) => prev.key === key
            ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
            : { key, dir: 'asc' });
    }
    if (isLoading)
        return _jsx(LoadingSkeleton, {});
    if (error)
        return _jsx(ErrorState, { message: error, onRetry: onRetry });
    return (_jsxs("div", { children: [_jsx("div", { className: "flex flex-col gap-3 md:hidden", role: "list", "aria-label": "Aloca\u00E7\u00E3o por tipo de ativo", children: sorted.map((item) => (_jsx(AllocationCard, { item: item }, item.asset_type_id))) }), _jsx("div", { className: "hidden overflow-x-auto md:block", children: _jsxs("table", { className: "w-full min-w-[600px] table-auto", role: "table", "aria-label": "Aloca\u00E7\u00E3o por tipo de ativo", children: [_jsx("thead", { className: "border-b border-gray-200 bg-gray-50", children: _jsxs("tr", { children: [_jsx(SortHeader, { label: "Tipo", sortKey: "asset_type_name", current: sort, onSort: handleSort }), _jsx(SortHeader, { label: "Meta %", sortKey: "target_pct", current: sort, onSort: handleSort, align: "right" }), _jsx(SortHeader, { label: "Atual %", sortKey: "actual_pct", current: sort, onSort: handleSort, align: "right" }), _jsx(SortHeader, { label: "Desvio", sortKey: "deviation_pct", current: sort, onSort: handleSort, align: "right" }), _jsx(SortHeader, { label: "Valor (BRL)", sortKey: "total_value_brl", current: sort, onSort: handleSort, align: "right" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500", style: { minWidth: '140px' }, children: "Indicador" }), _jsx("th", { className: "px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500", children: "Status" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-100", children: sorted.map((item) => (_jsxs("tr", { className: "hover:bg-gray-50 transition-colors", children: [_jsx("td", { className: "px-4 py-3 text-sm font-medium text-gray-900", children: item.asset_type_name }), _jsx("td", { className: "px-4 py-3 text-right text-sm text-gray-700", children: formatPct(item.target_pct) }), _jsx("td", { className: "px-4 py-3 text-right text-sm text-gray-700", children: formatPct(item.actual_pct) }), _jsxs("td", { className: `px-4 py-3 text-right text-sm font-medium ${item.deviation_pct > 2 ? 'text-red-600' : item.deviation_pct < -2 ? 'text-amber-600' : 'text-green-600'}`, children: [item.deviation_pct > 0 ? '+' : '', formatPct(item.deviation_pct)] }), _jsx("td", { className: "px-4 py-3 text-right text-sm text-gray-700", children: formatBrl(item.total_value_brl) }), _jsx("td", { className: "px-4 py-3", children: _jsx(DeviationBar, { deviationPct: item.deviation_pct }) }), _jsx("td", { className: "px-4 py-3 text-right", children: _jsx(StatusBadge, { deviation: item.deviation_pct }) })] }, item.asset_type_id))) })] }) }), types.length === 0 && !isLoading && !error && (_jsx("p", { className: "py-8 text-center text-sm text-gray-500", children: "Nenhum tipo de ativo encontrado." }))] }));
}
