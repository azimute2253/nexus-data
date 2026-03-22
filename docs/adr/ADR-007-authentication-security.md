# ADR-007: Authentication and Security

## Metadata

| Campo | Valor |
|-------|-------|
| Status | Accepted |
| Date | 2026-03-22 |
| Deciders | Luis (product owner), Aria (@architect) |
| Related ADRs | [ADR-001](ADR-001-integration-strategy.md) (shared auth with azimute-blog members area), [ADR-002](ADR-002-database.md) (RLS policies on all Supabase tables), [ADR-003](ADR-003-quote-price-api-strategy.md) (API keys stored as Edge Function secrets), [ADR-005](ADR-005-price-caching-strategy.md) (Edge Function cron uses service role key to bypass RLS for writes), [ADR-006](ADR-006-frontend-architecture.md) (Astro middleware protects dashboard routes), [ADR-008](ADR-008-data-migration-strategy.md) (migration script authenticates to insert data with correct user_id) |

---

## Context

Nexus Data manages sensitive personal financial data: portfolio positions (~R$ 243K across 131+ assets in 10 classes), scoring strategies, and contribution history. While it's a single-user application, the data is accessible via the internet at azimute.cc and must be protected against unauthorized access.

The azimute-blog already has Supabase Auth configured for its members area. The `/dashboard/*` routes are protected by Astro middleware that checks for a valid Supabase session.

**Current scale:** ~R$ 243K portfolio, 131+ assets, single user (Luis). Data includes asset quantities, financial targets, and scoring strategies — all personally sensitive.

**Security requirements from PRD:**
- Login via email/password using Supabase Auth (F-008 AC1)
- RLS active on ALL tables with `auth.uid()` policy (F-008 AC2)
- Persistent session — don't require login on every visit (F-008 AC3)
- Without login, no data accessible — all routes protected (F-008 AC4)
- API keys stored server-side (Edge Functions), never exposed to client (F-007 AC7)
- Single user — no multi-tenancy, roles, or permissions

**Constraints:**
- Budget: R$ 0/month — no paid auth services
- Supabase free tier: 50,000 auth users, 4 emails/hour built-in SMTP
- Must share auth with azimute-blog members area (ADR-001)

**When to revisit this decision:**
- If password compromise occurs or is suspected (add MFA immediately via Supabase Auth settings)
- If Supabase Auth pricing changes or free tier is reduced
- If a second user needs access (consider role-based access or separate RLS policies)
- If regulatory requirements demand MFA for financial data (e.g., LGPD enforcement changes)
- If azimute-blog switches auth providers (must maintain compatibility)

---

## Decision

**Use Supabase Auth with email/password login, RLS on all tables, and server-side API key management.** The authentication is shared with azimute-blog's existing members area.

### Authentication Layer

- **Provider:** Supabase Auth (email/password)
- **Session:** JWT stored in `httpOnly` cookie via Supabase SSR helper (`@supabase/ssr`)
- **Middleware:** Astro middleware at `src/middleware.ts` validates session for all `/dashboard/*` routes (already exists for azimute-blog)
- **Session persistence:** Supabase refresh tokens auto-renew sessions; user stays logged in across browser sessions for weeks

### Authorization Layer (RLS)

Every Nexus Data table has RLS enabled with the following policy pattern:

```sql
-- Example for assets table
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own assets"
ON assets FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

This applies to all 8 tables: `asset_types`, `asset_groups`, `assets`, `price_cache`, `questionnaires`, `asset_scores`, `contributions`, `exchange_rates`.

### API Key Security

| Key | Storage | Access |
|-----|---------|--------|
| `BRAPI_API_KEY` | Supabase Edge Function secret | Edge Function only — never in client code |
| `YAHOO_FINANCE_KEY` (if needed) | Supabase Edge Function secret | Edge Function only |
| `EXCHANGE_RATE_API_KEY` | Supabase Edge Function secret | Edge Function only |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Function secret | Edge Function only (bypasses RLS for cron writes) |
| `SUPABASE_ANON_KEY` | Client-side env var (`PUBLIC_`) | Client + Server (safe — RLS enforces access control) |

---

## Alternatives Considered

### Alternative A: Magic Link (passwordless email)

**Approach:** Use Supabase Auth magic link instead of email/password. User receives an email with a login link — no password needed.

| Pros | Cons |
|------|------|
| No password to remember or manage | Requires email access to log in — problematic during pregão if email app isn't open on mobile |
| More secure in theory (no password database to breach) | 5-15 second delay waiting for email to arrive (SMTP delivery time) |
| Modern UX pattern (used by Slack, Notion) | Supabase free tier: 4 emails/hour via built-in SMTP — may hit limit if session expires frequently |
| Phishing-resistant (no credentials to phish) | If email provider has deliverability issues (spam filter, delay), user is locked out |
| | azimute-blog already uses email/password — switching creates UX inconsistency |

**Why rejected:** The primary use case is "open app on mobile during pregão → rebalance → close." Magic link adds friction: open email app, find link, click, return to browser. On mobile, this flow breaks context and takes 15-30 seconds. The 4 emails/hour Supabase limit could be hit if sessions expire frequently. Email/password with persistent sessions (weeks-long refresh tokens) is faster and more reliable for a single user.

### Alternative B: OAuth Providers (Google, GitHub)

**Approach:** Use Supabase Auth with Google OAuth or GitHub OAuth for login.

| Pros | Cons |
|------|------|
| One-click login (fast UX) | Dependency on third-party OAuth provider uptime (Google/GitHub outage = no access) |
| No password management needed | Google OAuth requires setting up OAuth consent screen, redirect URIs, and verification |
| Familiar UX for most users | If Google/GitHub account is compromised, portfolio data is exposed |
| MFA delegated to provider | Overkill for single-user — Luis already knows his email/password |
| | azimute-blog may not have OAuth configured — requires additional Supabase Auth provider setup |
| | OAuth popup flow is clunky on mobile browsers (popup blocked, redirect chain) |

**Why rejected:** OAuth is designed for multi-user applications where onboarding friction matters. For a single-user tool, email/password with a persistent session is simpler and has zero external dependency. OAuth also introduces availability risk: if Google has an outage, the user can't access their own portfolio data. Email/password works even if Google is down.

### Alternative C: No Auth — Security by Obscurity

**Approach:** No login at all. Protect the app by using a long, random URL path (e.g., `/dashboard/portfolio/a1b2c3d4e5`). Anyone with the URL can access the data.

| Pros | Cons |
|------|------|
| Zero friction — no login ever needed | URL can be leaked via browser history, screenshots, shared devices |
| Simplest possible implementation (no auth code) | No RLS enforcement — anyone with URL accesses all data |
| No session management complexity | No audit trail of who accessed the data or when |
| | Search engine crawlers could discover and index the URL |
| | Vercel preview deploy URLs are predictable — could expose data during development |
| | Directly violates PRD F-008 AC4: "Sem login, nenhum dado é acessível" |
| | Financial data (~R$ 243K portfolio) exposed with zero protection |

**Why rejected:** Directly violates PRD requirement F-008 AC4: "Sem login, nenhum dado é acessível (todas as rotas protegidas)." Financial data exposure through URL guessing, browser history, or shared devices is an unacceptable risk, even for a single user. RLS is meaningless without auth because there's no `auth.uid()` to match against.

---

## Trade-offs

| Dimension | Email/password + RLS (chosen) | Magic Link | OAuth (Google) | No Auth |
|-----------|------------------------------|-----------|---------------|---------|
| Login friction | Low (persistent session — login rarely needed, weeks between) | Medium (wait 5-15s for email, switch apps) | Low (1-click popup) | None |
| Session duration | Weeks (Supabase refresh token auto-renewal) | Hours (magic link tokens expire quickly) | Hours-days (provider-dependent settings) | Infinite (no session) |
| External dependency | None (Supabase self-contained) | Email SMTP delivery (Supabase built-in, 4/hour limit) | Google/GitHub uptime + API availability | None |
| RLS compatibility | Full (`auth.uid()` available in every query) | Full (`auth.uid()` available) | Full (`auth.uid()` available) | None (no user context for RLS) |
| Setup complexity | 0 hours (already configured in azimute-blog) | 1-2 hours (configure email templates, test flow) | 2-4 hours (OAuth consent screen, redirect URIs, testing) | 0 hours |
| Mobile UX | Enter credentials once, stay logged in for weeks | Open email app on every session expiry | OAuth popup / redirect on mobile (often blocked) | No action needed |
| Security level | Good (password + RLS + server-side API keys) | Better (no password to breach) | Good (MFA delegated to provider) | None (zero protection) |
| Recovery | Password reset via email (standard flow) | Request new magic link (same email flow) | Account recovery via OAuth provider | N/A (no auth to recover) |

---

## Consequences

### Positive

- **Zero implementation effort** — azimute-blog's auth middleware already protects `/dashboard/*` routes; Nexus Data pages at `/dashboard/portfolio/*` are automatically protected
- **RLS as defense-in-depth** — even if Astro middleware has a bug, database queries only return rows matching `auth.uid()`. Two independent layers of access control
- **Persistent sessions** — Supabase refresh tokens mean Luis logs in once and stays authenticated for weeks without re-entering credentials
- **API keys never leave the server** — Edge Functions run in Deno runtime with secrets; client-side JavaScript has no access to price API keys (brapi, Yahoo, exchangerate)
- **Consistent UX** — same login flow for azimute-blog members area and Nexus Data portfolio; no context switch

### Negative

- **Single factor only** — email/password without MFA is vulnerable to password compromise (mitigated: strong password ≥16 chars + single user reduces attack surface significantly; MFA can be added later via Supabase Auth settings without code changes)
- **Password management burden** — Luis must remember or store the password securely (mitigated: password managers exist; persistent session means password is rarely needed in practice)
- **RLS adds query overhead** — every query includes implicit `WHERE user_id = auth.uid()` filter. For 131 assets, overhead is negligible (~1-2ms per query on indexed `user_id` column)
- **Service role key risk** — Edge Functions use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS for cron price writes. If this key leaks, all data in all tables is accessible without auth (mitigated: key stored exclusively as Supabase secret, never in code, never in `.env` committed to git)

### Obligations

1. **RLS before data** — RLS policies MUST be created and tested BEFORE any data is inserted into any table. Sequence: create table → enable RLS → create policy → verify with test query → insert data
2. **RLS verification test** — MUST test that unauthenticated requests return zero rows for every table. Test: call Supabase with anon key and no session → verify empty result set for each of the 8 tables
3. **API key audit** — Before MVP launch, verify that NO API keys appear in: client-side JavaScript bundles (build output), git history (`git log -p`), environment variables prefixed with `PUBLIC_`, or Astro page frontmatter
4. **Password strength** — Luis's account MUST use a password with ≥16 characters. Configure Supabase Auth password policy to enforce this minimum
5. **Session monitoring** — Review Supabase Auth logs monthly for unexpected login attempts, failed authentications, or session anomalies from unknown IP addresses
6. **Edge Function secrets** — All API keys MUST be set via `supabase secrets set KEY=value`, NOT via `.env` files committed to git. The `.env` file MUST be listed in `.gitignore`
