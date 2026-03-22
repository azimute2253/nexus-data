# ADR-004: Rebalancing Algorithm Architecture

## Metadata

| Campo | Valor |
|-------|-------|
| Status | Accepted |
| Date | 2026-03-22 |
| Deciders | Luis (product owner), Aria (@architect) |
| Related ADRs | [ADR-002](ADR-002-database.md) (data source for algorithm inputs — portfolio structure), [ADR-003](ADR-003-quote-price-api-strategy.md) (price data consumed by algorithm), [ADR-005](ADR-005-price-caching-strategy.md) (cached prices feeding into algorithm), [ADR-006](ADR-006-frontend-architecture.md) (client-side execution in React islands for responsiveness) |

---

## Context

The rebalancing algorithm is the core intellectual property of Nexus Data. It implements a **3-level cascade** that distributes a contribution (aporte) amount across the portfolio:

- **L1 (Type):** Distribute aporte across 10 asset classes based on target % vs actual %, skipping overweight classes (e.g., FIIs at 65% vs 15% target get R$ 0)
- **L2 (Group):** Within each type, distribute among groups based on group target %
- **L3 (Asset):** Within each group, distribute among individual assets based on normalized scores from questionnaires, applying FLOOR for whole-share assets (ações, FIIs) and fractional for ETFs

The algorithm must produce results **identical to the existing spreadsheet** (tolerance < R$ 1/ativo). This is the primary success metric (G1/O1 in PRD). The spreadsheet has 2,000+ formulas implementing this cascade.

**Current scale:** ~R$ 243K portfolio, 131+ assets, 10 asset classes, ~15 groups. Typical aporte: R$ 12,000. Single user.

**Constraints from PRD:**
- Must achieve parity with spreadsheet calculations (tolerance < R$ 1/asset)
- Must execute in < 500ms for 131+ assets
- Must work on mobile (< 3s FCP budget — algorithm execution is part of this budget)
- Must be testable with unit tests (Vitest)
- Must be shared between server and client contexts (isomorphic)
- Pure function — input: portfolio data + prices + contribution amount → output: allocation per asset
- Phase 2 what-if slider (F-013) requires recalculation on every slider tick (~50-100 recalculations per interaction)

**When to revisit this decision:**
- If the algorithm needs to account for transaction costs or taxes (currently excluded)
- If multi-currency rebalancing logic becomes too complex for a single function (e.g., separate FX hedging)
- If Phase 3 projections (F-018) require iterative simulation that is too slow client-side (>500ms)
- If a need arises for server-side validation of rebalancing results (e.g., audit trail)

---

## Decision

**Implement the rebalancing algorithm as a pure TypeScript function in `src/lib/nexus/rebalance.ts`**, shared between client (React islands) and server (Edge Functions/SSR). The function is stateless, deterministic, and side-effect-free.

```
rebalance(
  portfolio: Portfolio,      // types, groups, assets, scores
  prices: PriceMap,          // ticker → price in BRL
  exchangeRates: RateMap,    // currency pair → rate
  contribution: number       // aporte in BRL
): RebalanceResult           // per-asset: ticker, shares_to_buy, amount_brl
```

Architecture:
- **Pure function** — no database calls, no API calls, no side effects
- **Isomorphic** — runs identically in browser (React island) and server (Edge Function / SSR)
- **Deterministic** — same inputs always produce same outputs (no random, no Date.now())
- **Testable** — unit tests compare output against spreadsheet reference data
- **Single file** — all 3 cascade levels in one module with clear internal functions (`distributeL1`, `distributeL2`, `distributeL3`)

---

## Alternatives Considered

### Alternative A: Server-only (Supabase Edge Function)

**Approach:** Implement the algorithm exclusively in a Supabase Edge Function. Client sends contribution amount, server returns allocation result.

| Pros | Cons |
|------|------|
| Server controls all computation — no risk of client-side tampering | Network round-trip adds 200-500ms latency (Edge Function cold start + DB query + computation) |
| Single execution environment — no isomorphic complexity | Cannot work offline or with stale/cached data |
| API keys and prices already available server-side | Phase 2 "what-if slider" (F-013) becomes impractical — each slider tick = 1 API call |
| | Unit testing requires mocking Supabase Edge Function runtime (Deno) |
| | Edge Function invocation count: slider simulation could burn 50-100 invocations per session |
| | Violates < 500ms performance target when including network latency on mobile (4G) |

**Why rejected:** The Phase 2 "what-if slider" (F-013) requires recalculating rebalancing on every slider change — potentially 50-100 recalculations per interaction. Server-only means 50-100 Edge Function invocations per slider session, eating into the 500K/month free tier and adding perceptible latency (~200-500ms per tick). A pure client-side function executes in <10ms, enabling real-time slider response with zero API cost.

### Alternative B: Database-computed (Postgres SQL/plpgsql)

**Approach:** Implement the cascade logic as a Postgres stored procedure (`SELECT * FROM calculate_rebalance(12000)`). All computation happens in the database.

| Pros | Cons |
|------|------|
| Data and computation co-located — no data transfer overhead | SQL is poorly suited for 3-level cascade with conditional logic, FLOOR/fractional branching, and score normalization |
| Atomic — reads consistent snapshot of all tables | Extremely hard to unit test (requires running Postgres instance + pgTAP framework) |
| Could use materialized views for intermediate results | Debugging SQL stored procedures is painful — no breakpoints, limited logging (RAISE NOTICE) |
| | ~500-800 LOC of plpgsql for the full cascade vs ~200-300 LOC TypeScript |
| | Cannot run client-side — Phase 2 what-if slider impossible |
| | Postgres plpgsql has no type safety, no IDE support for complex business logic |
| | Changes to the algorithm require database migration, not just code deploy |

