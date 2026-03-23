// ============================================================
// Nexus Data — Tab Navigation Component
// Bottom tabs on mobile, horizontal header tabs on desktop.
// 3 tabs: Overview | Detalhes | Rebalancear.
// Active tab has visual indicator; error boundary per section.
// [Story 8.3, ADR-006]
// ============================================================

import { Component, useState, useCallback, type ReactNode } from 'react';

// ---------- Tab definitions ----------

export type TabId = 'overview' | 'detalhes' | 'rebalancear';

export interface TabDef {
  id: TabId;
  label: string;
  icon: ReactNode;
}

// ---------- SVG Icons (inline, no external deps) ----------

function IconOverview({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconDetalhes({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function IconRebalancear({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  );
}

// ---------- Tab config ----------

export const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview', icon: <IconOverview className="h-5 w-5" /> },
  { id: 'detalhes', label: 'Detalhes', icon: <IconDetalhes className="h-5 w-5" /> },
  { id: 'rebalancear', label: 'Rebalancear', icon: <IconRebalancear className="h-5 w-5" /> },
];

// ---------- Props ----------

export interface TabNavigationProps {
  /** Currently active tab (controlled mode) */
  activeTab?: TabId;
  /** Default tab when uncontrolled */
  defaultTab?: TabId;
  /** Callback when tab changes */
  onTabChange?: (tab: TabId) => void;
  /** Content render function per tab */
  children: (activeTab: TabId) => ReactNode;
}

// ---------- Error boundary ----------

function SectionError() {
  return (
    <div className="flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-8" role="alert">
      <p className="text-sm text-red-700">Falha ao carregar seção</p>
    </div>
  );
}

interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
  resetKey: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class TabErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
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

export function TabNavigation({
  activeTab: controlledTab,
  defaultTab = 'overview',
  onTabChange,
  children,
}: TabNavigationProps) {
  const [internalTab, setInternalTab] = useState<TabId>(defaultTab);

  const activeTab = controlledTab ?? internalTab;

  const handleTabChange = useCallback(
    (tab: TabId) => {
      if (controlledTab === undefined) {
        setInternalTab(tab);
      }
      onTabChange?.(tab);
    },
    [controlledTab, onTabChange],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Desktop: horizontal tabs at top (>= 768px) */}
      <nav
        className="hidden border-b border-gray-200 md:block"
        role="tablist"
        aria-label="Navegação do dashboard"
      >
        <div className="flex gap-0">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.id}`}
                id={`tab-${tab.id}`}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Tab content */}
      <div
        id={`tabpanel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className="flex-1 overflow-y-auto pb-20 md:pb-0"
      >
        <TabErrorBoundary fallback={<SectionError />} resetKey={activeTab}>
          {children(activeTab)}
        </TabErrorBoundary>
      </div>

      {/* Mobile: bottom tabs (< 768px) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white md:hidden"
        role="tablist"
        aria-label="Navegação do dashboard"
      >
        <div className="flex">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.id}`}
                id={`tab-mobile-${tab.id}`}
                onClick={() => handleTabChange(tab.id)}
                className={`relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? 'text-blue-600'
                    : 'text-gray-500 active:text-gray-700'
                }`}
              >
                <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>{tab.icon}</span>
                <span>{tab.label}</span>
                {isActive && (
                  <span className="absolute top-0 left-1/2 h-0.5 w-12 -translate-x-1/2 rounded-full bg-blue-600" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
