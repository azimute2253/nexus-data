# ADR-003: Quote/Price API Strategy

## Metadata

| Campo | Valor |
|-------|-------|
| Status | Accepted |
| Date | 2026-03-22 |
| Deciders | Luis (product owner), Aria (@architect) |
| Related ADRs | [ADR-001](ADR-001-integration-strategy.md) (Edge Functions hosted in shared Supabase infrastructure), [ADR-002](ADR-002-database.md) (price_cache and price_fetch_log tables), [ADR-004](ADR-004-rebalancing-algorithm-architecture.md) (algorithm consumes price data as input), [ADR-005](ADR-005-price-caching-strategy.md) (caching layer for API responses), [ADR-007](ADR-007-authentication-security.md) (API keys stored as Edge Function secrets) |

---

## Context

Nexus Data must fetch real-time prices for 131+ assets across 3 markets:
- **B3 (Brazil):** 91 ações + 20 FIIs = ~111 tickers → need a Brazilian market API
- **International:** ~20 ETFs (QQQM, SCHD, AVUV, SCHY, VNQI, BNDX, IAGG, EIMI, VWO, VXUS, VEA, AVES, EWZ, etc.) → need a US/global market API
- **Forex:** USD/BRL, BTC/BRL → need an exchange rate API

The current Google Sheets solution uses `GOOGLEFINANCE()` which fails silently 5-10% of the time, returning `#N/A` and corrupting the entire calculation cascade. This is the #1 pain point driving the project (Creative problem #1).

**Current scale:** ~R$ 243K portfolio across 131+ assets in 10 classes. Single user (Luis). Monthly contributions of ~R$ 12,000.

**Constraints from PRD:**
- Budget: R$ 0/month — only free tier APIs
- brapi.dev free tier: 15,000 requests/month
- exchangerate-api.com free tier: 1,500 requests/month
- Yahoo Finance: unofficial API, no SLA, no rate limit documentation
- API keys must be server-side only (Supabase Edge Functions) — client never calls price APIs directly
- Must support batch requests to stay within rate limits
- Fallback visual when API fails (show last price + timestamp)
- PRD Success Metric: < 1% of requests return error per day

**When to revisit this decision:**
- If brapi.dev changes pricing, rate limits, or discontinues free tier
- If Yahoo Finance endpoints break or become permanently unavailable for any of the ~20 ETF tickers
- If exchangerate-api.com free tier becomes insufficient (e.g., crypto portfolio grows)
- If portfolio grows beyond 200 tickers (request budget math changes significantly)
- If a single consolidated API emerges that covers B3 + international + forex within free tier limits

---

## Decision

**Use a multi-provider strategy with 3 specialized APIs**, each serving the asset class it covers best:

| Provider | Asset Class | Tickers | Protocol |
|----------|------------|---------|----------|
| **brapi.dev** | Ações B3 + FIIs | ~111 | REST, batch of 20/request → 6 requests per refresh |
| **Yahoo Finance** (unofficial) | ETFs internacionais | ~20 | REST via `query2.finance.yahoo.com`, single ticker/request → 20 requests per refresh |
| **exchangerate-api.com** | Câmbio (USD/BRL, BTC/BRL, EUR/BRL) | 2-3 pairs | REST, 1 request per refresh |

All API calls are made exclusively from **Supabase Edge Functions** (Deno runtime). The client never calls price APIs directly. Results are written to the `price_cache` table (see ADR-005) with TTL metadata.

**Yahoo Finance mitigation plan** (critical — no SLA):
1. **Pre-MVP validation:** Test all ~20 ETF tickers during Sprint 1; confirm valid price response for each. Document results
2. **Fallback to manual:** Each asset has `price_source` field; if Yahoo fails persistently, set to `'manual'` and enter price via UI
3. **Staleness indicator:** If a cached price is older than 24 hours, UI shows warning badge with timestamp of last update
4. **Error logging:** All API failures logged to `price_fetch_log` table for monitoring (see Success Metrics in PRD)
5. **Circuit breaker:** If Yahoo returns 3 consecutive errors for a ticker, stop retrying for 1 hour; surface alert in UI

---

## Alternatives Considered

