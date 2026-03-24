# QA Gate — Etapa 6: Stories 15.1 + 15.2 + 15.3

| Campo | Valor |
|-------|-------|
| Gate Decision | **PASS** |
| Reviewer | Quinn (QA) — Claude Opus 4.6 |
| Date | 2026-03-24 |
| Stories | 15.1 (Dashboard Tab), 15.2 (Aportes Tab), 15.3 (Ativos Tab) |
| Epic | 15 — Tab Content |

---

## Summary

All three stories meet their acceptance criteria. 961/961 tests pass. No new TypeScript errors introduced. ADR-013 and ADR-014 compliance verified. Code quality is high with consistent patterns across all components.

---

## Test Results

| Metric | Result |
|--------|--------|
| Test Suite | **50 files, 961 tests** |
| Pass Rate | **961/961 (100%)** |
| New Tests (15.1) | 18 tests — dashboard-tab.test.ts |
| New Tests (15.2) | 10 tests — aportes-tab.test.tsx |
| New Tests (15.3) | 30 tests — ativos-tab.test.tsx (12) + asset-tree.test.tsx (18) |
| Total New Tests | **58 tests** |
| Regressions | **0** |

## TypeScript Check

| Metric | Result |
|--------|--------|
| New Errors | **0** |
| Pre-existing Errors | 2 (in `src/index.ts`) |
| Error 1 | `TS2305: Module '"./lib/supabase"' has no exported member 'supabase'` — line 60 |
| Error 2 | `TS2308: Module './lib/dashboard/allocation-utils' has already exported a member named 'formatBrl'` — line 69 |
| Assessment | Both errors are **pre-existing** (present before Etapa 6). Not related to Stories 15.1-15.3. |

---

## Story 15.1 — Dashboard Tab Content

### Acceptance Criteria Traceability

| AC | Description | Status | Evidence |
|----|-------------|--------|----------|
| AC1 | Total value BRL, allocation table, chart, deviations, refresh button, timestamp | PASS | `DashboardTab.tsx:161-189` — composes Dashboard, AllocationChart, AllocationTable, PriceRefreshButton, LastRefreshTimestamp |
| AC2 | All data filtered by active wallet_id | PASS | `wallet-data.ts:120-122` — `.eq('wallet_id', walletId)` on asset_types, asset_groups, assets |
| AC3 | USD→BRL conversion via exchange_rates | PASS | `wallet-data.ts:40-63` — `buildPriceMapBrl()` uses exchange_rates table, converts via `price * rate` |
| AC4 | Allocation chart (current vs target) | PASS | `DashboardTab.tsx:179-182` — AllocationChart receives `types` and `totalValueBrl` |
| AC5 | Empty wallet → empty state + Ativos link | PASS | `DashboardTab.tsx:152-158` — EmptyDashboard with `onNavigateAtivos` callback + URL fallback (ADR-013) |
| AC6 | Wallet switch → data refresh | PASS | `DashboardTab.tsx:128-130` — `useEffect` depends on `fetchData` which includes `activeWalletId` in `useCallback` deps |

### Test Coverage (T15.1.1 – T15.1.5)

| Test | Status | Location |
|------|--------|----------|
| T15.1.1 — Populated wallet | PASS | dashboard-tab.test.ts |
| T15.1.2 — Empty wallet | PASS | dashboard-tab.test.ts |
| T15.1.3 — USD→BRL conversion | PASS | dashboard-tab.test.ts |
| T15.1.4 — Price refresh | PASS | dashboard-tab.test.ts |
| T15.1.5 — Wallet switch | PASS | dashboard-tab.test.ts |

### Code Quality Notes

- Clean composition pattern: DashboardTab orchestrates child components without business logic leaking into JSX
- `getWalletDashboardData` avoids double-fetching by computing performance metrics from portfolio result
- Loading skeleton provides good UX during data fetch
- Error state with retry button follows accessibility patterns (role="alert")

### Verdict: **PASS**

---

## Story 15.2 — Aportes Tab Content

### Acceptance Criteria Traceability

