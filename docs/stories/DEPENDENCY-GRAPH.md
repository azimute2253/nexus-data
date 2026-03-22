# Dependency Graph — Nexus Data User Stories

> Shows the dependency tree between all 33 stories across 9 epics.
> No circular dependencies. Foundation stories come first.
> Generated: 2026-03-22 by @sm (River)

---

## Dependency Tree (Visual)

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

## Dependency Matrix (Table Format)

| Story | Depends On | Depended On By |
|-------|-----------|----------------|
| **1.1** | None | 1.2, 2.1, 2.2, 3.1, 3.3, 4.1, 5.1, 6.1, 6.2, 6.3, 7.1, 9.1 |
| **1.2** | 1.1 | 1.3, 2.2, 3.1, 6.1 |
| **1.3** | 1.2 | 6.1, 9.1, 9.2 |
| **2.1** | 1.1 | 2.2 |
| **2.2** | 1.1, 1.2, 2.1 | 2.3, 5.1 |
| **2.3** | 2.2, 4.1, 4.2, 4.3 | None (validation gate) |
| **3.1** | 1.1, 1.2 | 3.2, 3.3, 3.4 |
| **3.2** | 1.1, 3.1 | 3.4 |
| **3.3** | 1.1, 3.1 | 3.4 |
| **3.4** | 3.1, 3.2, 3.3, 1.1 | 3.5, 5.1, 5.5, 6.3, 9.3 |
| **3.5** | 3.4, 5.1 | None |
| **4.1** | 1.1 | 4.2, 4.4, 2.3 |
| **4.2** | 4.1 | 4.3, 4.4, 2.3 |
| **4.3** | 4.2, 7.3 | 4.4, 2.3 |
| **4.4** | 4.1, 4.2, 4.3 | 5.5 |
| **5.1** | 1.1, 3.4, 2.2 | 5.2, 5.3, 5.5, 3.5, 8.1, 8.3 |
| **5.2** | 5.1 | 5.4, 8.1 |
| **5.3** | 5.1 | None |
| **5.4** | 5.2 | None |
| **5.5** | 4.4, 5.1, 3.4 | 8.2, 8.3 |
| **6.1** | 1.1, 1.2, 1.3, 9.1 | 6.2 |
| **6.2** | 6.1, 1.1 | 6.3 |
| **6.3** | 6.2, 3.4, 1.1 | 6.4, 7.2, 8.1 |
| **6.4** | 6.3 | None |
| **7.1** | 1.1, 9.1 | 7.2 |
| **7.2** | 7.1, 6.3 | 7.3 |
| **7.3** | 7.2 | 4.3 |
| **8.1** | 5.2, 6.3, 5.1 | 8.2 |
| **8.2** | 5.5, 8.1 | None |
| **8.3** | 5.1, 5.5, 9.1 | None |
| **9.1** | 1.3, 1.1 | 6.1, 7.1, 8.3, 9.2, 9.3 |
| **9.2** | 9.1, 1.3 | None |
| **9.3** | 9.1, 3.4 | None |

---

## Circular Dependency Resolution

**Potential circular:** 4.3 (L3) → 7.3 (normalization) → 7.2 (scoring modal) → 6.3 (assets) → ... → 4.3

**Resolution:** Story 7.3 (Score Normalization) is a **pure function** that can be developed and tested independently with mock score data. Story 4.3 depends on the `normalizeScores()` function existing, not on the full scoring UI being complete. Therefore:

1. Develop 7.3 (normalizeScores function) with unit tests using hardcoded scores
2. Develop 4.3 (L3 distribution) consuming normalizeScores
3. Later, develop 7.2 (scoring modal UI) which writes scores that 7.3 normalizes

This breaks the circular dependency by treating 7.3 as a pure-function utility, not as a UI feature.

---

## Critical Path (Longest Chain)

```
1.1 → 1.2 → 1.3 → 9.1 → 6.1 → 6.2 → 6.3 → 7.2 → 7.3 → 4.3 → 4.4 → 5.5 → 8.2
                                                                                (13 stories)
```

**Parallel Track A (Price Engine):**
```
1.1 → 3.1 → 3.2 → 3.4 → 5.1 → 5.2 → 5.4
                              → 5.3
```

**Parallel Track B (Algorithm):**
```
1.1 → 4.1 → 4.2 → (wait for 7.3) → 4.3 → 4.4
```

**Parallel Track C (Migration):**
```
1.1 → 2.1 → 2.2 → (wait for 4.1-4.3) → 2.3
```

---

## Recommended Implementation Order

| Sprint | Stories | Theme |
|--------|---------|-------|
| Sprint 1 | 1.1, 1.2, 1.3, 4.1 | Schema + Auth + L1 Algorithm |
| Sprint 2 | 3.1, 3.3, 2.1, 4.2, 7.3, 9.1 | Price Adapters + Parser + L2 + Normalization + Routes |
| Sprint 3 | 3.2, 3.4, 2.2, 4.3, 6.1, 7.1 | Yahoo + Cron + Migration + L3 + Type CRUD + Questionnaire |
| Sprint 4 | 4.4, 5.1, 6.2, 9.2 | Orchestrator + Dashboard Data + Group CRUD + Layout |
| Sprint 5 | 5.2, 5.3, 5.4, 5.5, 6.3, 6.4, 7.2 | Dashboard UI + Asset CRUD + Scoring Modal |
| Sprint 6 | 2.3, 3.5, 8.1, 8.2, 8.3, 9.3 | Validation + Mobile + Feature Flag |
