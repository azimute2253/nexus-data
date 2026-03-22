# ADR-006: Frontend Architecture — Astro Islands with React

## Metadata

| Campo | Valor |
|-------|-------|
| Status | Accepted |
| Date | 2026-03-22 |
| Deciders | Luis (product owner), Aria (@architect) |
| Related ADRs | [ADR-001](ADR-001-integration-strategy.md) (embedded in azimute-blog, inherits Astro + React stack), [ADR-002](ADR-002-database.md) (Supabase client for data fetching in Astro pages), [ADR-003](ADR-003-quote-price-api-strategy.md) (price data displayed in dashboard components), [ADR-004](ADR-004-rebalancing-algorithm-architecture.md) (client-side algorithm execution in React islands), [ADR-005](ADR-005-price-caching-strategy.md) (price staleness display and refresh button in dashboard), [ADR-007](ADR-007-authentication-security.md) (auth middleware in Astro protects dashboard routes) |

---

## Context

Nexus Data is embedded in azimute-blog (ADR-001), which already uses Astro 6 with React islands. The frontend must serve two distinct interaction patterns:

1. **Static content** — Portfolio dashboard overview, asset type listings, navigation, layout → benefits from SSR (fast FCP, less JS shipped)
2. **Interactive content** — Rebalancing calculator, scoring modal, CRUD forms, charts, what-if slider → requires React with client-side state

**Current scale:** ~R$ 243K portfolio, 131+ assets, 10 asset classes. Dashboard must render ~10 types with current/target percentages, deviation indicators, and a pizza chart. Single user.

**Constraints from PRD:**
- FCP < 3s on Slow 4G (PRD Success Metrics)
- Mobile-first, card-based layout on screens < 768px
- Navigation by tabs: Overview | Detalhes | Rebalancear
- Hierarchical navigation: L1 (types) → L2 (groups) → L3 (assets)
- Phase 2 charts with Recharts (React-native library)
- MUST use Astro 6 + React (same stack as azimute-blog — ADR-001)
- MUST use Tailwind CSS (already configured in azimute-blog)
- Recharts is the chosen charting library (React-native, composable, lightweight)

**When to revisit this decision:**
- If Astro 6 drops React island support or changes the hydration API significantly
- If island isolation becomes a major pain point (need for complex cross-island state sharing)
- If bundle size exceeds 200 KB gzipped across all islands (performance regression)
- If React Server Components become available in Astro (could replace islands pattern)
- If the number of interactive components grows beyond ~15 islands per page (hydration budget exceeded)

---

## Decision

**Use Astro 6 in `hybrid` output mode with React islands** for interactive components. Astro pages handle routing, layout, auth middleware, and data fetching (server-side). React components handle interactivity and are hydrated on the client with `client:load` or `client:visible` directives.

### Architecture

```
Astro Pages (server-rendered)
├── src/pages/dashboard/portfolio/index.astro    → Dashboard (L1)
├── src/pages/dashboard/assets/[type].astro      → Type view (L2)
├── src/pages/dashboard/assets/[type]/[group].astro → Group view (L3)
├── src/pages/dashboard/questionnaires/index.astro
└── src/pages/dashboard/questionnaires/[id].astro

React Islands (client-hydrated)
├── src/components/nexus/Dashboard.tsx            → Overview charts + stats
├── src/components/nexus/RebalanceCalculator.tsx  → Aporte input + cascade result
├── src/components/nexus/AssetTable.tsx           → Sortable, filterable asset list
├── src/components/nexus/ScoringModal.tsx         → Questionnaire scoring UI
├── src/components/nexus/AssetForm.tsx            → CRUD form for assets
├── src/components/nexus/AllocationChart.tsx      → Pizza chart (Recharts)
└── src/components/nexus/PriceRefreshButton.tsx   → Manual price refresh

Shared Library (isomorphic)
└── src/lib/nexus/
    ├── rebalance.ts     → L1→L2→L3 cascade algorithm (see ADR-004)
    ├── types.ts         → TypeScript interfaces
    ├── supabase.ts      → Supabase client wrapper
    └── format.ts        → BRL formatting, number display
```

### Hydration Strategy

| Component | Directive | Rationale |
|-----------|-----------|-----------|
| `RebalanceCalculator` | `client:load` | Core interaction — must be ready immediately on page load |
| `Dashboard` (charts) | `client:load` | Above the fold, user expects immediate interactivity |
| `ScoringModal` | `client:load` | Triggered by button click, must be ready without delay |
| `AssetTable` | `client:load` | Needs sorting/filtering immediately on asset pages |
| `AssetForm` | `client:load` | CRUD form needs interactivity for validation and submit |
| `AllocationChart` | `client:visible` | Below fold on mobile — defer hydration until scrolled into view |
| `PriceRefreshButton` | `client:idle` | Low priority — can hydrate after main content is interactive |

