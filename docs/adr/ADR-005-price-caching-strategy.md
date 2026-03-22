# ADR-005: Price Caching Strategy

## Metadata

| Campo | Valor |
|-------|-------|
| Status | Accepted |
| Date | 2026-03-22 |
| Deciders | Luis (product owner), Aria (@architect) |
| Related ADRs | [ADR-002](ADR-002-database.md) (price_cache table stored in Supabase Postgres), [ADR-003](ADR-003-quote-price-api-strategy.md) (APIs feeding cache with price data), [ADR-004](ADR-004-rebalancing-algorithm-architecture.md) (algorithm consumes cached prices as input), [ADR-006](ADR-006-frontend-architecture.md) (dashboard displays price staleness indicators), [ADR-007](ADR-007-authentication-security.md) (Edge Function secrets and service role key for cron write access) |

---

## Context

Nexus Data fetches prices from 3 APIs with strict free-tier limits:
- **brapi.dev:** 15,000 req/month (~6 batch requests per refresh × ~111 B3 tickers)
- **exchangerate-api.com:** 1,500 req/month (~1 request per refresh)
- **Yahoo Finance:** Unofficial, no documented limit (but aggressive polling risks IP ban)

The app needs fresh prices during Brazilian market hours (pregão B3: 10:00-17:00 BRT, weekdays) and can tolerate stale data outside those hours. A caching strategy is critical to:
1. Stay within free-tier rate limits
2. Provide consistent prices to the rebalancing algorithm (ADR-004)
3. Show the user the freshest available data with transparency about staleness
4. Survive API outages without breaking the application

**Current scale:** ~R$ 243K portfolio, 131+ assets across 3 API providers, 10 asset classes. Single user.

**Constraints from PRD:**
- Budget: R$ 0/month (free tiers only)
- brapi budget: 15,000 req/month → ~682 req/day → ~97 req/hour during 7h pregão
- exchangerate-api budget: 1,500 req/month → ~68 req/day → ~10 req/hour during 7h pregão
- Edge Function invocations: 500,000/month (Supabase free tier)
- Dashboard must load in < 3s FCP on 4G (prices served from cache, not live APIs)
- Price refresh must complete in < 10s for full batch (~27 API requests)
- PRD F-007 AC4: "Cache com TTL de 5 minutos durante pregão e 1 hora fora do pregão"

**When to revisit this decision:**
- If API rate limits change (brapi tightens from 15,000 or exchangerate-api reduces from 1,500)
- If price staleness of 5 minutes becomes unacceptable (e.g., high-volatility scenario during rebalancing)
- If the portfolio grows beyond 200 tickers (refresh cycle would exceed 10-second budget)
- If Supabase introduces a built-in caching layer that outperforms the table-based approach
- If a need arises for sub-minute price freshness (would require WebSocket streaming, fundamentally different architecture)

---

## Decision

**Cache all prices in a Supabase `price_cache` table with time-based TTL**, using a Supabase Edge Function cron job that refreshes prices at different intervals based on market hours.

### Cache Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Price APIs  │────▶│  Edge Function   │────▶│ price_cache  │
│ (brapi/Yahoo │     │  (cron: 5min     │     │   table      │
│  /exchange)  │     │   during pregão) │     │ (Supabase)   │
└─────────────┘     └──────────────────┘     └──────┬───────┘
                                                     │
                                              ┌──────▼───────┐
                                              │  Client app  │
                                              │ (reads cache │
                                              │  via query)  │
                                              └──────────────┘
