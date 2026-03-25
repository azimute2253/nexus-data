import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ============================================================
// Nexus Data — Tab Navigation Component
// Bottom tabs on mobile, horizontal header tabs on desktop.
// 3 tabs: Dashboard | Aportes | Ativos.
// Active tab has visual indicator; error boundary per section.
// Tab state synced to URL query param (?tab=) for deep-linking.
// [Story 8.3, Story 13.1, ADR-006, ADR-013]
// ============================================================
import { Component, useState, useCallback } from 'react';
// ---------- URL tab state helpers ----------
const TAB_PARAM = 'tab';
const DEFAULT_TAB = 'dashboard';
const VALID_TABS = new Set(['dashboard', 'aportes', 'ativos']);
function getTabFromUrl() {
    if (typeof window === 'undefined')
        return DEFAULT_TAB;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get(TAB_PARAM);
    return raw && VALID_TABS.has(raw) ? raw : DEFAULT_TAB;
}
function setTabInUrl(tab) {
    if (typeof window === 'undefined')
        return;
    const url = new URL(window.location.href);
    if (tab === DEFAULT_TAB) {
        url.searchParams.delete(TAB_PARAM);
    }
    else {
        url.searchParams.set(TAB_PARAM, tab);
    }
    history.replaceState(null, '', url.toString());
}
// ---------- SVG Icons (inline, no external deps) ----------
function IconDashboard({ className }) {
    return (_jsxs("svg", { className: className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [_jsx("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1" }), _jsx("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1" }), _jsx("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1" }), _jsx("rect", { x: "14", y: "14", width: "7", height: "7", rx: "1" })] }));
}
function IconAportes({ className }) {
    return (_jsxs("svg", { className: className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [_jsx("line", { x1: "12", y1: "20", x2: "12", y2: "10" }), _jsx("line", { x1: "18", y1: "20", x2: "18", y2: "4" }), _jsx("line", { x1: "6", y1: "20", x2: "6", y2: "16" })] }));
}
function IconAtivos({ className }) {
    return (_jsxs("svg", { className: className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [_jsx("line", { x1: "8", y1: "6", x2: "21", y2: "6" }), _jsx("line", { x1: "8", y1: "12", x2: "21", y2: "12" }), _jsx("line", { x1: "8", y1: "18", x2: "21", y2: "18" }), _jsx("line", { x1: "3", y1: "6", x2: "3.01", y2: "6" }), _jsx("line", { x1: "3", y1: "12", x2: "3.01", y2: "12" }), _jsx("line", { x1: "3", y1: "18", x2: "3.01", y2: "18" })] }));
}
// ---------- Tab config ----------
export const TABS = [
    { id: 'dashboard', label: 'Dashboard', icon: _jsx(IconDashboard, { className: "h-5 w-5" }) },
    { id: 'aportes', label: 'Aportes', icon: _jsx(IconAportes, { className: "h-5 w-5" }) },
    { id: 'ativos', label: 'Ativos', icon: _jsx(IconAtivos, { className: "h-5 w-5" }) },
];
// ---------- Error boundary ----------
function SectionError() {
    return (_jsx("div", { className: "flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-8", role: "alert", children: _jsx("p", { className: "text-sm text-red-700", children: "Falha ao carregar se\u00E7\u00E3o" }) }));
}
export class TabErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidUpdate(prevProps) {
        if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
            this.setState({ hasError: false });
        }
    }
    render() {
        if (this.state.hasError) {
            return this.props.fallback;
        }
        return this.props.children;
    }
}
// ---------- Main component ----------
export function TabNavigation({ activeTab: controlledTab, onTabChange, children, }) {
    const [internalTab, setInternalTab] = useState(getTabFromUrl);
    const activeTab = controlledTab ?? internalTab;
    const handleTabChange = useCallback((tab) => {
        if (controlledTab === undefined) {
            setInternalTab(tab);
        }
        setTabInUrl(tab);
        onTabChange?.(tab);
    }, [controlledTab, onTabChange]);
    return (_jsxs("div", { className: "flex min-h-0 flex-1 flex-col", children: [_jsx("nav", { className: "hidden border-b border-gray-200 md:block", role: "tablist", "aria-label": "Navega\u00E7\u00E3o do dashboard", children: _jsx("div", { className: "flex gap-0", children: TABS.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (_jsxs("button", { type: "button", role: "tab", "aria-selected": isActive, "aria-controls": `tabpanel-${tab.id}`, id: `tab-${tab.id}`, onClick: () => handleTabChange(tab.id), className: `flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-colors ${isActive
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}`, children: [tab.icon, tab.label] }, tab.id));
                    }) }) }), _jsx("div", { id: `tabpanel-${activeTab}`, role: "tabpanel", "aria-labelledby": `tab-${activeTab}`, className: "flex-1 overflow-y-auto pb-20 md:pb-0", children: _jsx(TabErrorBoundary, { fallback: _jsx(SectionError, {}), resetKey: activeTab, children: children(activeTab) }) }), _jsx("nav", { className: "fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white md:hidden", role: "tablist", "aria-label": "Navega\u00E7\u00E3o do dashboard", children: _jsx("div", { className: "flex", children: TABS.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (_jsxs("button", { type: "button", role: "tab", "aria-selected": isActive, "aria-controls": `tabpanel-${tab.id}`, id: `tab-mobile-${tab.id}`, onClick: () => handleTabChange(tab.id), className: `relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors ${isActive
                                ? 'text-blue-600'
                                : 'text-gray-500 active:text-gray-700'}`, children: [_jsx("span", { className: isActive ? 'text-blue-600' : 'text-gray-400', children: tab.icon }), _jsx("span", { children: tab.label }), isActive && (_jsx("span", { className: "absolute top-0 left-1/2 h-0.5 w-12 -translate-x-1/2 rounded-full bg-blue-600" }))] }, tab.id));
                    }) }) })] }));
}