### State Management

- **No global state library** — React `useState` + `useReducer` within each island
- **Data fetching** — Astro pages fetch from Supabase on the server and pass as props to React islands
- **Mutations** — React components call Supabase client directly (client-side) for CRUD operations, then invalidate/refetch
- **Cross-island communication** — minimal; if needed, use custom DOM events or shared URL state (query params)

---

## Alternatives Considered

### Alternative A: Full React SPA (Create React App / Vite React)

**Approach:** Replace Astro with a pure React SPA. All pages are client-rendered. React Router handles navigation.

| Pros | Cons |
|------|------|
| Unified mental model — everything is React | Breaks azimute-blog integration — blog is Astro, can't embed a React SPA as "aba" (violates ADR-001) |
| No island boundaries — shared state is trivial | Ships entire app JS upfront — larger initial bundle (~150-300 KB min for React + Router + Recharts) |
| Rich ecosystem of React patterns and libraries | No SSR — FCP depends entirely on JS download + parse + execute |
| Familiar to most React developers | On Slow 4G: ~300 KB JS at ~500 Kbps = 4.8s download alone → violates < 3s FCP target |
| | Requires separate build pipeline from azimute-blog |
| | Auth middleware must be reimplemented client-side (Astro middleware is server-only) |

**Why rejected:** Violates ADR-001 — Nexus Data must be embedded in the azimute-blog Astro project, not a separate React SPA. Additionally, a full SPA ships all JavaScript upfront, which on Slow 4G would exceed the 3-second FCP target before the browser even starts rendering. Astro's partial hydration ships only the JS needed for interactive islands.

### Alternative B: Next.js (App Router)

**Approach:** Use Next.js 15 with App Router for server components + client components. Deploy as a separate Vercel project or monorepo app.

| Pros | Cons |
|------|------|
| Server Components reduce client JS significantly | Cannot embed within Astro project — different framework, different build pipeline |
| Built-in API routes for server-side logic | Requires separate Vercel project (splits free tier bandwidth/build minutes) |
| Excellent React integration with streaming SSR | Next.js framework overhead is larger than Astro (~80-100 KB) |
| File-based routing (similar to Astro pages) | Would duplicate auth setup — azimute-blog's Supabase middleware is Astro-specific |
| | Two frameworks to maintain (Astro for blog, Next for portfolio) |

**Why rejected:** Using Next.js requires a separate project, violating ADR-001 (embedded integration). It splits the Vercel free tier between two projects and requires maintaining two different frameworks. The single developer already knows Astro — adding Next.js doubles the framework knowledge requirement for zero user benefit.

### Alternative C: SvelteKit

**Approach:** Use SvelteKit instead of React for the interactive components.

| Pros | Cons |
|------|------|
| Smaller runtime (~5 KB vs ~40 KB for React) | azimute-blog uses React — adding Svelte means two UI framework runtimes shipped to the browser |
| Excellent performance characteristics | Recharts is React-only — need alternative charting library (Chart.js, D3, or Svelte-specific) |
| Built-in state management (stores) | Astro supports Svelte islands, but mixing React + Svelte islands adds build complexity |
| Less boilerplate code per component | Single developer already knows React; Svelte adds learning curve |
| | Svelte ecosystem is smaller — fewer component libraries available |

**Why rejected:** While Svelte's runtime is smaller (~5 KB vs ~40 KB), the azimute-blog already has React configured. Adding a second UI framework means shipping both React and Svelte runtimes to the browser, negating the size advantage. Recharts (the chosen charting library from PRD) is React-only. The practical benefit of saving ~35 KB runtime is outweighed by the cost of maintaining two frameworks and finding Svelte-compatible replacements for every React library.

### Alternative D: Pure Astro (no framework — Astro components only)

**Approach:** Use only Astro components with vanilla JavaScript for interactivity. No React, no framework runtime.

| Pros | Cons |
|------|------|
| Zero framework runtime — absolute minimum JS shipped | Complex forms (CRUD, scoring modal) in vanilla JS are verbose (~3-5x more code) |
| Fastest possible FCP (no framework parse time) | No component state management — must use DOM manipulation or Web Components |
| Simplest build (no framework compilation) | Recharts unavailable — must use vanilla Chart.js or D3 (~3x integration effort) |
| | Rebalancing calculator UI with hierarchical expand/collapse is painful without React |
| | What-if slider (Phase 2) with real-time update in vanilla JS: ~500 LOC vs ~100 LOC React |
| | No ecosystem for complex UI patterns (modals, sortable tables, form validation) |