### Alternative A: Single Provider — Alpha Vantage for all assets

**Approach:** Use Alpha Vantage API for Brazilian stocks (via `BSP:` prefix), US ETFs, and forex — one provider for everything.

| Pros | Cons |
|------|------|
| Single API to integrate and maintain (~100 LOC) | Free tier: 25 requests/day (not per month — per DAY) |
| Covers global markets + forex in one interface | 25 req/day is catastrophically insufficient for 131+ tickers |
| Well-documented with stable, versioned endpoints | Brazilian market coverage is inconsistent — many B3 tickers missing or 15-min delayed |
| Standard API key auth (simple integration) | Premium tier starts at $49.99/month (~R$ 260), violates R$ 0 budget |
| | No batch endpoint — 1 request per ticker |

**Why rejected:** 25 requests/day cannot serve 131+ tickers even with aggressive caching. Would need ~131 requests per full refresh, meaning one refresh every 5 days. Completely unusable for the "check prices during pregão" use case. Premium tier ($49.99/month) violates the R$ 0 budget constraint.

### Alternative B: Single Provider — HG Brasil API

**Approach:** Use HG Brasil Finance API which specializes in Brazilian market data.

| Pros | Cons |
|------|------|
| Brazilian company, excellent B3 coverage for stocks and FIIs | Free tier: 500 requests/day (15,000/month), same as brapi |
| Covers B3 stocks, FIIs, and BRL forex in one API | Does NOT cover US/international ETFs at all |
| Reliable, official API with documented SLA | Would still need Yahoo Finance or another API for ~20 ETFs |
| Documentation entirely in Portuguese | No batch endpoint on free tier — 111 individual requests vs brapi's 6 batch requests |

**Why rejected:** While HG Brasil is excellent for B3 data, it doesn't cover international ETFs — the exact gap Yahoo Finance fills. Using HG Brasil instead of brapi.dev would still require 2 providers. brapi.dev was chosen over HG Brasil specifically because brapi.dev offers batch requests (20 tickers/request), significantly reducing request count: 6 batch requests vs 111 individual requests per refresh cycle. This saves ~105 requests per refresh.

### Alternative C: Manual-only prices (no APIs)

**Approach:** User manually inputs all prices via the UI. No external API integration.

| Pros | Cons |
|------|------|
| Zero API dependency, zero API cost | User must manually enter 131+ prices before each rebalancing |
| No rate limits, no API failures, no API key management | Estimated time: 30-60 minutes to update all prices manually |
| 100% reliable (user enters what they see on corretora) | Completely defeats the purpose of replacing the spreadsheet |
| | Prices would be stale by the time all 131 are entered |
| | Directly violates PRD Goal G2 (confiabilidade das cotações) and Objective O2 (preços via APIs dedicadas) |

**Why rejected:** Manually entering 131+ prices defeats the core value proposition. The PRD explicitly requires "100% dos ativos com preço atualizado sem #N/A" via APIs. Manual entry is retained only as a fallback for individual assets where APIs fail (via `price_source = 'manual'` field in the assets table).

### Alternative D: brapi.dev for everything (including international)

**Approach:** Use brapi.dev as the sole provider — they support some international tickers via an undocumented Yahoo Finance proxy.

| Pros | Cons |
|------|------|
| Single provider, single API key, single adapter (~100 LOC) | brapi.dev international coverage is undocumented and unreliable |
| Already covers B3 stocks + FIIs with batch support | All 131+ tickers on one rate limit (15,000 req/month) |
| Known entity with documented free tier | Forex support is limited to BRL pairs |
| | Single point of failure for entire portfolio pricing |
| | brapi.dev may throttle or remove international support without notice |

**Why rejected:** Concentrating all 131+ tickers on brapi.dev's 15,000 req/month limit leaves no margin. With 6 requests/refresh × 12 refreshes/hour × 7 hours/day × 22 trading days = ~11,088 requests/month for B3 alone (74% utilization). Adding 20 international tickers as individual requests would push to ~15,400 — exceeding the limit. Additionally, brapi.dev's international ticker support is undocumented and could be removed at any time.

---

## Trade-offs

