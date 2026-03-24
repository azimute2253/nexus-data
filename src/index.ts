// Nexus Data — Data library for Azimute Blog
// Export all components, libs, and types

// === Components ===
export { AllocationChart } from './components/nexus/AllocationChart';
export type { AllocationChartProps } from './components/nexus/AllocationChart';
export { buildActualSlices, buildTargetSlices, getColor } from './components/nexus/AllocationChart';
export type { ChartSlice } from './components/nexus/AllocationChart';

export { AllocationTable } from './components/nexus/AllocationTable';
export type { AllocationTableProps } from './components/nexus/AllocationTable';

export { AssetTable } from './components/nexus/AssetTable';
export type { AssetTableProps } from './components/nexus/AssetTable';

export { Dashboard } from './components/nexus/Dashboard';
export type { DashboardProps } from './components/nexus/Dashboard';

export { DeviationBar, getDeviationLevel, getBarWidthPct, MAX_DEVIATION_PP, ALIGNED_THRESHOLD_PP, SIGNIFICANT_THRESHOLD_PP } from './components/nexus/DeviationBar';
export type { DeviationBarProps, DeviationLevel } from './components/nexus/DeviationBar';

export { RebalanceCalculator } from './components/nexus/RebalanceCalculator';
export type { RebalanceCalculatorProps } from './components/nexus/RebalanceCalculator';

export { ScoringModal } from './components/nexus/ScoringModal';
export type { ScoringModalProps } from './components/nexus/ScoringModal';

export { TabNavigation, TabErrorBoundary, TABS } from './components/nexus/TabNavigation';
export type { TabNavigationProps, TabId, TabDef } from './components/nexus/TabNavigation';

export { PriceRefreshButton } from './components/nexus/PriceRefreshButton';
export type { PriceRefreshButtonProps } from './components/nexus/PriceRefreshButton';

export { WalletSelector } from './components/nexus/WalletSelector';
export type { WalletSelectorProps } from './components/nexus/WalletSelector';

// === Mobile Components ===
export { MobileRebalance } from './components/mobile/MobileRebalance';
export type { MobileRebalanceProps } from './components/mobile/MobileRebalance';

export { OrderBottomSheet } from './components/mobile/OrderBottomSheet';
export type { OrderBottomSheetProps } from './components/mobile/OrderBottomSheet';

// === Supabase Client ===
export { supabase } from './lib/supabase';

// === Feature Flags ===
export { getFeatureFlag } from './lib/feature-flags/client';

// === Dashboard Utils ===
export * from './lib/dashboard/types';
export * from './lib/dashboard/data';
export * from './lib/dashboard/allocation-utils';
export * from './lib/dashboard/calculator-utils';
export * from './lib/dashboard/refresh';

// === Nexus CRUD ===
export * from './lib/nexus/types';
export * from './lib/nexus/assets';
export * from './lib/nexus/asset-scores';
export * from './lib/nexus/asset-types';
export * from './lib/nexus/contributions';
export * from './lib/nexus/groups';
export * from './lib/nexus/questionnaires';
export * from './lib/nexus/wallets';
export * from './lib/nexus/rebalance';
export * from './lib/nexus/data';
