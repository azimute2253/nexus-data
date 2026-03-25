import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ============================================================
// Nexus Data — Rebalance Calculator Component
// Input for contribution amount + "Calcular" button → hierarchical
// result display (L1 Type → L2 Group → L3 Asset) with expand/collapse.
// Uses client-side rebalance() for < 500ms execution.
// [Story 5.5, ADR-004, ADR-006]
// ============================================================
import { useState, useMemo, useCallback, useEffect } from 'react';
import { formatBrl, formatShares, isValidContribution, parseContribution, } from '../../lib/dashboard/calculator-utils.js';
// ---------- Expand/Collapse chevron ----------
function Chevron({ expanded }) {
    return (_jsx("svg", { className: `h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`, viewBox: "0 0 20 20", fill: "currentColor", "aria-hidden": "true", children: _jsx("path", { fillRule: "evenodd", d: "M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z", clipRule: "evenodd" }) }));
}
// ---------- L3 Asset Row ----------
function AssetRow({ asset }) {
    if (asset.shares_to_buy === 0 && asset.allocated_brl === 0)
        return null;
    return (_jsxs("div", { className: "flex items-center justify-between py-1.5 pl-10 pr-4 text-sm md:pl-14", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "inline-flex items-center rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700", children: "COMPRAR" }), _jsx("span", { className: "font-medium text-gray-900", children: asset.ticker }), asset.weight_mode && (_jsxs("span", { className: "text-xs text-gray-400", children: ["(", asset.weight_mode === 'manual' ? 'manual' : 'questionário', ")"] }))] }), _jsxs("div", { className: "text-right text-xs text-gray-600 md:text-sm", children: [_jsx("span", { className: "font-medium text-gray-900", children: asset.shares_to_buy > 0
                            ? `${formatShares(asset.shares_to_buy)} cotas`
                            : '0 cotas' }), _jsx("span", { className: "mx-1.5 text-gray-400", children: "\u2014" }), _jsx("span", { className: "font-medium text-green-700", children: formatBrl(asset.estimated_cost_brl) })] })] }));
}
// ---------- L2 Group Section ----------
function GroupSection({ group, expanded, onToggle }) {
    const buyableAssets = group.assets.filter((a) => a.shares_to_buy > 0 || a.allocated_brl > 0);
    if (buyableAssets.length === 0 && group.allocated <= 0)
        return null;
    return (_jsxs("div", { children: [_jsxs("button", { type: "button", onClick: onToggle, className: "flex w-full items-center gap-2 py-2 pl-5 pr-4 text-left text-sm hover:bg-gray-50 transition-colors md:pl-7", "aria-expanded": expanded, children: [_jsx(Chevron, { expanded: expanded }), _jsx("span", { className: "font-medium text-gray-700", children: group.name }), _jsx("span", { className: "ml-auto text-xs text-gray-500", children: formatBrl(group.spent) })] }), expanded && (_jsxs("div", { className: "border-l-2 border-gray-100 ml-7 md:ml-9", children: [buyableAssets.length > 0 ? (buyableAssets.map((asset) => (_jsx(AssetRow, { asset: asset }, asset.asset_id)))) : (_jsx("p", { className: "py-1.5 pl-10 text-xs text-gray-400 md:pl-14", children: "Nenhuma compra neste grupo" })), group.remainder > 0.01 && (_jsxs("div", { className: "py-1 pl-10 text-xs text-gray-400 md:pl-14", children: ["Troco: ", formatBrl(group.remainder)] }))] }))] }));
}
// ---------- L1 Type Section ----------
function TypeSection({ type, expandedGroups, onToggleGroup }) {
    const [expanded, setExpanded] = useState(true); // L1 expanded by default
    if (type.allocated <= 0)
        return null;
    return (_jsxs("div", { className: "border border-gray-200 rounded-lg overflow-hidden", children: [_jsxs("button", { type: "button", onClick: () => setExpanded((prev) => !prev), className: "flex w-full items-center gap-2 bg-gray-50 px-4 py-3 text-left hover:bg-gray-100 transition-colors", "aria-expanded": expanded, children: [_jsx(Chevron, { expanded: expanded }), _jsx("span", { className: "text-sm font-semibold text-gray-900", children: type.name }), _jsx("span", { className: "ml-auto text-sm font-medium text-gray-700", children: formatBrl(type.allocated) })] }), expanded && (_jsx("div", { className: "divide-y divide-gray-50", children: type.groups.map((group) => (_jsx(GroupSection, { group: group, expanded: expandedGroups.has(group.group_id), onToggle: () => onToggleGroup(group.group_id) }, group.group_id))) }))] }));
}
// ---------- Loading state ----------
function CalculatingOverlay() {
    return (_jsxs("div", { className: "flex items-center justify-center gap-2 py-8", role: "status", "aria-label": "Calculando rebalanceamento", children: [_jsxs("svg", { className: "h-5 w-5 animate-spin text-blue-600", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" })] }), _jsx("span", { className: "text-sm text-gray-600", children: "Calculando..." })] }));
}
// ---------- Error state ----------
function ErrorBanner({ message, onRetry }) {
    return (_jsxs("div", { className: "flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-center", role: "alert", children: [_jsx("p", { className: "text-sm text-red-700", children: message }), onRetry && (_jsx("button", { type: "button", onClick: onRetry, className: "rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2", children: "Tentar novamente" }))] }));
}
// ---------- Summary bar ----------
function SummaryBar({ result }) {
    return (_jsxs("div", { className: "grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-4 text-sm md:grid-cols-4", children: [_jsxs("div", { children: [_jsx("dt", { className: "text-xs text-gray-500", children: "Aporte" }), _jsx("dd", { className: "font-semibold text-gray-900", children: formatBrl(result.contribution) })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-xs text-gray-500", children: "Alocado" }), _jsx("dd", { className: "font-semibold text-gray-900", children: formatBrl(result.total_allocated) })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-xs text-gray-500", children: "Investido" }), _jsx("dd", { className: "font-semibold text-green-700", children: formatBrl(result.total_spent) })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-xs text-gray-500", children: "Troco" }), _jsx("dd", { className: "font-semibold text-amber-600", children: formatBrl(result.total_remainder) })] })] }));
}
// ---------- Main component ----------
export function RebalanceCalculator({ initialResult, defaultContribution = 12000, onCalculate, initialError = null, }) {
    const [inputValue, setInputValue] = useState(defaultContribution.toLocaleString('pt-BR'));
    const [result, setResult] = useState(initialResult);
    const [isCalculating, setIsCalculating] = useState(false);
    const [error, setError] = useState(initialError);
    // Sync with async-loaded initialResult (e.g. when parent fetches after mount)
    useEffect(() => {
        if (initialResult !== null)
            setResult(initialResult);
    }, [initialResult]);
    useEffect(() => {
        if (initialError !== null)
            setError(initialError);
    }, [initialError]);
    const [expandedGroups, setExpandedGroups] = useState(new Set());
    const [executionTime, setExecutionTime] = useState(null);
    const contribution = useMemo(() => {
        return parseContribution(inputValue);
    }, [inputValue]);
    const isValid = useMemo(() => isValidContribution(inputValue), [inputValue]);
    const validationMessage = useMemo(() => {
        if (inputValue === '')
            return null;
        if (!isValid)
            return 'Digite um valor numérico válido (positivo)';
        if (contribution === 0)
            return 'O aporte deve ser maior que zero';
        return null;
    }, [inputValue, isValid, contribution]);
    const canCalculate = isValid && contribution > 0 && !isCalculating;
    const handleCalculate = useCallback(async () => {
        if (!canCalculate)
            return;
        setIsCalculating(true);
        setError(null);
        setExpandedGroups(new Set());
        const t0 = performance.now();
        try {
            const newResult = await onCalculate(contribution);
            const t1 = performance.now();
            setExecutionTime(t1 - t0);
            setResult(newResult);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao calcular rebalanceamento');
            setResult(null);
        }
        finally {
            setIsCalculating(false);
        }
    }, [canCalculate, contribution, onCalculate]);
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter' && canCalculate) {
            handleCalculate();
        }
    }, [canCalculate, handleCalculate]);
    const toggleGroup = useCallback((groupId) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(groupId)) {
                next.delete(groupId);
            }
            else {
                next.add(groupId);
            }
            return next;
        });
    }, []);
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "rounded-lg border border-gray-200 bg-white p-4 shadow-sm", children: [_jsx("label", { htmlFor: "contribution-input", className: "block text-sm font-medium text-gray-700 mb-2", children: "Valor do Aporte (R$)" }), _jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-start", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "relative", children: [_jsx("span", { className: "pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 text-sm", children: "R$" }), _jsx("input", { id: "contribution-input", type: "text", inputMode: "decimal", value: inputValue, onChange: (e) => setInputValue(e.target.value), onKeyDown: handleKeyDown, placeholder: "12.000", className: `block w-full rounded-md border py-2.5 pl-9 pr-3 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${validationMessage
                                                    ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500'
                                                    : 'border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500'}`, "aria-invalid": !!validationMessage, "aria-describedby": validationMessage ? 'contribution-error' : undefined })] }), validationMessage && (_jsx("p", { id: "contribution-error", className: "mt-1 text-xs text-red-600", role: "alert", children: validationMessage }))] }), _jsx("button", { type: "button", onClick: handleCalculate, disabled: !canCalculate, className: "rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500", children: "Calcular" })] })] }), isCalculating && _jsx(CalculatingOverlay, {}), error && !isCalculating && (_jsx(ErrorBanner, { message: error, onRetry: canCalculate ? handleCalculate : undefined })), result && !isCalculating && !error && (_jsxs("div", { className: "space-y-3", children: [_jsx(SummaryBar, { result: result }), executionTime !== null && (_jsxs("p", { className: "text-xs text-gray-400 text-right", children: ["Calculado em ", executionTime.toFixed(0), "ms"] })), _jsx("div", { className: "space-y-2", role: "tree", "aria-label": "Resultado do rebalanceamento", children: result.types.map((type) => (_jsx(TypeSection, { type: type, expandedGroups: expandedGroups, onToggleGroup: toggleGroup }, type.type_id))) }), result.types.every((t) => t.allocated <= 0) && (_jsx("p", { className: "py-8 text-center text-sm text-gray-500", children: "Nenhuma ordem de compra gerada. Todas as classes est\u00E3o acima da meta." }))] }))] }));
}
