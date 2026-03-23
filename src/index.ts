// Nexus Data — Data library for Azimute Blog
// Export all components, libs, and types

// === Components ===
export { default as AllocationChart } from './components/nexus/AllocationChart';
export { default as AllocationTable } from './components/nexus/AllocationTable';
export { default as AssetTable } from './components/nexus/AssetTable';
export { default as Dashboard } from './components/nexus/Dashboard';
export { default as DeviationBar } from './components/nexus/DeviationBar';
export { default as RebalanceCalculator } from './components/nexus/RebalanceCalculator';
export { default as ScoringModal } from './components/nexus/ScoringModal';
export { default as TabNavigation } from './components/nexus/TabNavigation';
export { default as PriceRefreshButton } from './components/nexus/PriceRefreshButton';

// === Mobile Components ===
export { default as MobileRebalance } from './components/mobile/MobileRebalance';
export { default as OrderBottomSheet } from './components/mobile/OrderBottomSheet';

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
export * from './lib/nexus/groups';
export * from './lib/nexus/questionnaires';
export * from './lib/nexus/rebalance';
