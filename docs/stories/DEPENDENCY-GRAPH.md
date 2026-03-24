# Dependency Graph — Nexus Data User Stories

> Shows the dependency tree between all 47 stories across 15 epics (V1 + V2).
> No circular dependencies. Foundation stories come first.
> Generated: 2026-03-22 by @sm (River)
> Updated: 2026-03-24 by @sm (River) — Added V2 stories (10.1 to 15.3)

---

## V1 Dependency Tree (Visual)

```
Layer 0 (No dependencies — start here)
├── 1.1  Supabase Schema
│
Layer 1 (Depends on schema)
├── 1.2  RLS Policies ──────────────────── → 1.1
├── 2.1  CSV Parser ────────────────────── → 1.1
│
Layer 2 (Depends on RLS/Auth)
├── 1.3  Auth Integration ──────────────── → 1.2
├── 3.1  brapi Adapter ────────────────── → 1.1, 1.2
├── 3.3  Exchange Rate Adapter ─────────── → 1.1, 3.1(interface)
│
Layer 3 (Depends on Auth + Adapters)
├── 3.2  Yahoo Adapter ────────────────── → 1.1, 3.1(interface)
├── 4.1  L1 Distribution ──────────────── → 1.1
├── 9.1  Route Structure ──────────────── → 1.3, 1.1
│
Layer 4 (Depends on providers + L1)
├── 2.2  Migration Script ─────────────── → 1.1, 1.2, 2.1
├── 3.4  Price Cron Edge Function ──────── → 3.1, 3.2, 3.3, 1.1
├── 4.2  L2 Distribution ──────────────── → 4.1
├── 6.1  CRUD Asset Types ─────────────── → 1.1, 1.2, 1.3, 9.1
├── 9.2  Layout Integration ───────────── → 9.1, 1.3
├── 7.1  Questionnaire Editor ─────────── → 1.1, 9.1
│
Layer 5 (Depends on L2 + Migration + Cron)
├── 4.3  L3 Distribution ──────────────── → 4.2, 7.3
├── 6.2  CRUD Groups ──────────────────── → 6.1, 1.1
├── 7.3  Score Normalization ──────────── → 7.2, 4.3(circular→break)
├── 5.1  Portfolio Summary ────────────── → 1.1, 3.4, 2.2
├── 3.5  Manual Refresh Button ────────── → 3.4, 5.1
├── 9.3  Feature Flag & Staleness UI ──── → 9.1, 3.4
│
Layer 6 (Depends on L3 + Data Layer)
├── 4.4  Orchestrator + Parity Tests ──── → 4.1, 4.2, 4.3
├── 6.3  CRUD Assets ──────────────────── → 6.2, 3.4, 1.1
├── 5.2  Allocation Table ─────────────── → 5.1
├── 5.3  Allocation Chart ─────────────── → 5.1
├── 5.4  Deviation Indicators ─────────── → 5.2
├── 7.2  Scoring Modal ────────────────── → 7.1, 6.3
│
Layer 7 (Depends on calculator + CRUD)
├── 2.3  Parity Validation ────────────── → 2.2, 4.1, 4.2, 4.3
├── 5.5  Rebalance Calculator UI ──────── → 4.4, 5.1, 3.4
├── 6.4  Asset Flags ──────────────────── → 6.3
│
Layer 8 (Depends on UI components)
├── 8.1  Card-Based Mobile Layout ──────── → 5.2, 6.3, 5.1
├── 8.2  Mobile Rebalance Flow ────────── → 5.5, 8.1
├── 8.3  Tab Navigation ──────────────── → 5.1, 5.5, 9.1
```

---

## V2 Dependency Tree (Visual)