| AC | Description | Status | Evidence |
|----|-------------|--------|----------|
| AC1 | Shows input, "Calcular" button, result area, history | PASS | `AportesTab.tsx:70-89` — composes RebalanceCalculator + ContributionHistory |
| AC2 | Pre-filled with last contribution value | PASS | `AportesTab.tsx:51` — `data[0].amount` from sorted DESC contributions |
| AC3 | Default R$ 12.000 for no contributions | PASS | `AportesTab.tsx:29` — `DEFAULT_CONTRIBUTION = 12000`, used as fallback |
| AC4 | L1→L2→L3 result with weight mode indicator | PASS | `RebalanceCalculator.tsx:67-71` — shows "(manual)" or "(questionário)" per asset; `data.ts:299-318` enriches L3Result post-rebalance |
| AC5 | Contribution history: reverse chronological | PASS | `contributions.ts:21` — `.order('contributed_at', { ascending: false })` |
| AC6 | No contributions → "Nenhum aporte registrado ainda" | PASS | `ContributionHistory.tsx:84` — exact string match |
| AC7 | All data filtered by wallet_id | PASS | `contributions.ts:20` — `.eq('wallet_id', walletId)` |

### Test Coverage (T15.2.1 – T15.2.7)

| Test | Status | Location |
|------|--------|----------|
| T15.2.1 — Pre-fill R$ 5.000 | PASS | aportes-tab.test.tsx |
| T15.2.2 — Default R$ 12.000 | PASS | aportes-tab.test.tsx |
| T15.2.3 — L1→L2→L3 result | PASS | aportes-tab.test.tsx |
| T15.2.4 — Weight mode fields | PASS | aportes-tab.test.tsx |
| T15.2.5 — 3 entries newest first | PASS | aportes-tab.test.tsx |
| T15.2.6 — No contributions message | PASS | aportes-tab.test.tsx |
| T15.2.7 — Wallet switch | PASS | aportes-tab.test.tsx |

### Code Quality Notes

- Weight mode enrichment happens in data layer (`data.ts:299-318`), keeping rebalance algorithm pure (ADR-004/ADR-015)
- `key={calc-${walletId}-${defaultContribution}}` on RebalanceCalculator forces re-mount on wallet switch — correct approach
- ContributionHistory uses semantic HTML (role="list", role="listitem")
- Distribution snapshot rendering handles unknown types safely via type assertion

### Verdict: **PASS**

---

## Story 15.3 — Ativos Tab Content

### Acceptance Criteria Traceability

| AC | Description | Status | Evidence |
|----|-------------|--------|----------|
| AC1 | Hierarchical tree: Classes → Groups → Assets | PASS | `AssetTree.tsx` renders ClassNode → GroupNode → AssetNode with visual indentation |
| AC2 | Inline CRUD at each level | PASS | `AssetTreeNode.tsx` — CreateClassForm, CreateGroupForm, CreateAssetForm + inline edit/delete buttons |
| AC3 | Weight with mode indicator | PASS | `AssetTreeNode.tsx:391-402` — `peso: {weight} ({modeLabel})` where modeLabel = "manual" or "questionário" |
| AC4 | [editar] opens DualWeightPanel as modal | PASS | `AtivosTab.tsx:344-383` — DualWeightPanel in fixed overlay with `role="dialog"` and `aria-modal="true"` |
| AC5 | Data filtered by wallet_id | PASS | `AtivosTab.tsx:95-98` — `getAssetTypes(walletId)`, `getGroups(walletId)`, `getAssets(walletId)`, `getQuestionnaires(walletId)` |
| AC6 | Class creation: name, target %, sort order | PASS | `AssetTreeNode.tsx` — CreateClassForm has name, target_pct, sort_order fields |
| AC7 | Group creation: name, target %, scoring method | PASS | `AssetTreeNode.tsx:521` — CreateGroupForm with scoring method dropdown (manual/questionnaire) |
| AC8 | Asset creation: ticker, name, sector, quantity, price source, is_active, manual_override, whole_shares | PASS | `AssetTreeNode.tsx:608-713` — CreateAssetForm with all specified fields |
| AC9 | Warning when class target % ≠ 100% | PASS | `AssetTree.tsx` — TargetWarning with `tolerancePp={0}` for classes |
| AC10 | Warning when group target % differs from 100% by >1pp | PASS | `AssetTree.tsx` — TargetWarning with `tolerancePp={1}` for groups |
| AC11 | Mobile: collapsible, touch targets | PASS | `AssetTree.tsx` — expand/collapse per level, responsive flex layouts; buttons with adequate sizing |

### Test Coverage (T15.3.1 – T15.3.10)