| Dimension | Multi-provider (chosen) | Alpha Vantage only | HG Brasil + Yahoo | brapi for all | Manual only |
|-----------|------------------------|--------------------|--------------------|---------------|-------------|
| Monthly cost | R$ 0 (all free tiers) | R$ 0 (free) or ~R$ 260/mo (premium) | R$ 0 | R$ 0 | R$ 0 |
| B3 requests/month available | 15,000 (brapi batch) | 750 (25/day × 30) | 15,000 (HG, no batch) | 15,000 (shared limit) | 0 |
| International coverage | Yes (Yahoo, ~20 ETFs) | Yes (Alpha Vantage) | Yes (need Yahoo too) | Undocumented, unreliable | Manual input |
| Batch support | Yes (brapi: 20/request) | No (1/request) | No (1/request) | Yes for B3, no for intl | N/A |
| API reliability | High (brapi) / Low (Yahoo, no SLA) | High (stable endpoints) | High (HG) / Low (Yahoo) | Medium (undocumented intl) | 100% (human) |
| Integration complexity | 3 adapters (~300 LOC total) | 1 adapter (~100 LOC) | 2 adapters (~200 LOC) | 1 adapter (~100 LOC) | 0 LOC |
| Failure blast radius | Per-provider (isolated) | Total (single point of failure) | Per-provider | Total (single point) | None |
| Requests per full refresh | ~27 (6 brapi + 20 Yahoo + 1 forex) | ~132 (1 per ticker) | ~132 (111 HG + 20 Yahoo + 1) | ~27 (if intl works) | 0 |

---

## Consequences

### Positive

- **Best-of-breed per market** — brapi.dev specializes in B3 with batch support; Yahoo covers global markets; exchangerate-api handles forex with simplicity
- **Isolated failure domains** — if Yahoo goes down, B3 prices and forex still work; overweight FIIs (65% of portfolio) are unaffected by international API failures
- **Request budget fits comfortably** — 6 brapi batch requests per refresh × ~2,000 refreshes/month (5-min intervals during 7h pregão × 22 days) = ~12,000 of 15,000 limit (80% utilization with 20% margin)
- **Fallback strategy is built-in** — `price_source` per asset allows graceful degradation to manual entry for individual tickers where APIs fail

### Negative

- **3 adapters to maintain** — each API has different request/response formats, error codes, and auth methods (~300 LOC total across 3 adapters)
- **Yahoo Finance is inherently unstable** — no SLA, endpoints may change without notice, IP throttling possible (mitigated: circuit breaker stops retries after 3 failures; manual fallback per asset)
- **exchangerate-api.com rate limit is tight** — 1,500 req/month means ~50 req/day; cache TTL must be ≥15 minutes to stay within budget (see ADR-005)
- **No single source of truth for all prices** — debugging price discrepancies requires checking which API served which ticker via the `price_fetch_log` table
- **Provider dependency risk** — relying on 3 free-tier services means 3 potential points of terms-of-service change (mitigated: each can be replaced independently without affecting the others)

### Obligations

1. **Adapter abstraction** — Each API provider MUST be behind a common `PriceProvider` interface: `fetchPrices(tickers: string[]): Promise<PriceResult[]>`. This enables swapping providers without changing calling code
2. **Yahoo Finance validation** — ALL ~20 international ETF tickers MUST be tested against Yahoo Finance API before end of Sprint 1. Results documented in a validation report. Any failing ticker gets `price_source = 'manual'` as default
3. **Error logging** — All API calls MUST log to `price_fetch_log` table: `{ provider, tickers, status, response_time_ms, error_message, created_at }`. This enables the PRD success metric (< 1% error rate/day)
4. **API keys in environment** — All API keys stored as Supabase Edge Function secrets via `supabase secrets set`, NEVER in client-side code, `.env` files committed to git, or Astro page frontmatter (see ADR-007)
5. **Circuit breaker implementation** — Yahoo Finance adapter MUST implement circuit breaker: 3 consecutive failures per ticker → 1 hour cooldown → surface alert in dashboard UI
6. **Rate limit monitoring** — Monthly review of API usage vs. limits for all 3 providers. Log current utilization in a monthly ops check or automated script
