import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function TargetWarning({ sum, label, tolerancePp = 0 }) {
    const diff = Math.abs(sum - 100);
    if (diff <= tolerancePp)
        return null;
    const direction = sum < 100 ? 'abaixo' : 'acima';
    return (_jsxs("div", { className: "mt-1 flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700", role: "alert", "data-testid": "target-warning", children: [_jsx("svg", { className: "h-3.5 w-3.5 flex-shrink-0", viewBox: "0 0 20 20", fill: "currentColor", "aria-hidden": "true", children: _jsx("path", { fillRule: "evenodd", d: "M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z", clipRule: "evenodd" }) }), _jsxs("span", { children: ["Soma de target % ", label, ": ", _jsxs("strong", { children: [sum.toFixed(1), "%"] }), " (", direction, " de 100%)"] })] }));
}
