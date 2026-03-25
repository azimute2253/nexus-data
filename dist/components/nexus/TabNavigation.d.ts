import { Component, type ReactNode } from 'react';
export type TabId = 'dashboard' | 'aportes' | 'ativos';
export interface TabDef {
    id: TabId;
    label: string;
    icon: ReactNode;
}
export declare const TABS: TabDef[];
export interface TabNavigationProps {
    /** Currently active tab (controlled mode — overrides URL state) */
    activeTab?: TabId;
    /** Callback when tab changes */
    onTabChange?: (tab: TabId) => void;
    /** Content render function per tab */
    children: (activeTab: TabId) => ReactNode;
}
interface ErrorBoundaryProps {
    fallback: ReactNode;
    children: ReactNode;
    resetKey: string;
}
interface ErrorBoundaryState {
    hasError: boolean;
}
export declare class TabErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps);
    static getDerivedStateFromError(): ErrorBoundaryState;
    componentDidUpdate(prevProps: ErrorBoundaryProps): void;
    render(): ReactNode;
}
export declare function TabNavigation({ activeTab: controlledTab, onTabChange, children, }: TabNavigationProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=TabNavigation.d.ts.map