```

### TTL Rules

| Condition | TTL | Rationale |
|-----------|-----|-----------|
| During pregão B3 (10:00-17:00 BRT, Mon-Fri) | 5 minutes | Prices change frequently; brapi budget allows ~97 req/hour |
| Outside pregão B3 | 1 hour | Prices don't change (market closed); conserve API budget |
| Exchange rates (always) | 15 minutes | exchangerate-api budget: 1,500/month ÷ 30 days = 50/day max |
| Weekend / holiday | No refresh | B3 is closed; last Friday's prices are current |

### Table Schema

```sql
price_cache (
  ticker      TEXT PRIMARY KEY,
  price       NUMERIC(15,4) NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'BRL',
  source      TEXT NOT NULL, -- 'brapi' | 'yahoo' | 'exchangerate' | 'manual'
  fetched_at  TIMESTAMPTZ NOT NULL,
  ttl_seconds INTEGER NOT NULL,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  -- RLS: auth.uid() = user_id
)
```

### Request Budget Analysis

| Period | brapi requests | Yahoo requests | Exchange requests | Total Edge Function invocations |
|--------|---------------|---------------|-------------------|-------------------------------|
| Per refresh cycle | 6 (batches of 20) | 20 (1/ticker) | 1 | 1 (single function, sequential calls) |
| Per pregão day (7h, every 5min) | 504 | 1,680 | 28 | 84 invocations |
| Per month (22 trading days) | 11,088 | 36,960 | 616 | 1,848 invocations |
| % of free tier | 74% of 15,000 | N/A (no documented limit) | 41% of 1,500 | 0.4% of 500,000 |

---

## Alternatives Considered

### Alternative A: In-memory cache (server-side Map/LRU)

**Approach:** Cache prices in an in-memory Map or LRU cache within the Edge Function or Vercel serverless function. No database table for cache.

| Pros | Cons |
|------|------|
| Fastest possible reads (~0ms lookup, no network hop) | Serverless functions are stateless — memory is lost between invocations |
| No database writes for cache updates | On Vercel, each function instance has its own memory — no sharing between cold starts |
| Simpler schema (no price_cache table) | Cache miss rate would be ~100% on cold starts (every 5-15 minutes without traffic) |
| | No persistence — if APIs are down, there's no "last known price" to fall back to |
| | Dashboard would need to trigger fresh API calls on every page load |

**Why rejected:** Serverless functions are ephemeral. In-memory cache is discarded on every cold start (which happens frequently on free tier with low traffic). This means every dashboard load could trigger 27+ API calls, quickly burning through rate limits. Crucially, there's no fallback — if APIs are down at the moment of a cold start, there's literally no price data available. The PRD requires showing last known price with timestamp when APIs fail.

### Alternative B: CDN/Edge cache (Vercel Edge Config or KV)

**Approach:** Use Vercel KV (Redis-based) or Edge Config to cache prices at the CDN level. Prices are stored as key-value pairs with TTL.

| Pros | Cons |
|------|------|
| Very fast reads (~1-5ms from edge location) | Vercel KV free tier: 30,000 requests/month (tight for 131 prices × multiple page loads) |
| Built-in TTL support (native Redis TTL) | Vercel Edge Config: 20 KB limit (insufficient for 131 ticker prices + metadata) |
| No database table needed | Adds another service (Vercel KV) to the stack — another dashboard, another account |
| Global distribution (irrelevant for single-user in Sinop, MT) | Cannot query by attributes (e.g., "all prices older than X") — key-value only |
| | No SQL aggregation — `portfolio_summary` view cannot JOIN with KV store |
| | KV reads count against free tier per READ operation, not per batch |

**Why rejected:** Vercel KV's 30,000 req/month limit is problematic — a single dashboard load that reads prices for 131 tickers = 131 KV reads (or 1 if cleverly batched into a single key, but then no per-ticker TTL). More critically, the `portfolio_summary` Postgres view needs to JOIN `price_cache` with `assets` and `asset_types` — impossible if prices are in a separate KV store. Putting prices in Postgres enables powerful SQL joins and aggregations for the dashboard.

### Alternative C: Redis (Upstash serverless Redis)

**Approach:** Use Upstash Redis free tier for caching. Prices stored as Redis hashes with TTL.

| Pros | Cons |
|------|------|
| Native TTL per key (Redis EXPIRE) | Adds external service (Upstash) — another account, another dashboard, another set of rate limits |
| Very fast reads (~5-10ms) | Free tier: 10,000 commands/day (reads + writes combined) |
| Redis HGETALL for batch reads in one command | 131 price reads = 131 commands (or 1 HGETALL but no per-key TTL) |
| | Cannot join with Postgres tables — `portfolio_summary` view broken (same issue as KV) |
| | Price data must be fetched from Redis, then passed to client alongside Postgres data — two data sources per page load |
| | Adds latency: Supabase query + Redis query per page load instead of single Supabase query |

**Why rejected:** Same fundamental problem as Vercel KV — prices in Redis cannot participate in Postgres JOINs. The `portfolio_summary` view (critical for dashboard) aggregates `assets.quantity × price_cache.price` across types. This is a single SQL query when prices are in Postgres; it becomes two network hops + client-side join when prices are in Redis. Additionally, Upstash free tier (10K commands/day) adds another rate limit to manage.

### Alternative D: No cache — fetch on demand

**Approach:** Every time the dashboard loads or rebalance button is clicked, fetch fresh prices directly from APIs.

| Pros | Cons |
|------|------|
| Always fresh prices (no staleness) | 27 API requests per page load (6 brapi + 20 Yahoo + 1 exchange) |
| No cache invalidation logic needed | Dashboard load time: 3-10 seconds just for price fetching (violates < 3s FCP) |
| Simpler architecture (no cron, no cache table) | brapi budget exhausted in ~556 page loads/month (~25/day) |
| | exchangerate-api budget exhausted in 1,500 page loads/month (~68/day) |
| | Every page load becomes dependent on all 3 APIs being up simultaneously |
| | No fallback if any API is down at load time |

**Why rejected:** Without caching, each page load triggers 27+ API calls with ~3-10s cumulative latency. The brapi free tier would support only ~25 page loads per day before exhaustion — completely unusable during a trading day when the user may check the dashboard multiple times. Also violates the < 3s FCP target.

---

## Trade-offs

| Dimension | DB cache (chosen) | In-memory | CDN/KV | Redis (Upstash) | No cache |
|-----------|-------------------|-----------|--------|-----------------|----------|
| Read latency | 10-50ms (Supabase Postgres) | <1ms (RAM) | 1-5ms (edge) | 5-10ms | 3-10s (live API calls) |
| Persistence across cold starts | Yes (database row) | No (lost on restart) | Yes (KV stored) | Yes (Redis persisted) | N/A |
| SQL JOIN with portfolio data | Native (`portfolio_summary` view) | Impossible | Impossible | Impossible | N/A |
| Monthly cost | R$ 0 (included in Supabase) | R$ 0 | R$ 0 (KV free tier) | R$ 0 (Upstash free tier) | R$ 0 |
| Additional services | 0 (uses existing Supabase) | 0 | 1 (Vercel KV) | 1 (Upstash) | 0 |
| TTL granularity | Per-row (custom logic in cron) | Per-key (native Map) | Per-key (native Redis TTL) | Per-key (native Redis TTL) | N/A |
| Fallback on API failure | Last cached price + `fetched_at` timestamp | No data (cache empty) | Last cached + timestamp | Last cached + timestamp | No data |
| Storage used | ~50 KB (131 rows × ~400 bytes) | ~50 KB RAM (ephemeral) | ~50 KB | ~50 KB | 0 |

---

## Consequences

### Positive

- **Single data source** — `portfolio_summary` view joins `assets`, `price_cache`, and `exchange_rates` in one SQL query; no cross-system data stitching
- **Resilient to API failures** — last known price is always available in the database, even after server restarts or prolonged API outages
- **Transparent staleness** — `fetched_at` column lets the UI show "Updated 3 minutes ago" or "Stale: last updated 2 hours ago" with visual indicators
- **Budget-safe** — cron interval ensures API calls stay within free tier limits (74% brapi utilization, 41% exchangerate utilization, 0.4% Edge Function utilization)
- **Zero additional infrastructure** — `price_cache` is just another Supabase table, managed with the same tools (Studio, migrations, RLS)

### Negative

- **10-50ms read latency** — Supabase Postgres is slower than in-memory or edge cache for reads (acceptable: dashboard loads ~131 prices in a single query, not 131 individual queries; total read time ~20-40ms)
- **Cache invalidation is manual** — TTL logic is implemented in the Edge Function cron, not enforced by the database itself. A bug in the cron could serve stale prices indefinitely (mitigated: `fetched_at` timestamp always shows actual freshness to the user)
- **Database writes every 5 minutes** — during pregão, the cron UPSERTs ~131 rows every 5 minutes = ~26 writes/minute. Supabase free tier handles this easily, but it's not zero I/O
- **No sub-second freshness** — minimum latency from market price change to dashboard display is 5 minutes (acceptable: this is a monthly rebalancing tool, not a day-trading terminal)
- **Cron complexity** — the Edge Function must handle market hours detection, holiday awareness, and per-provider error handling; this is ~150-200 LOC of scheduling logic

### Obligations

1. **Cron schedule** — Edge Function cron MUST run every 5 minutes during pregão (10:00-17:00 BRT, Mon-Fri) and every 1 hour outside pregão. No runs on weekends or B3 holidays
2. **UPSERT strategy** — Price updates MUST use `ON CONFLICT (ticker) DO UPDATE` to avoid duplicates and maintain single-row-per-ticker invariant
3. **Staleness UI** — Dashboard MUST show `fetched_at` timestamp for prices. If any price is older than 24 hours, MUST show a warning indicator (badge or banner)
4. **Manual refresh** — "Atualizar preços" button MUST trigger an immediate Edge Function invocation outside the cron schedule, but still respecting rate limits (debounce: max 1 manual refresh per minute)
5. **Holiday awareness** — Cron SHOULD detect B3 holidays (Brazilian market holidays) and skip refresh. Minimum viable: hardcoded list of 2026 holidays; ideal: check via config table in Supabase

---

## Addendum: Story 3.6 — Auto-refresh on Portfolio Entry (2026-03-22)

**Context:** Users request the dashboard to show current prices without manual refresh, but full cron automation (every 5 minutes) burns API budget unnecessarily when no one is looking at the dashboard.

**Decision:** Implement **on-demand refresh triggered by portfolio page entry** with a configurable cooldown period (default 4 hours). This balances freshness with rate limit conservation.

### Mechanism

1. **Trigger:** When user navigates to `/dashboard/portfolio`
2. **Check:** Query `price_refresh_log` table for last refresh timestamp
3. **Condition:** If `(now - last_refresh) > COOLDOWN_HOURS` → trigger `/api/prices/refresh`
4. **Log:** Insert new timestamp into `price_refresh_log`
5. **Serve:** Return cached prices (now fresh)

### Schema Addition

```sql
CREATE TABLE price_refresh_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) -- optional: global or per-user
);
```

### Configuration

- Environment variable: `PRICE_REFRESH_COOLDOWN_HOURS` (default: 4)
- Cooldown period applies globally (all users share last refresh timestamp)

### Trade-offs

| Pro | Con |
|-----|-----|
| Prices refresh only when needed (user viewing dashboard) | First user in 4+ hours waits ~10s for refresh |
| Conserves API budget (no refresh when dashboard idle) | Multiple users entering < 1 min apart = duplicate refreshes (mitigated: lock mechanism) |
| Simpler than cron (no market hours logic) | Doesn't account for market hours (may refresh at 2am) |
| Configurable cooldown adapts to usage patterns | Requires client-side loading state during refresh |

**Status:** Accepted  
**Implementation:** Story 3.6 (Wave 6 Track F)  
**Related:** ADR-003 (Price APIs), ADR-005 (original caching strategy)
