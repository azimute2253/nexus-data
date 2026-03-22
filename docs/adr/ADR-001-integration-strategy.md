# ADR-001: Integration Strategy — Embedded in azimute-blog vs Standalone App

## Metadata

| Campo | Valor |
|-------|-------|
| Status | Accepted |
| Date | 2026-03-22 |
| Deciders | Luis (product owner), Aria (@architect) |
| Related ADRs | [ADR-002](ADR-002-database.md) (Supabase instance sharing), [ADR-003](ADR-003-quote-price-api-strategy.md) (Edge Functions hosted within shared infrastructure), [ADR-006](ADR-006-frontend-architecture.md) (frontend stack inherits from azimute-blog), [ADR-007](ADR-007-authentication-security.md) (auth sharing with azimute-blog), [ADR-008](ADR-008-data-migration-strategy.md) (migration targets embedded project structure) |

---

## Context

The PRD specifies that Nexus Data must be "uma aba dentro da área de membros do site azimute.cc" — accessible at `/dashboard/portfolio`. The azimute-blog project already exists as an Astro 6 + React site deployed on Vercel at azimute.cc, with Supabase Auth for member access.

The decision of **how** to integrate Nexus Data with the existing site has cascading consequences for:
- **Development velocity** — can we reuse existing auth, layout, and deploy pipeline?
- **Operational cost** — R$ 0/month budget means no additional hosting
- **Maintenance burden** — one codebase vs two to maintain
- **Technical coupling** — shared deploy means shared failure domains

**Current scale:** ~R$ 243K portfolio across 131+ assets in 10 asset classes. Single user (Luis). Monthly contributions of ~R$ 12,000.

**Constraints from PRD:**
- Budget: R$ 0/month (all free tiers — Vercel, Supabase, brapi.dev, exchangerate-api.com)
- Single user (Luis) — no multi-tenancy, no SaaS
- Must share auth with azimute-blog members area
- Must deploy to azimute.cc domain
- Stack: Astro 6 + React (same as azimute-blog)
- Vercel free tier: 100 GB bandwidth, 6,000 min build/month (shared with azimute-blog)

**When to revisit this decision:**
- If azimute-blog build time exceeds 4 minutes (50%+ of current budget consumed per deploy)
- If a second developer joins and needs independent deployment cycles
- If portfolio features need a different Astro output mode than the blog
- If Nexus Data grows beyond ~20 routes (extraction cost becomes worth it)

---

## Decision

**Embed Nexus Data directly into the azimute-blog repository** as new pages under `src/pages/dashboard/portfolio/` and related routes, sharing the existing Astro 6 project, Supabase Auth, Tailwind config, layout components, and Vercel deployment.

Specifically:
- New Astro pages added under `src/pages/dashboard/` for all portfolio routes
- React island components created under `src/components/nexus/`
- Shared library code in `src/lib/nexus/` (rebalance algorithm, API clients, types)
- Supabase client and auth middleware reused from existing azimute-blog setup
- Single `vercel.json` and single deploy pipeline

---

## Alternatives Considered

### Alternative A: Standalone App (separate repository, separate domain)

**Approach:** Create a new Astro 6 project in `~/Projects/nexus-data/` with its own Vercel deployment at a subdomain (e.g., `portfolio.azimute.cc` or `nexus.azimute.cc`).

| Pros | Cons |
|------|------|
| Clean separation of concerns — blog bugs can't break portfolio | Requires separate Vercel project (splits free tier: 100 GB bandwidth shared) |
| Independent deploy cycle — blog changes don't affect portfolio | Duplicate auth setup (two Supabase client configs, two session managers) |
| No risk of breaking azimute-blog during portfolio development | Cross-origin issues for shared cookies/sessions (different subdomain) |
| Easier to open-source or spin off later | Two Tailwind configs to maintain in sync |
| | User sees domain switch (breaks "aba" mental model from PRD) |
| | Additional DNS config and SSL cert management |

**Why rejected:** Violates the PRD requirement that Nexus Data is "aba dentro da área de membros." Creates operational overhead (two deploys, two domains) with zero benefit for a single-user tool. Vercel free tier limits would be split across two projects, halving effective bandwidth and build minutes.

### Alternative B: Micro-frontend (Module Federation or iframe)

**Approach:** Build Nexus Data as a separate app but load it inside azimute-blog via Webpack Module Federation, Astro's remote islands, or an iframe.

| Pros | Cons |
|------|------|
| Independent deployment of portfolio features | Module Federation adds significant build complexity (~500+ LOC webpack config) |
| Technology freedom per micro-frontend | Iframe breaks shared auth (different origin = separate cookies) |
| Strong runtime isolation | Astro 6 remote islands are experimental and poorly documented as of March 2026 |
| | Performance penalty: additional HTTP request for remote module, duplicate React runtime (~40 KB) |
| | Debugging across module boundaries requires source map stitching |
| | Massively over-engineered for 1 user and ~10 pages |

