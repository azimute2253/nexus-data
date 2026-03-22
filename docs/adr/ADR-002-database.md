# ADR-002: Database — Supabase (Postgres + RLS)

## Metadata

| Campo | Valor |
|-------|-------|
| Status | Accepted |
| Date | 2026-03-22 |
| Deciders | Luis (product owner), Aria (@architect) |
| Related ADRs | [ADR-001](ADR-001-integration-strategy.md) (shares Supabase instance with azimute-blog), [ADR-003](ADR-003-quote-price-api-strategy.md) (Edge Functions call APIs and write to price_cache), [ADR-005](ADR-005-price-caching-strategy.md) (cache stored in price_cache table), [ADR-007](ADR-007-authentication-security.md) (RLS policies + auth.uid()), [ADR-008](ADR-008-data-migration-strategy.md) (migration target database) |

---

## Context

Nexus Data requires persistent storage for:
- **Portfolio structure:** 10 asset types, ~15 groups, 131+ individual assets with metadata (tickers, sectors, quantities, flags)
- **Scoring system:** 3 questionnaire types (FIIs, Ações, ETFs) with per-asset score answers
- **Price cache:** Cached quotes from 3 APIs (brapi.dev, Yahoo Finance, exchangerate-api.com) with TTL-based invalidation
- **Exchange rates:** USD/BRL, BTC/BRL cached rates for international asset valuation
- **Future (Phase 3):** Contribution history, portfolio snapshots for evolution tracking

The data is relational by nature — asset types contain groups, groups contain assets, questionnaires link to asset types, scores link to assets. Total data volume is small (~500 rows across all tables at MVP, growing by ~12 rows/month from contributions in Phase 3).

**Current scale:** ~R$ 243K portfolio, 131+ assets, 10 asset classes, ~15 groups. Single user (Luis).

**Constraints from PRD:**
- Budget: R$ 0/month — no paid database services
- Single user — no multi-tenancy
- azimute-blog already uses Supabase for Auth (existing instance available)
- RLS required on all tables (PRD: "RLS ativo em todas as tabelas com policy `auth.uid()`")
- Edge Functions needed for price cron jobs (server-side API key protection)
- 8 tables + 1 view defined in PRD
- Supabase free tier: 500 MB database, 1 GB file storage, 50,000 auth users, 500,000 Edge Function invocations/month

**When to revisit this decision:**
- If Supabase changes or eliminates their free tier pricing
- If database storage exceeds 400 MB (80% of 500 MB free tier limit)
- If Edge Function invocations exceed 400,000/month (80% of free tier)
- If a need arises for features Supabase doesn't support (e.g., full-text search, graph queries)
- If Supabase experiences repeated outages affecting portfolio access during pregão hours

---

## Decision

**Use Supabase (Postgres) as the sole database**, sharing the existing Supabase project instance already used by azimute-blog. All 8 tables and the `portfolio_summary` view will be created in the same Postgres database. Row Level Security (RLS) will be enabled on all tables with `auth.uid()` policies. Edge Functions will handle API key-protected operations (price fetching).

Schema: `asset_types`, `asset_groups`, `assets`, `price_cache`, `questionnaires`, `asset_scores`, `contributions`, `exchange_rates` + `portfolio_summary` materialized view.

---

## Alternatives Considered

### Alternative A: SQLite (local/embedded via Turso or libSQL)

**Approach:** Use SQLite via Turso (edge-hosted SQLite) or an embedded SQLite file served from Vercel's serverless functions.

| Pros | Cons |
|------|------|
| Zero network latency for reads (co-located with compute) | No built-in auth — must implement session management from scratch (~200-300 LOC) |
| Simple backup strategy (single file copy) | No RLS — authorization logic moves to application layer (~200 LOC middleware) |
| Works offline with local data | No Edge Functions equivalent — need separate cron infrastructure (GitHub Actions or similar) |
| No network hop for queries (<1ms reads) | Turso free tier: 500 databases, 9 GB storage — generous but adds another service to manage |
| SQL-compatible (familiar query language) | No real-time subscriptions (would need to poll for price updates) |
| | Splits infrastructure: Supabase for auth + SQLite for data = two backend systems |

