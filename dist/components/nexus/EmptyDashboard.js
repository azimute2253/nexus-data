import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ---------- SVG Icon ----------
function IconFolder({ className }) {
    return (_jsx("svg", { className: className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: _jsx("path", { d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" }) }));
}
// ---------- Main component ----------
export function EmptyDashboard({ onNavigateAtivos }) {
    const handleClick = () => {
        if (onNavigateAtivos) {
            onNavigateAtivos();
            return;
        }
        // Fallback: navigate via URL query param (ADR-013)
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('tab', 'ativos');
            window.history.replaceState({}, '', url.toString());
            window.dispatchEvent(new PopStateEvent('popstate'));
        }
    };
    return (_jsxs("div", { className: "flex flex-col items-center justify-center gap-4 rounded-lg border border-gray-200 bg-white px-6 py-12 text-center shadow-sm", "data-testid": "empty-dashboard", children: [_jsx(IconFolder, { className: "h-12 w-12 text-gray-300" }), _jsxs("div", { className: "space-y-2", children: [_jsx("h2", { className: "text-base font-semibold text-gray-900 md:text-lg", children: "Carteira vazia" }), _jsx("p", { className: "text-sm text-gray-600 md:text-base", children: "Sua carteira est\u00E1 vazia. Comece adicionando suas classes de ativo na aba Ativos." })] }), _jsx("button", { type: "button", onClick: handleClick, className: "min-h-[44px] rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2", children: "Ir para Ativos" })] }));
}