**Why rejected:** Micro-frontends solve a team coordination problem that doesn't exist here (single developer, single user). Adds 10x build complexity for zero user benefit. Astro remote islands aren't production-ready. The iframe approach breaks auth entirely.

### Alternative C: Monorepo with shared packages (Turborepo/pnpm workspaces)

**Approach:** Convert to a monorepo with `packages/shared/` (types, rebalance lib) and `apps/blog/` + `apps/portfolio/`.

| Pros | Cons |
|------|------|
| Clean code boundaries via package.json scoping | Monorepo tooling overhead (Turborepo config, workspace dependencies, hoisting issues) |
| Shared code via explicit packages with versioning | Still need to solve deploy coordination (two Vercel projects or one with monorepo adapter) |
| Scalable if more apps are added | Adds ~2 days setup time for a single-user project |
| Well-established pattern in the industry | Shared Tailwind/layout requires explicit package extraction and cross-package CSS config |

**Why rejected:** Architecturally sound for larger teams but overkill for a single-user tool with one developer. The 2-day setup cost buys scalability that will never be needed (PRD explicitly scopes out multi-tenancy and SaaS). Deploy coordination adds ongoing overhead with no user benefit.

---

## Trade-offs

| Dimension | Embedded (chosen) | Standalone | Micro-frontend | Monorepo |
|-----------|-------------------|------------|----------------|----------|
| Setup time | 0 days (add pages to existing project) | 1 day (new Vercel project, DNS, auth) | 3-5 days (MF config, testing) | 2 days (Turborepo, workspaces) |
| Auth sharing | Native (same Astro middleware) | Complex (cross-domain cookies) | Broken (iframe) / Complex (MF) | Requires shared auth package |
| Deploy cost | R$ 0 (same Vercel project) | R$ 0 but split free tier limits | R$ 0 but split free tier limits | R$ 0 but complex config |
| Build time impact | +10-15s per build (more pages/islands) | 0 (separate build) | +20-30s (MF plugin overhead) | +5-10s (Turborepo cache) |
| Failure coupling | High (shared deploy — blog bug can break portfolio) | None (independent deploys) | Low (runtime isolation) | Low (separate apps) |
| Code isolation | Medium (folder-based convention) | High (repo-based, git-level) | High (runtime sandboxed) | High (package-based, npm scoping) |
| Maintenance LOC (infra) | ~0 extra infrastructure code | ~200 LOC (deploy config, auth setup) | ~500+ LOC (webpack/MF config) | ~300 LOC (Turborepo config, workspace scripts) |
| Future extraction cost | 2-3 days if ever needed | Already separate | Already separate | 1 day (apps already split) |

---

## Consequences

### Positive

- **Zero infrastructure overhead** — no new Vercel project, domain, DNS config, or SSL certificate
- **Auth just works** — Supabase Auth middleware already protects `/dashboard/*` routes; Nexus Data pages are automatically protected
- **Shared design system** — Tailwind config, layout components, and theme are already there; portfolio pages look native
- **Fastest time to MVP** — start writing features immediately, no setup ceremony or tooling configuration
- **Single deploy** — one `git push`, one build, one URL; no deploy coordination between projects

### Negative

- **Coupled deploy risk** — a bug in portfolio code could break the blog (mitigated: Vercel preview deploys and feature branches catch issues before production)
- **Build time growth** — adding ~10 Astro pages + React islands will add 10-15s to build time; current total will be ~45-60s, well within 6,000 min/month free tier
- **Code organization discipline required** — without repo boundaries, portfolio code must stay cleanly separated in its own folders; requires developer discipline
- **Cannot independently scale** — if portfolio needs different Astro output mode than blog, both must agree (mitigated: azimute-blog already uses `hybrid` output, which supports both static and SSR pages)
- **Shared dependency versions** — both blog and portfolio must use the same React, Astro, and Tailwind versions; upgrades affect both (mitigated: single developer makes coordination trivial)

### Obligations

1. **Folder convention** — All Nexus Data code MUST live under clearly separated paths: `src/pages/dashboard/portfolio/`, `src/components/nexus/`, `src/lib/nexus/`. No portfolio code in blog-specific directories
2. **No cross-contamination** — Portfolio components MUST NOT import blog-specific components (and vice versa); shared code lives in `src/components/shared/` or `src/lib/shared/`
3. **Preview deploy testing** — Every PR touching portfolio routes MUST be tested via Vercel preview deploy before merge to main
4. **Feature flags** — If portfolio is not ready for production, routes MUST be gated behind an environment variable (`PUBLIC_NEXUS_ENABLED=true`) to prevent user access to incomplete features
5. **Build time monitoring** — Track build time after adding portfolio pages. If total build exceeds 3 minutes, investigate code splitting or lazy page generation