**Why rejected:** azimute-blog already has a Supabase project with Auth configured. Using SQLite would mean maintaining two backend systems — Supabase for auth only and SQLite for data. The RLS requirement from the PRD would need to be reimplemented in application code (~200 LOC). Edge Functions for price cron would need a separate solution (GitHub Actions). Net result: more complexity, more code, more moving parts — for identical functionality.

### Alternative B: PlanetScale (MySQL-compatible serverless)

**Approach:** Use PlanetScale's serverless MySQL with their branching workflow.

| Pros | Cons |
|------|------|
| Serverless scaling with zero cold starts | MySQL, not Postgres — different SQL dialect, different ORM config |
| Schema branching (like git for database schema) | No built-in auth — same problem as SQLite |
| Global replication for low latency | Free tier was eliminated in April 2024 — minimum $39/month (~R$ 200+) |
| | No RLS equivalent — authorization must be in application code |
| | No Edge Functions — separate cron infrastructure needed |
| | Adds monthly cost (directly violates R$ 0 budget constraint) |

**Why rejected:** PlanetScale eliminated their free tier in April 2024, immediately violating the R$ 0/month budget constraint. Even if cost weren't an issue, it doesn't provide auth or Edge Functions, requiring additional services to replicate what Supabase includes out of the box.

### Alternative C: Firebase (Firestore + Firebase Auth)

**Approach:** Use Google's Firebase with Firestore (NoSQL) and Firebase Auth.

| Pros | Cons |
|------|------|
| Generous free tier (50K reads/day, 20K writes/day) | NoSQL — portfolio data is deeply relational (types→groups→assets→scores) |
| Built-in auth with multiple providers (Google, email) | Querying hierarchical portfolio data requires denormalization or multiple reads |
| Real-time subscriptions (built-in) | No SQL — `portfolio_summary` view equivalent requires Cloud Functions + client-side aggregation |
| Security rules (declarative, similar to RLS) | Vendor lock-in to Google ecosystem (proprietary APIs) |
| | Astro + Firebase has less community support than Astro + Supabase |
| | Cloud Functions limited to 125K invocations/month on free tier |
| | Migration script would need Firestore-specific write logic instead of SQL INSERTs |

**Why rejected:** The portfolio data model is inherently relational — asset types contain groups, groups contain assets, assets have scores from questionnaires. Firestore's document model would require either deep nesting (hitting 20-subcollection limits) or denormalization (duplicating data across documents). The `portfolio_summary` view, which aggregates across multiple tables with JOINs, would become multiple reads + client-side aggregation — slower and more complex. Wrong tool for a relational domain.

### Alternative D: Self-hosted Postgres (Railway, Render, or Fly.io)

**Approach:** Run a standard Postgres instance on Railway or Render free tier.

| Pros | Cons |
|------|------|
| Full Postgres power without Supabase abstraction layer | No built-in auth — implement from scratch or add another service |
| No Supabase SDK dependency (pure pg client) | No Edge Functions — need separate serverless infrastructure for price cron |
| More control over extensions and configuration | Railway free tier: removed in August 2023 (now $5/month minimum) |
| | Render free tier: Postgres databases spin down after 90 days of inactivity |
| | No dashboard/GUI for data management (or add pgAdmin = more infra) |
| | Splits auth from data — two systems to maintain |

**Why rejected:** Free tier availability is unreliable (Railway removed theirs in 2023, Render sunsets databases after 90 days). Even when available, self-hosted Postgres provides a fraction of what Supabase includes (auth, RLS policies via dashboard, Edge Functions, REST API, real-time). Net result: more work for less functionality, with risk of losing free hosting.

---

## Trade-offs

