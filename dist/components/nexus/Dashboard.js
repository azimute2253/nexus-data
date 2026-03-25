import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ============================================================
// Nexus Data — Dashboard Component
// Mobile-optimized overview composing AllocationChart, AllocationTable,
// and a summary header showing total portfolio value + top deviations.
// Total value and top 5 deviations are visible without scroll on mobile.
// Desktop: standard layout | Mobile (< 768px): card-based, stacked.
// [Story 8.1, ADR-006]
// ============================================================
import { useMemo } from 'react';
import { formatBrl, formatPct, getStatus } from '../../lib/dashboard/allocation-utils.js';
import { DeviationBar } from './DeviationBar.js';
// ---------- Loading skeleton ----------
function LoadingSkeleton() {
    return (_jsxs("div", { className: "animate-pulse space-y-4", role: "status", "aria-label": "Carregando dashboard", children: [_jsx("div", { className: "rounded-lg bg-gray-200 p-6", children: _jsx("div", { className: "h-8 w-40 rounded bg-gray-300" }) }), _jsx("div", { className: "space-y-3", children: Array.from({ length: 3 }).map((_, i) => (_jsx("div", { className: "h-16 rounded-lg bg-gray-200" }, i))) })] }));
}
// ---------- Error state ----------
function ErrorState({ message, onRetry }) {
    return (_jsxs("div", { className: "flex flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 p-6 text-center", role: "alert", children: [_jsx("p", { className: "text-sm text-red-700", children: message }), onRetry && (_jsx("button", { onClick: onRetry, className: "min-h-[44px] min-w-[44px] rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2", type: "button", children: "Tentar novamente" }))] }));
}
// ---------- Portfolio total header ----------
function PortfolioHeader({ totalValueBrl }) {
    return (_jsxs("div", { className: "rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:p-6", children: [_jsx("p", { className: "text-xs font-medium uppercase tracking-wider text-gray-500", children: "Valor Total \u2014 Nexus Data" }), _jsx("p", { className: "mt-1 text-2xl font-bold text-gray-900 md:text-3xl", children: formatBrl(totalValueBrl) })] }));
}
// ---------- Top deviations (mobile-first: visible without scroll) ----------
const STATUS_STYLES = {
    Overweight: 'bg-red-100 text-red-800',
    Underweight: 'bg-amber-100 text-amber-800',
    Aligned: 'bg-green-100 text-green-800',
};
function DeviationCard({ item }) {
    const status = getStatus(item.deviation_pct);
    return (_jsxs("div", { className: "flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 shadow-sm", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "truncate text-sm font-medium text-gray-900", children: item.asset_type_name }), _jsx("span", { className: `inline-block shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`, role: "status", children: status })] }), _jsx("div", { className: "mt-1", children: _jsx(DeviationBar, { deviationPct: item.deviation_pct }) })] }), _jsxs("span", { className: `ml-3 shrink-0 text-sm font-semibold ${item.deviation_pct > 2 ? 'text-red-600' : item.deviation_pct < -2 ? 'text-amber-600' : 'text-green-600'}`, children: [item.deviation_pct > 0 ? '+' : '', formatPct(item.deviation_pct)] })] }));
}
// ---------- Main component ----------
export function Dashboard({ performance, isLoading = false, error = null, onRetry, }) {
    // Top 5 deviations sorted by absolute deviation (largest first)
    const topDeviations = useMemo(() => {
        if (!performance)
            return [];
        return [...performance.types]
            .sort((a, b) => Math.abs(b.deviation_pct) - Math.abs(a.deviation_pct))
            .slice(0, 5);
    }, [performance]);
    if (isLoading)
        return _jsx(LoadingSkeleton, {});
    if (error)
        return _jsx(ErrorState, { message: error, onRetry: onRetry });
    if (!performance)
        return null;
    return (_jsxs("div", { className: "space-y-4", children: [_jsx(PortfolioHeader, { totalValueBrl: performance.total_value_brl }), topDeviations.length > 0 && (_jsxs("div", { children: [_jsx("h2", { className: "mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500", children: "Maiores Desvios" }), _jsx("div", { className: "flex flex-col gap-2", children: topDeviations.map((item) => (_jsx(DeviationCard, { item: item }, item.asset_type_id))) })] }))] }));
}