```
V2 Layer 0 (Can start with V1 complete, or parallel to late V1)
├── 10.1 Fix /api/asset-types ─────────── → 1.1, 1.2 (V1)
├── 11.1 Create wallets Table ─────────── → 1.1, 1.2 (V1)
│
V2 Layer 1 (Depends on wallets table)
├── 11.2 Add wallet_id FK to Tables ───── → 11.1
│
V2 Layer 2 (Depends on wallet_id migration)
├── 11.3 Wallet Data Access Layer ──────── → 11.2
├── 14.1 Dual Weight Schema & Data ─────── → 11.2
│
V2 Layer 3 (Depends on data layer + existing V1 UI)
├── 12.1 Wallet Selector ──────────────── → 11.3
├── 13.1 Tab Navigation V2 ────────────── → 8.3 (V1), 9.1 (V1)
├── 13.2 Rename to "Nexus Data" ────────── → 9.2 (V1)
├── 14.2 Dual Weight UI ───────────────── → 14.1, 7.2 (V1)
│
V2 Layer 4 (Depends on selector + tabs)
├── 12.2 Wallet Management CRUD ────────── → 12.1
├── 12.3 Onboarding Flow ──────────────── → 11.3, 13.1
│
V2 Layer 5 (Depends on all infrastructure)
├── 15.1 Tab Dashboard Content ─────────── → 13.1, 11.3, 5.1-5.4 (V1), 3.5 (V1)
├── 15.2 Tab Aportes Content ──────────── → 13.1, 11.3, 5.5 (V1), 4.4 (V1)
├── 15.3 Tab Ativos Content ──────────── → 13.1, 11.3, 14.2, 6.1-6.3 (V1)
```

---

## V2 Dependency Matrix (Table Format)

| Story | Depends On | Depended On By |
|-------|-----------|----------------|
| **10.1** | 1.1, 1.2 | None (bug fix) |
| **11.1** | 1.1, 1.2 | 11.2 |
| **11.2** | 11.1 | 11.3, 14.1 |
| **11.3** | 11.2 | 12.1, 12.3, 15.1, 15.2, 15.3 |
| **12.1** | 11.3 | 12.2 |
| **12.2** | 12.1 | None |
| **12.3** | 11.3, 13.1 | None |
| **13.1** | 8.3, 9.1 | 12.3, 15.1, 15.2, 15.3 |
| **13.2** | 9.2 | None |
| **14.1** | 11.2 | 14.2 |
| **14.2** | 14.1, 7.2 | 15.3 |
| **15.1** | 13.1, 11.3, 5.1, 5.2, 5.3, 5.4, 3.5 | None |
| **15.2** | 13.1, 11.3, 5.5, 4.4 | None |
| **15.3** | 13.1, 11.3, 14.2, 6.1, 6.2, 6.3 | None |

---

## V1 Dependency Matrix (Table Format — unchanged)

| Story | Depends On | Depended On By |
|-------|-----------|----------------|
| **1.1** | None | 1.2, 2.1, 2.2, 3.1, 3.3, 4.1, 5.1, 6.1, 6.2, 6.3, 7.1, 9.1, 10.1, 11.1 |
| **1.2** | 1.1 | 1.3, 2.2, 3.1, 6.1, 10.1, 11.1 |
| **1.3** | 1.2 | 6.1, 9.1, 9.2 |
| **2.1** | 1.1 | 2.2 |
| **2.2** | 1.1, 1.2, 2.1 | 2.3, 5.1 |
| **2.3** | 2.2, 4.1, 4.2, 4.3 | None (validation gate) |
| **3.1** | 1.1, 1.2 | 3.2, 3.3, 3.4 |
| **3.2** | 1.1, 3.1 | 3.4 |
| **3.3** | 1.1, 3.1 | 3.4 |
| **3.4** | 3.1, 3.2, 3.3, 1.1 | 3.5, 5.1, 5.5, 6.3, 9.3 |
| **3.5** | 3.4, 5.1 | 15.1 |
| **4.1** | 1.1 | 4.2, 4.4, 2.3 |
| **4.2** | 4.1 | 4.3, 4.4, 2.3 |
| **4.3** | 4.2, 7.3 | 4.4, 2.3 |
| **4.4** | 4.1, 4.2, 4.3 | 5.5, 15.2 |
| **5.1** | 1.1, 3.4, 2.2 | 5.2, 5.3, 5.5, 3.5, 8.1, 8.3, 15.1 |
| **5.2** | 5.1 | 5.4, 8.1, 15.1 |
| **5.3** | 5.1 | 15.1 |
| **5.4** | 5.2 | 15.1 |
| **5.5** | 4.4, 5.1, 3.4 | 8.2, 8.3, 15.2 |
| **6.1** | 1.1, 1.2, 1.3, 9.1 | 6.2, 15.3 |
| **6.2** | 6.1, 1.1 | 6.3, 15.3 |
| **6.3** | 6.2, 3.4, 1.1 | 6.4, 7.2, 8.1, 15.3 |
| **6.4** | 6.3 | None |
| **7.1** | 1.1, 9.1 | 7.2 |
| **7.2** | 7.1, 6.3 | 7.3, 14.2 |
| **7.3** | 7.2 | 4.3 |
| **8.1** | 5.2, 6.3, 5.1 | 8.2 |
| **8.2** | 5.5, 8.1 | None |
| **8.3** | 5.1, 5.5, 9.1 | 13.1 |
| **9.1** | 1.3, 1.1 | 6.1, 7.1, 8.3, 9.2, 9.3, 13.1 |
| **9.2** | 9.1, 1.3 | 13.2 |
| **9.3** | 9.1, 3.4 | None |