| Dimension | Supabase (chosen) | SQLite/Turso | PlanetScale | Firebase | Self-hosted PG |
|-----------|-------------------|-------------|-------------|----------|----------------|
| Monthly cost | R$ 0 (existing instance) | R$ 0 (Turso free) | ~R$ 200+/mo | R$ 0 (Spark plan) | R$ 0-130/mo |
| Auth integration | Native (already configured) | None (build from scratch) | None (build from scratch) | Native (Firebase Auth) | None (build from scratch) |
| RLS support | Native Postgres RLS | Application-level (~200 LOC) | Application-level (~200 LOC) | Security Rules (declarative) | Native PG RLS |
| Edge Functions | Included (500K/month free) | Not available | Not available | Cloud Functions (125K/month free) | Not available |
| SQL support | Full Postgres 15 | Full SQLite | Full MySQL 8 | NoSQL only (Firestore) | Full Postgres |
| Setup time | 0 hours (add tables to existing instance) | 4-8 hours | 4-8 hours | 8-16 hours | 4-8 hours |
| Data model fit | Excellent (relational, JOINs, views) | Good (relational, but no RLS) | Good (relational, but no free tier) | Poor (document model for relational data) | Excellent (relational) |
| Storage limit (free) | 500 MB | 9 GB (Turso) | N/A (no free tier) | 1 GB (Firestore) | Varies (unreliable) |
| Vendor lock-in | Medium (Supabase SDK, but data is standard PG SQL) | Low (standard SQLite) | Medium (MySQL-specific) | High (Firestore proprietary API) | Low (standard Postgres) |

---

## Consequences

### Positive

- **Zero additional services** — reuses the Supabase project that azimute-blog already has; no new accounts, dashboards, or billing
- **Auth + DB in one platform** — `auth.uid()` available natively in RLS policies; no auth↔DB integration code needed
- **Edge Functions for price cron** — no need for external cron service (GitHub Actions, AWS Lambda); stays within Supabase ecosystem
- **REST and real-time APIs auto-generated** — PostgREST gives instant API for all tables; real-time subscriptions available if needed
- **Dashboard for data management** — Supabase Studio provides SQL editor, table viewer, and RLS policy editor for debugging and manual operations
- **Migration path is SQL** — standard `INSERT INTO` statements for data migration from Google Sheets (see ADR-008)
- **500 MB storage** — more than sufficient for estimated total data (<5 MB at peak including price cache history)

### Negative

- **Vendor coupling to Supabase** — if Supabase changes pricing or shuts down, migration to raw Postgres or another provider is needed (mitigated: all data is standard Postgres SQL with no Supabase-specific data types or proprietary extensions)
- **Shared instance risk** — a misconfigured RLS policy or schema migration could affect azimute-blog tables (mitigated: use `nexus_`-prefixed table names or separate Postgres schema to avoid collision)
- **Free tier limits are hard ceilings** — 500K Edge Function invocations/month, 500 MB database; ample for single-user but no headroom for abuse or unexpected growth
- **Cold start on Edge Functions** — first invocation after idle may take 1-3 seconds (mitigated: price cron runs every 5 minutes during pregão, keeping functions warm)
- **No automatic point-in-time recovery** — Supabase free tier lacks automated backups; data loss requires manual backup restoration

### Obligations

1. **Schema isolation** — All Nexus Data tables MUST use a clear naming convention (e.g., `asset_types`, `asset_groups`) or a separate Postgres schema (`nexus.`) to avoid collision with azimute-blog tables
2. **RLS on every table** — Every table MUST have RLS enabled with `auth.uid()` policy before any data is inserted (see ADR-007 for policy details)
3. **Migration scripts versioned** — All schema changes MUST be captured as SQL migration files in `supabase/migrations/` and committed to git for reproducibility
4. **Backup strategy** — Weekly `pg_dump` of Nexus Data tables via a scheduled script or manual export. Supabase free tier has no automatic point-in-time recovery; manual backups are the only safety net
5. **Monitor free tier usage** — Track Edge Function invocations and database size monthly to stay within free tier limits. Set up a monthly reminder to check Supabase dashboard metrics
