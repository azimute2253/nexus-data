# ADR-009: Auth Client Architecture — Vanilla Client in nexus-data vs SSR Client in azimute-blog

## Metadata

| Campo | Valor |
|-------|-------|
| Status | Accepted |
| Date | 2026-03-22 |
| Deciders | Luis (product owner), Dex (@dev) |
| Related ADRs | [ADR-001](ADR-001-integration-strategy.md) (embedded integration — nexus-data pages live inside azimute-blog), [ADR-007](ADR-007-authentication-security.md) (auth and security — `@supabase/ssr` for session management in azimute-blog) |

---

## Context

During QA review of Story 1.3 (Auth Integration), concern B2 was raised: nexus-data uses vanilla `createClient` from `@supabase/supabase-js` instead of `createServerClient` from `@supabase/ssr`. Story 1.3 AC4 specifies `@supabase/ssr`, which exists in the azimute-blog codebase — not in nexus-data.

This concern requires an explicit architectural decision because the two repositories serve different purposes and have different Supabase client requirements:

- **azimute-blog** is an Astro 6 SSR web application that handles HTTP requests, cookies, and user sessions. It needs `@supabase/ssr` to manage session tokens via `httpOnly` cookies in Astro middleware.
- **nexus-data** is a data-access library containing the rebalancing algorithm, CSV parsers, price engine, and Supabase client utilities. It does not handle HTTP requests, cookies, or user sessions directly.

**Trigger:** QA concern B2 in Story 1.3 — "`@supabase/ssr` not used in nexus-data."

---

## Decision

**nexus-data uses the vanilla `createClient` from `@supabase/supabase-js`. SSR session management (`@supabase/ssr`) lives exclusively in azimute-blog.**

The auth architecture is split across two repositories:

| Concern | Repository | Client | Package |
|---------|-----------|--------|---------|
| Session management (cookies, refresh tokens, middleware) | azimute-blog | `createServerClient` | `@supabase/ssr` |
| Data access (queries, RLS-scoped reads/writes) | nexus-data | `createClient` | `@supabase/supabase-js` |

### How it works at runtime

1. User visits `/dashboard/portfolio` in azimute-blog
2. Astro middleware (`src/middleware.ts`) uses `@supabase/ssr` to validate the session cookie and refresh the JWT if needed
3. The authenticated page imports nexus-data utilities (rebalance algorithm, price engine, etc.)
4. nexus-data functions receive a Supabase client or access token from the calling context — they never create or manage sessions themselves

### nexus-data client roles

| Export | Purpose | Requires session? |
|--------|---------|--------------------|
| `getServiceClient()` | Server-side data operations (Edge Functions, scripts, migrations) | No — uses service role key, bypasses RLS |
| `getAnonClient()` | Client-side queries scoped by RLS | No — uses anon key, RLS enforces access |
| `getSession()` | Retrieve current session from a configured client | Yes — caller must provide authenticated client |
| `getCurrentUser()` | Retrieve current user from a configured client | Yes — caller must provide authenticated client |

---

## Alternatives Considered

### Alternative A: Use `@supabase/ssr` in nexus-data

**Approach:** Install `@supabase/ssr` in nexus-data and use `createServerClient` for all Supabase clients.

| Pros | Cons |
|------|------|
| Matches AC4 literally (uses `@supabase/ssr`) | nexus-data has no HTTP context — no `Request`/`Response` objects, no cookies to read or set |
| Single client library across both repos | `createServerClient` requires cookie `getAll`/`setAll` callbacks that are meaningless outside a web server |
| | Would need to mock or stub cookie handlers, adding dead code |
| | Creates a false dependency — nexus-data would import SSR tooling it cannot use |

**Why rejected:** `@supabase/ssr` is designed for web servers that handle HTTP requests with cookies. nexus-data is a library — it has no `Request` object, no cookies, and no middleware. Using `createServerClient` with stubbed cookie handlers would be dead code that misleads future developers into thinking nexus-data manages sessions.

### Alternative B: No Supabase client in nexus-data

**Approach:** Remove the Supabase client from nexus-data entirely. All database access happens through azimute-blog.

| Pros | Cons |
|------|------|
| Single source of truth for all Supabase clients | nexus-data can't be tested independently (requires azimute-blog running) |
| No client architecture split to document | Edge Functions and scripts that use nexus-data algorithms would need azimute-blog as a dependency |
| | Tight coupling — nexus-data becomes untestable without a web server |

**Why rejected:** nexus-data needs its own Supabase client for unit testing, Edge Function integrations, and standalone script usage (e.g., data migration via ADR-008). Removing it would make the library untestable in isolation.

---

## Trade-offs

| Dimension | Split architecture (chosen) | SSR client in both | No client in nexus-data |
|-----------|-----------------------------|--------------------|-----------------------|
| Correctness | Each repo uses the right tool for its context | Dead code (stubbed cookie handlers) | Correct but limiting |
| Testability | nexus-data testable in isolation with vanilla client | Same, but with unnecessary SSR mocking | Untestable without azimute-blog |
| Complexity | Two client setups to understand | One library but with confusing stubs | One setup but tightly coupled |
| Session management | Clear: azimute-blog owns sessions | Ambiguous: both repos import SSR tooling | Clear: azimute-blog owns sessions |
| Dependency footprint | `@supabase/supabase-js` only in nexus-data | `@supabase/ssr` + `@supabase/supabase-js` in both | No Supabase deps in nexus-data |

---

## Consequences

### Positive

- **Correct tool for the job** — vanilla `createClient` is the right choice for a data library; `@supabase/ssr` is the right choice for a web server
- **Clean separation of concerns** — session lifecycle (cookies, refresh tokens, middleware) is azimute-blog's responsibility; data access (queries, RLS) is nexus-data's responsibility
- **Independent testability** — nexus-data unit tests run without HTTP context, cookies, or a web server
- **No dead code** — no stubbed cookie handlers or unused SSR imports

### Negative

- **Split understanding required** — developers must know that auth sessions are managed in azimute-blog, not nexus-data (mitigated: this ADR documents the split explicitly)
- **nexus-data cannot manage sessions** — it cannot log users in, refresh tokens, or set cookies (mitigated: this is by design; session management is delegated to azimute-blog per ADR-001)

### Obligations

1. **Session delegation** — nexus-data MUST NOT attempt to create, refresh, or manage user sessions. Session lifecycle is exclusively azimute-blog's responsibility
2. **AC4 clarification** — Story 1.3 AC4 ("uses `@supabase/ssr`") is satisfied by the azimute-blog implementation, not nexus-data. The acceptance criterion applies to the integrated system, not to each repository individually
3. **Documentation** — Any future contributor to nexus-data must be directed to this ADR to understand why vanilla `createClient` is used instead of `@supabase/ssr`