**Why rejected:** The rebalancing algorithm is complex business logic with 3 nested levels, conditional branching (overweight skip, FLOOR vs fractional), and score normalization. This is precisely the kind of logic that is painful in SQL and natural in TypeScript. Additionally, database-only execution makes the Phase 2 slider impossible and prevents unit testing with standard tooling (Vitest).

### Alternative C: Client-only (React component state)

**Approach:** Implement the algorithm purely in the React component. Fetch all data to the client, compute locally. No server-side execution path ever.

| Pros | Cons |
|------|------|
| Simplest architecture — no isomorphic concerns | All portfolio data must be transferred to client on every page load (~50-100 KB JSON) |
| Instant computation (<10ms) with zero API cost | Cannot use in server-side contexts (SSR, cron jobs, API endpoints) |
| No Edge Function invocations for rebalancing | Phase 3 normalization projections (F-018) need server-side execution for automated snapshots |
| Works offline with cached data | Would require duplicating algorithm logic if server-side use case arises |
| | No server-side validation of rebalancing results (irrelevant for single user) |

**Why rejected:** While client-only works for the MVP interactive use case, Phase 3 requires server-side execution for contribution history snapshots and normalization projections (F-018). Duplicating the algorithm in two contexts (client-only React + server-only Edge Function) guarantees divergence over time. A shared TypeScript module that runs in both contexts is the correct abstraction — write once, use everywhere.

---

## Trade-offs

| Dimension | Shared TS function (chosen) | Server-only (Edge Function) | Database SQL | Client-only |
|-----------|----------------------------|----------------------------|-------------|-------------|
| Execution latency | <10ms (client), <50ms (server) | 200-500ms (network + cold start) | <50ms (co-located with data) | <10ms |
| What-if slider feasibility | Native (<10ms per tick, 0 API calls) | Impractical (50-100 API calls/session) | Impossible (no client execution) | Native (<10ms) |
| Testability | Vitest unit tests, ~5 LOC per test case | Requires Deno runtime + Supabase mock | Requires PG instance + pgTAP | Jest/Vitest |
| Code size | ~200-300 LOC TypeScript | ~200-300 LOC TypeScript (Deno) | ~500-800 LOC plpgsql | ~200-300 LOC TypeScript |
| Reuse in cron/SSR/Phase 3 | Import and call (same module) | Native (already server-side) | Native (SQL callable) | Must duplicate to server |
| Debugging | VS Code breakpoints, source maps | Supabase CLI logs, limited debugging | pg_debug / RAISE NOTICE | Browser DevTools |
| Spreadsheet parity testing | Compare TS output vs reference JSON fixture | Same | SQL vs reference: harder to automate | Same |
| Client bundle impact | ~5-10 KB (algorithm code shipped to browser) | 0 KB (server-only) | 0 KB | ~5-10 KB |

---

## Consequences

### Positive

- **Single source of truth** — one `rebalance.ts` file is THE algorithm, used everywhere (client, server, tests, cron)
- **Instant feedback** — client-side execution enables Phase 2 what-if slider with zero latency and zero API cost
- **First-class testing** — Vitest unit tests can compare algorithm output against spreadsheet reference data with exact precision (< R$ 1/asset tolerance)
- **Readable business logic** — TypeScript with named functions (`distributeL1`, `distributeL2`, `distributeL3`) is self-documenting
- **Deterministic** — pure function guarantees same inputs → same outputs, critical for spreadsheet parity validation

### Negative

- **Client receives full portfolio data** — all types, groups, assets, scores, and prices must be loaded to the client for client-side computation (~50-100 KB JSON). Acceptable for single user, but not scalable for multi-tenant
- **No server-side validation gate** — if client-side code is tampered with, wrong results could be displayed (irrelevant for single-user with no financial transactions — Nexus Data only calculates, it doesn't execute trades)
- **Algorithm changes require full rebuild** — since the module is shared via import, any change triggers full Astro rebuild for both blog and portfolio (mitigated: algorithm changes are rare post-parity-validation; rebuild takes ~30-60s)
- **Isomorphic constraints** — the function cannot use browser-only APIs (DOM, window) or server-only APIs (fs, process); must be pure computation only

### Obligations

1. **Parity test suite** — MUST create a test suite with at least 3 reference scenarios extracted from the actual spreadsheet. Each test compares Nexus Data output against spreadsheet output with tolerance < R$ 1/asset. Run on every CI build
2. **Pure function contract** — `rebalance()` MUST NOT import Supabase client, fetch API, or any side-effectful module. Inputs are plain objects, output is plain object. Zero dependencies beyond TypeScript standard library
3. **FLOOR/fractional specification** — The function MUST apply `Math.floor()` for asset types marked as `whole_shares = true` (ações, FIIs) and allow fractional quantities for `whole_shares = false` (ETFs internacionais)
4. **Score normalization specification** — MUST support negative scores (e.g., -10 for XPLG11) and normalize within group such that even negative-scored assets get a non-negative allocation weight proportional to their relative score
5. **Edge case documentation** — MUST document and test edge cases: zero contribution, all classes overweight, single asset in group, asset with score of 0, group with all inactive assets, negative total score in a group