---

## Circular Dependency Resolution

**V1 Potential circular:** 4.3 (L3) → 7.3 (normalization) → 7.2 (scoring modal) → 6.3 (assets) → ... → 4.3

**Resolution:** Story 7.3 (Score Normalization) is a **pure function** that can be developed and tested independently with mock score data. Story 4.3 depends on the `normalizeScores()` function existing, not on the full scoring UI being complete.

**V2:** No circular dependencies. All V2 stories flow linearly from foundation (11.x) → UX (12.x, 13.x) → features (14.x) → integration (15.x).

---

## Critical Path

### V1 Critical Path (unchanged)
```
1.1 → 1.2 → 1.3 → 9.1 → 6.1 → 6.2 → 6.3 → 7.2 → 7.3 → 4.3 → 4.4 → 5.5 → 8.2
                                                                                (13 stories)
```

### V2 Critical Path
```
11.1 → 11.2 → 11.3 → 12.1 → 12.2          (wallet infrastructure → UX)
                  ↓
                14.1 → 14.2 → 15.3          (dual weight → ativos tab)

8.3 → 13.1 → 15.1, 15.2, 15.3              (tabs → content)
```

**Longest V2 chain:**
```
1.1 → 1.2 → 11.1 → 11.2 → 14.1 → 14.2 → 15.3    (7 stories)
```

### V2 Parallel Tracks

**Track A (Multi-Wallet Foundation):**
```
11.1 → 11.2 → 11.3 → 12.1 → 12.2
                   └── 12.3 (after 13.1)
```

**Track B (Navigation & Branding):**
```
8.3 → 13.1
9.2 → 13.2
```

**Track C (Dual Weight):**
```
11.2 → 14.1 → 14.2
```

**Track D (Tab Content — final integration):**
```
13.1 + 11.3 → 15.1, 15.2, 15.3
```

**Track E (Bug Fix — independent):**
```
10.1 (can start immediately)
```

---

## Recommended V2 Implementation Order

| Wave | Stories | Theme | Points |
|------|---------|-------|--------|
| Wave 1 | 10.1, 11.1 | Bug fix + wallets table | 4 |
| Wave 2 | 11.2, 13.2 | Migration + rename | 4 |
| Wave 3 | 11.3, 14.1, 13.1 | Data layer + dual weight schema + tabs | 9 |
| Wave 4 | 12.1, 12.2, 14.2 | Wallet UX + dual weight UI | 7 |
| Wave 5 | 12.3, 15.1, 15.2, 15.3 | Onboarding + tab content | 14 |
| **TOTAL** | **14 stories** | | **38 points** |
