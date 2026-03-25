import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { formatBrl } from '../../lib/dashboard/calculator-utils.js';
// ---------- Date formatting ----------
function formatDate(dateStr) {
    if (!dateStr)
        return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}
// ---------- Distribution snapshot summary ----------
function DistributionSummary({ distribution }) {
    if (!distribution || typeof distribution !== 'object')
        return null;
    const result = distribution;
    if (!result.types || result.types.length === 0)
        return null;
    const allocatedTypes = result.types.filter((t) => t.allocated > 0);
    if (allocatedTypes.length === 0)
        return null;
    return (_jsx("div", { className: "mt-1 flex flex-wrap gap-1", children: allocatedTypes.map((t) => (_jsxs("span", { className: "inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600", children: [t.name, ": ", formatBrl(t.allocated)] }, t.name))) }));
}
// ---------- Loading skeleton ----------
function HistorySkeleton() {
    return (_jsx("div", { className: "animate-pulse space-y-3", role: "status", "aria-label": "Carregando hist\u00F3rico", children: Array.from({ length: 3 }).map((_, i) => (_jsx("div", { className: "h-16 rounded-lg bg-gray-200" }, i))) }));
}
// ---------- Main component ----------
export function ContributionHistory({ contributions, isLoading = false, }) {
    if (isLoading)
        return _jsx(HistorySkeleton, {});
    if (contributions.length === 0) {
        return (_jsx("p", { className: "py-8 text-center text-sm text-gray-500", children: "Nenhum aporte registrado ainda" }));
    }
    return (_jsx("div", { className: "space-y-2", role: "list", "aria-label": "Hist\u00F3rico de aportes", children: contributions.map((contribution) => (_jsx("div", { role: "listitem", className: "flex items-start justify-between rounded-lg border border-gray-200 bg-white p-3 shadow-sm", children: _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm font-medium text-gray-900", children: contribution.amount !== null ? formatBrl(contribution.amount) : '—' }), _jsx("span", { className: "text-xs text-gray-400", children: formatDate(contribution.contributed_at) })] }), contribution.distribution !== null && contribution.distribution !== undefined && (_jsx(DistributionSummary, { distribution: contribution.distribution }))] }) }, contribution.id))) }));
}