| Test | Status | Location |
|------|--------|----------|
| T15.3.1 — Hierarchical tree | PASS | ativos-tab.test.tsx |
| T15.3.2 — Create class form | PASS | ativos-tab.test.tsx |
| T15.3.3 — DualWeightPanel opens | PASS | ativos-tab.test.tsx |
| T15.3.4 — Weight display format | PASS | asset-tree.test.tsx |
| T15.3.5 — Class target warning | PASS | asset-tree.test.tsx |
| T15.3.6 — Group target warning | PASS | asset-tree.test.tsx |
| T15.3.7 — Create asset | PASS | ativos-tab.test.tsx |
| T15.3.8 — Delete asset | PASS | ativos-tab.test.tsx |
| T15.3.9 — Empty state | PASS | ativos-tab.test.tsx |
| T15.3.10 — Wallet switch | PASS | ativos-tab.test.tsx |

### Code Quality Notes

- Well-decomposed: 4 new components (AtivosTab, AssetTree, AssetTreeNode, TargetWarning) with clear responsibilities
- Delete cascade in local state correctly mirrors DB cascade (`handleDeleteClassConfirm` removes groups and assets)
- DualWeightPanel modal has proper accessibility: `role="dialog"`, `aria-modal="true"`, `aria-label`, close button with `aria-label="Fechar"`, backdrop click dismiss
- `computeWeightPct` helper correctly computes proportional weight within group
- TargetWarning is a focused, reusable component with configurable tolerance

### Verdict: **PASS**

---

## Cross-Story Verification

### Component Exports (src/index.ts)

| Component | Exported | Type Exported |
|-----------|----------|---------------|
| DashboardTab | Yes (line 19) | DashboardTabProps (line 20) |
| AportesTab | Yes (line 46) | AportesTabProps (line 47) |
| ContributionHistory | Yes (line 49) | ContributionHistoryProps (line 50) |
| AtivosTab | Yes (line 86) | AtivosTabProps (line 87) |
| AssetTree | Yes (line 89) | AssetTreeProps (line 90) |
| AssetTreeNode exports | Yes (line 92) | Types (line 93) |
| TargetWarning | Yes (line 95) | TargetWarningProps (line 96) |
| EmptyDashboard | Yes (line 101) | EmptyDashboardProps (line 102) |
| wallet-data functions | Yes (line 71) | Via `export *` |

**Result: All components properly exported.**

### ADR-013 Compliance (Tab Routing)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Query param `?tab=` for routing | PASS | EmptyDashboard uses `url.searchParams.set('tab', 'ativos')` as fallback |
| history.replaceState (not pushState) | PASS | EmptyDashboard.tsx:37 uses `history.replaceState` |
| Tab values: dashboard, aportes, ativos | PASS | Consistent with TabNavigation TABS definition |

### ADR-014 Compliance (Data Isolation)

| Table | wallet_id Filter | Evidence |
|-------|:---:|----------|
| asset_types | PASS | `wallet-data.ts:120`, `asset-types.ts` CRUD |
| asset_groups | PASS | `wallet-data.ts:121`, `groups.ts` CRUD |
| assets | PASS | `wallet-data.ts:122`, `assets.ts` CRUD |
| contributions | PASS | `contributions.ts:20` — `.eq('wallet_id', walletId)` |
| questionnaires | PASS | `AtivosTab.tsx:98` — `getQuestionnaires(walletId)` |
| price_cache | N/A | Global by ticker (per ADR-014) |
| exchange_rates | N/A | Global by pair (per ADR-014) |

**Result: Full ADR-014 compliance — all wallet-scoped tables filter by wallet_id.**

---

## Pre-existing Issues (Not Blocking)

| Issue | Severity | Location | Notes |
|-------|----------|----------|-------|
| TSC Error: `supabase` export | LOW | `src/index.ts:60` | Pre-existing. `getAnonClient`/`getServiceClient` are the actual exports |
| TSC Error: `formatBrl` ambiguity | LOW | `src/index.ts:69` | Pre-existing. Duplicate export from `allocation-utils` and `calculator-utils` |

**Recommendation:** Fix both in a separate cleanup task. They don't affect runtime or tests.

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|:-----------:|:------:|------------|
| Wallet data leak across wallets | Low | Medium | All queries use `.eq('wallet_id')` + RLS by user_id (ADR-014 defense-in-depth) |
| DualWeightPanel modal accessibility | Low | Low | Proper ARIA attributes, backdrop click dismiss, close button |
| Performance on large portfolios | Low | Medium | Data fetching uses `Promise.all` for parallel queries; tree rendering is client-side |
| Empty state edge cases | Low | Low | All three stories handle empty state explicitly |

---

## Gate Decision

### **PASS**

All 3 stories (15.1, 15.2, 15.3) meet their acceptance criteria. 961/961 tests pass. No new TypeScript errors. ADR compliance verified. Code quality is consistent and well-structured.

— Quinn, guardião da qualidade 🛡️
