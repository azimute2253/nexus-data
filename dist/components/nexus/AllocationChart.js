import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ============================================================
// Nexus Data — Allocation Pie Chart Component
// Side-by-side pie charts comparing actual vs target allocation
// across asset types. Uses Recharts within a React island.
// Desktop: side-by-side | Mobile (< 768px): stacked vertically.
// [Story 5.3, ADR-006]
// ============================================================
import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, } from 'recharts';
import { formatBrl, formatPct } from '../../lib/dashboard/allocation-utils.js';
// ---------- Colors ----------
const TYPE_COLORS = [
    '#3B82F6', // blue-500
    '#10B981', // emerald-500
    '#F59E0B', // amber-500
    '#EF4444', // red-500
    '#8B5CF6', // violet-500
    '#EC4899', // pink-500
    '#06B6D4', // cyan-500
    '#F97316', // orange-500
    '#14B8A6', // teal-500
    '#6366F1', // indigo-500
];
export function getColor(index) {
    return TYPE_COLORS[index % TYPE_COLORS.length];
}
export function buildActualSlices(types) {
    return types
        .filter((t) => t.actual_pct > 0)
        .map((t, _i) => {
        const originalIndex = types.indexOf(t);
        return {
            name: t.asset_type_name,
            value: t.actual_pct,
            valueBrl: t.total_value_brl,
            fill: getColor(originalIndex),
        };
    });
}
export function buildTargetSlices(types, totalValueBrl) {
    return types
        .filter((t) => t.target_pct > 0)
        .map((t, _i) => {
        const originalIndex = types.indexOf(t);
        return {
            name: t.asset_type_name,
            value: t.target_pct,
            valueBrl: totalValueBrl * (t.target_pct / 100),
            fill: getColor(originalIndex),
        };
    });
}
// ---------- Custom tooltip ----------
function ChartTooltip({ active, payload }) {
    if (!active || !payload || payload.length === 0)
        return null;
    const data = payload[0].payload;
    return (_jsxs("div", { className: "rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md", children: [_jsx("p", { className: "text-sm font-semibold text-gray-900", children: data.name }), _jsx("p", { className: "text-sm text-gray-600", children: formatPct(data.value) }), _jsx("p", { className: "text-sm text-gray-600", children: formatBrl(data.valueBrl) })] }));
}
// ---------- Custom label ----------
function renderLabel(props) {
    const { name, value, x, y, textAnchor } = props;
    if (typeof value !== 'number' || value < 3)
        return null; // skip tiny slices
    return (_jsxs("text", { x: x, y: y, textAnchor: textAnchor, dominantBaseline: "central", className: "text-xs", fill: "#374151", children: [name ?? '', " ", formatPct(value)] }));
}
// ---------- Loading skeleton ----------
function LoadingSkeleton() {
    return (_jsx("div", { className: "animate-pulse p-6", role: "status", "aria-label": "Carregando gr\u00E1ficos de aloca\u00E7\u00E3o", children: _jsxs("div", { className: "flex flex-col items-center gap-8 md:flex-row md:justify-center", children: [_jsxs("div", { className: "flex flex-col items-center gap-2", children: [_jsx("div", { className: "h-4 w-16 rounded bg-gray-200" }), _jsx("div", { className: "h-48 w-48 rounded-full bg-gray-200" })] }), _jsxs("div", { className: "flex flex-col items-center gap-2", children: [_jsx("div", { className: "h-4 w-16 rounded bg-gray-200" }), _jsx("div", { className: "h-48 w-48 rounded-full bg-gray-200" })] })] }) }));
}
// ---------- Error state ----------
function ErrorState({ message, onRetry }) {
    return (_jsxs("div", { className: "flex flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 p-6 text-center", role: "alert", children: [_jsx("p", { className: "text-sm text-red-700", children: message }), onRetry && (_jsx("button", { onClick: onRetry, className: "rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2", type: "button", children: "Tentar novamente" }))] }));
}
// ---------- Empty state ----------
function EmptyState() {
    return (_jsx("div", { className: "flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-12", role: "status", children: _jsx("p", { className: "text-sm text-gray-500", children: "Sem dados para exibir" }) }));
}
// ---------- Single pie chart ----------
function SinglePie({ title, data, descText }) {
    return (_jsxs("div", { className: "flex flex-1 flex-col items-center", children: [_jsx("h3", { className: "mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500", children: title }), _jsx(ResponsiveContainer, { width: "100%", height: 280, children: _jsxs(PieChart, { children: [_jsx("desc", { children: descText }), _jsx(Pie, { data: data, dataKey: "value", nameKey: "name", cx: "50%", cy: "50%", outerRadius: 100, innerRadius: 40, paddingAngle: 1, label: renderLabel, labelLine: false, children: data.map((entry, index) => (_jsx(Cell, { fill: entry.fill, stroke: "#fff", strokeWidth: 2 }, `cell-${index}`))) }), _jsx(Tooltip, { content: _jsx(ChartTooltip, {}) })] }) })] }));
}
// ---------- Color legend ----------
function ColorLegend({ types }) {
    return (_jsx("div", { className: "flex flex-wrap justify-center gap-x-4 gap-y-1 px-4 pt-2", children: types.map((t, i) => (_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "inline-block h-3 w-3 rounded-sm", style: { backgroundColor: getColor(i) }, "aria-hidden": "true" }), _jsx("span", { className: "text-xs text-gray-600", children: t.asset_type_name })] }, t.asset_type_id))) }));
}
// ---------- Main component ----------
export function AllocationChart({ types, totalValueBrl, isLoading = false, error = null, onRetry, }) {
    const actualSlices = useMemo(() => buildActualSlices(types), [types]);
    const targetSlices = useMemo(() => buildTargetSlices(types, totalValueBrl), [types, totalValueBrl]);
    if (isLoading)
        return _jsx(LoadingSkeleton, {});
    if (error)
        return _jsx(ErrorState, { message: error, onRetry: onRetry });
    if (types.length === 0)
        return _jsx(EmptyState, {});
    return (_jsxs("div", { className: "rounded-lg border border-gray-200 bg-white p-4 shadow-sm", children: [_jsxs("div", { className: "flex flex-col gap-4 md:flex-row md:gap-2", role: "img", "aria-label": "Gr\u00E1ficos de aloca\u00E7\u00E3o: Atual vs Target", children: [_jsx(SinglePie, { title: "Atual", data: actualSlices, descText: "Gr\u00E1fico pizza mostrando a aloca\u00E7\u00E3o atual do Nexus Data por tipo de ativo" }), _jsx(SinglePie, { title: "Target", data: targetSlices, descText: "Gr\u00E1fico pizza mostrando a aloca\u00E7\u00E3o alvo do Nexus Data por tipo de ativo" })] }), _jsx(ColorLegend, { types: types })] }));
}