**Why rejected:** The Nexus Data UI has significant interactivity: CRUD forms, scoring modals, hierarchical expand/collapse, charts, and a Phase 2 what-if slider. Building these in vanilla JavaScript would require 3-5x more code than React equivalents, with worse maintainability. The zero-framework approach works for content sites but not for application-level interactivity.

---

## Trade-offs

| Dimension | Astro + React islands (chosen) | React SPA | Next.js | SvelteKit | Pure Astro |
|-----------|-------------------------------|-----------|---------|-----------|------------|
| Framework JS size | ~40 KB (React runtime, only for islands) | ~150-300 KB (full app bundle) | ~80-100 KB (framework + React) | ~5 KB (Svelte runtime) | 0 KB |
| FCP on Slow 4G | ~1.5-2.5s (SSR + partial hydration) | ~4-6s (full client render) | ~2-3s (Server Components + streaming) | ~1.5-2.5s | ~1-1.5s |
| Integration with azimute-blog | Native (same project, same build) | Impossible (different framework) | Separate project required | Possible but mixed runtimes | Native |
| Interactivity code effort | ~3,000 LOC (React components) | ~3,000 LOC (React) | ~3,000 LOC (React) | ~2,500 LOC (Svelte) | ~10,000+ LOC (vanilla JS) |
| Recharts compatibility | Native (React islands) | Native | Native | Incompatible (different framework) | Incompatible |
| State management complexity | Low (local state per island) | Medium (global state needed across routes) | Medium (Server/Client component split) | Low (Svelte stores) | High (manual DOM manipulation) |
| Build time | ~30-45s (Astro + React compilation) | ~20-30s (Vite React) | ~30-60s (Next.js build) | ~25-40s | ~15-25s |

---

## Consequences

### Positive

- **Progressive enhancement** — Astro pages render server-side HTML first, then hydrate interactive islands. Dashboard layout is visible before JavaScript loads
- **Minimal JS shipped** — only interactive components ship React runtime (~40 KB). Static content (layout, nav, breadcrumbs) is zero-JS HTML
- **Reuses azimute-blog patterns** — same Astro routing, same Tailwind config, same component conventions; no new patterns to learn
- **Recharts integration is native** — React islands naturally support React component libraries for charting
- **Mobile-first by design** — Tailwind responsive classes + card-based layout for < 768px already established in the project

### Negative

- **Island isolation** — React islands can't easily share state. The rebalancing calculator and dashboard chart are separate islands; updating one doesn't automatically update the other (mitigated: both receive data from the same Astro page props; mutations trigger full page refetch via `window.location.reload()` or Astro navigation)
- **Hydration cost** — each `client:load` island adds to Total Blocking Time. With 4-5 islands on the dashboard, expect ~200-400ms TBT on mobile (within acceptable budget but not zero)
- **No client-side routing** — navigation between L1→L2→L3 pages is full page load (Astro MPA architecture). Each drill-down triggers server render (mitigated: Astro `<ViewTransitions />` makes transitions feel SPA-like with prefetching)
- **Two mental models** — developer must understand both Astro's server-first model (pages, middleware, frontmatter) and React's client-side model (hooks, state, effects)

### Obligations

1. **Component naming convention** — All Nexus Data React components MUST live in `src/components/nexus/` and use PascalCase naming. Astro pages MUST live in `src/pages/dashboard/`
2. **Hydration budget** — No more than 5 `client:load` islands per page. Additional components MUST use `client:visible` or `client:idle` to reduce initial TBT
3. **Mobile-first CSS** — All components MUST be styled mobile-first: base styles for mobile, `md:` breakpoint for tablet, `lg:` for desktop. Use Tailwind responsive utilities exclusively — no raw `@media` queries in CSS
4. **Bundle analysis** — Before MVP launch, run `npx astro build --analyze` and verify no single island exceeds 100 KB gzipped. Total JS per page should not exceed 150 KB gzipped
5. **View Transitions** — MUST add `<ViewTransitions />` to the dashboard layout to enable smooth page transitions and reduce perceived navigation latency between L1→L2→L3
6. **Accessibility baseline** — All interactive components MUST support keyboard navigation and include ARIA labels. Recharts components MUST include `<desc>` tags for screen readers
