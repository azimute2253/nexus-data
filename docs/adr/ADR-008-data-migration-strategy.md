# ADR-008: Data Migration Strategy

## Metadata

| Campo | Valor |
|-------|-------|
| Status | Accepted |
| Date | 2026-03-22 |
| Deciders | Luis (product owner), Aria (@architect) |
| Related ADRs | [ADR-001](ADR-001-integration-strategy.md) (migration targets embedded project structure — files in azimute-blog repo), [ADR-002](ADR-002-database.md) (migration target database — Supabase Postgres), [ADR-003](ADR-003-quote-price-api-strategy.md) (price sources for migrated assets — brapi/Yahoo/exchangerate), [ADR-004](ADR-004-rebalancing-algorithm-architecture.md) (parity validation post-migration — rebalance output must match spreadsheet), [ADR-007](ADR-007-authentication-security.md) (migration script authenticates to insert data with correct user_id for RLS) |

---

## Context

The existing portfolio data lives in a Google Sheets spreadsheet (`1HG6pQdx-P85vd8EVg7bDzI2X-yW4bAF1HQVbXIaes0g`) with 6 tabs:

| Tab | Content | Rows | Target Tables |
|-----|---------|------|--------------|
| Distribuição de aporte | 10 asset types with target % | 10 | `asset_types` |
| FII | 20 FIIs with sector, quantity, group | 20 | `asset_groups` + `assets` |
| Ações | 91 stocks across 4 groups with quantity, sector | 91 | `asset_groups` + `assets` |
| RI, RV e RF | Fixed income + variable income assets, 3 groups | ~10 | `asset_groups` + `assets` |
| Exterior | ~20 international ETFs across 5 groups | ~20 | `asset_groups` + `assets` |
| Balanceamentos | Scoring questionnaires and per-asset scores | 131+ | `questionnaires` + `asset_scores` |

Total: 6 tabs → 8 relational tables. 10 types, ~15 groups, 131+ assets, 3 questionnaire types, and all scoring responses.

A migration script already exists: `scripts/fetch-sheet.mjs`, which exports CSV from the public Google Sheets link and parses with PapaParse.

**Current scale:** ~R$ 243K portfolio, 131+ assets, 10 asset classes, ~15 groups. Single user.

**Constraints from PRD:**
- Data is in Brazilian format: R$ 1.234,56 (comma decimal separator, dot thousands separator)
- Migration is a one-time operation (spreadsheet becomes deprecated after successful validation)
- Must validate: rebalancing result post-migration matches spreadsheet output (tolerance < R$ 1/asset) — PRD Success Metric G1/O1
- Must handle: ticker format differences (e.g., VALE3 vs VALE3.SA), currency symbols (R$), empty cells, "#N/A" values from GOOGLEFINANCE
- All inserted data must have correct `user_id` for RLS enforcement (ADR-007)

**When to revisit this decision:**
- If the Google Sheets spreadsheet format changes significantly before migration is executed
- If the number of assets grows beyond 200 before migration (may need pagination or chunking)
- If PapaParse fails to handle a specific Brazilian format edge case that requires a different parser
- If migration needs to be repeated (e.g., data correction) — the script is designed to be idempotent via UPSERT

---

## Decision

**Export Google Sheets data via CSV (public link), parse with PapaParse in Node.js, transform to relational schema, and insert into Supabase via the JavaScript SDK.** The migration is executed as a local Node.js script (`scripts/migrate-to-supabase.mjs`) run once by the developer.

### Migration Pipeline

```
Google Sheets (6 tabs)
       │
       ▼ CSV export (public URL per tab)
       │
  ┌────▼────┐
  │ PapaParse│  Parse CSV → JSON arrays
  │ (Node.js)│  Handle: BR format, R$ symbol, comma decimals
  └────┬────┘
       │
  ┌────▼─────────────┐
  │ Transform Layer   │  Map flat CSV rows → relational structure
  │                   │  Resolve: type → type_id, group → group_id
  │                   │  Clean: remove #N/A, trim whitespace, normalize tickers
  └────┬─────────────┘
       │
  ┌────▼──────────────┐
  │ Supabase Insert    │  Insert in dependency order:
  │ (SDK + upsert)     │  1. asset_types (10 rows)
  │                    │  2. questionnaires (3 rows)
  │                    │  3. asset_groups (~15 rows, FK → asset_types)
  │                    │  4. assets (131+ rows, FK → asset_groups)
  │                    │  5. asset_scores (131+ × questions rows, FK → assets + questionnaires)
  └────┬──────────────┘
       │
  ┌────▼──────────────┐
  │ Validation         │  Run rebalance(migrated_data, R$ 12000)
  │                    │  Compare vs spreadsheet reference output
  │                    │  Tolerance: < R$ 1 per asset
  └───────────────────┘
```

### Data Cleaning Rules

| Issue | Rule |
|-------|------|
| Brazilian number format (1.234,56) | Replace `.` → ``, replace `,` → `.`, parse as float |
| R$ currency symbol | Strip `R$` and whitespace before parsing |
| `#N/A` or `#REF!` from GOOGLEFINANCE | Set price to `null`, mark `price_source = 'manual'` |
| Empty cells | Default to `0` for quantities, `null` for optional fields |
| Ticker normalization | Uppercase, trim whitespace, remove `.SA` suffix if present |
| Scores | Parse as integer, allow negatives (e.g., -10 for XPLG11) |

---

## Alternatives Considered

### Alternative A: Google Sheets API (direct programmatic access)

**Approach:** Use the Google Sheets API v4 to read data programmatically from the spreadsheet. Authenticate with a service account or API key.

| Pros | Cons |
|------|------|
| Direct access to cell values including calculated values | Requires Google Cloud project setup (API key or service account credentials) |
| Can read specific ranges without parsing entire CSV | Authentication complexity: OAuth2 or service account JSON key management |
| Supports reading calculated values (not just raw cell content) | Google API quota: 300 requests/min/project — ample but setup overhead |
| Structured response (arrays of arrays, typed values) | Dependent on Google Cloud Console — another account to create and manage |
| | API returns `#N/A` as error objects, not strings — different parsing logic needed |
| | ~4-8 hours setup time vs ~1 hour for CSV approach |

**Why rejected:** The CSV export via public link is simpler and already implemented in `scripts/fetch-sheet.mjs`. The Google Sheets API requires setting up a Google Cloud project, managing service account credentials, and handling OAuth2 — all for a one-time migration that will run once. The existing script works; the extra effort provides no additional value for a single-use operation.

### Alternative B: Manual data entry

**Approach:** Manually re-enter all portfolio data through the Nexus Data UI.

| Pros | Cons |
|------|------|
| Zero script development — uses the built CRUD UI directly | 131+ assets × 5 fields = ~655 manual data entries |
| Data validation happens at entry time via form validation | ~15 groups with target %, plus 3 questionnaire types to configure |
| Forces thorough testing of the CRUD interface | Estimated time: 4-8 hours of tedious, error-prone data entry |
| No CSV parsing issues — human handles format interpretation | High error rate — manual entry for 655+ fields guarantees typos and mistakes |
| | Cannot run automated parity validation (no systematic comparison possible) |
| | Must score each of 131+ assets individually via questionnaire modal |

**Why rejected:** 131+ assets with ~5 fields each = ~655 data points, plus ~15 groups, 10 types, and 131+ scoring response sets. Manual entry would take 4-8 hours and inevitably introduce transcription errors. Automated migration with systematic validation is the only way to guarantee parity with the spreadsheet (PRD Success Metric G1).

### Alternative C: Hybrid — CSV export + manual scoring

**Approach:** Migrate structural data (types, groups, assets) via CSV, but re-score all assets manually through the questionnaire UI.

| Pros | Cons |
|------|------|
| Forces validation of the scoring UI during migration | 131+ assets × ~11 questions per scoring = ~1,441 checkbox clicks |
| Scoring UX is thoroughly tested as part of migration | Estimated time: 3-5 hours just for the scoring portion |
| Structural data migrated automatically (less error-prone) | Scoring data already exists in the "Balanceamentos" tab and can be parsed programmatically |
| | Manual scoring may produce different results than spreadsheet (subjective answer interpretation) |
| | Delays MVP by 3-5 hours for a purely mechanical task |

**Why rejected:** The scoring data (question answers per asset) is already structured in the "Balanceamentos" tab and can be parsed programmatically. Re-entering 1,441 checkbox responses manually is wasteful when the data is already available in machine-readable format. The scoring UI should be tested with a few representative assets (e.g., 5-10), not all 131.

---

## Trade-offs

| Dimension | CSV + PapaParse (chosen) | Google Sheets API | Manual entry | Hybrid (CSV + manual scoring) |
|-----------|-------------------------|-------------------|-------------|-------------------------------|
| Setup time | ~1 hour (script already exists) | ~4-8 hours (GCP project + credentials) | 0 hours (use built UI) | ~2 hours |
| Execution time | ~5 minutes (script run) | ~5 minutes (API calls) | 4-8 hours (manual data entry) | 3-5 hours (scoring portion) |
| Error rate | Low (automated parsing + validation) | Low (automated) | High (655+ manual entries = guaranteed typos) | Medium (manual scoring may diverge) |
| Parity validation | Automated comparison (rebalance output) | Automated comparison | Cannot automate (no systematic check) | Partial (structural only) |
| Dependencies | Public CSV link (already available) | Google Cloud project + service account | Nexus Data UI (must be fully built first) | CSV link + fully built scoring UI |
| Rerunnable | Yes (idempotent with UPSERT) | Yes (idempotent) | No (would need to start over or edit one by one) | Partially (structural yes, scoring no) |
| Brazilian format handling | PapaParse config (~10 LOC custom transform) | API returns raw values (no formatting) | Human interprets (visual) | PapaParse for structural data |

---

## Consequences

### Positive

- **Fast execution** — entire migration runs in <5 minutes locally (CSV download + parse + insert)
- **Rerunnable** — script uses upserts (`ON CONFLICT DO UPDATE`), so it can be re-executed safely if data needs correction or if new assets are added to the spreadsheet before go-live
- **Validated** — automated parity check compares rebalancing output between Nexus Data and spreadsheet reference with < R$ 1/asset tolerance
- **Existing tooling** — `fetch-sheet.mjs` already handles CSV export from Google Sheets; migration script extends this foundation
- **Auditable** — migration script is committed to git; exact transformation logic is reviewable and reproducible

### Negative

- **Depends on public CSV link** — the Google Sheet must have "publish to web" enabled during migration (security consideration: portfolio data temporarily accessible via public URL during migration window; can be disabled immediately after)
- **One-time script with limited reuse** — the migration script has limited value after initial migration (~200 LOC that may never run again; acceptable cost for automated validation)
- **Brazilian format edge cases** — PapaParse needs custom configuration for comma decimal separator; unusual formatting (e.g., negative percentages, mixed-format cells) may require manual fixup of 1-2 rows
- **#N/A data gaps** — some assets may have `#N/A` prices from GOOGLEFINANCE at the time of CSV export. These become `null` prices that must be filled by the first API price refresh post-migration (ADR-003/ADR-005)
- **Public link exposure** — during migration, the CSV link exposes portfolio data publicly. This window should be minimized (run script → disable link → verify)

### Obligations

1. **Dependency order** — Migration MUST insert in FK-respecting order: `asset_types` → `questionnaires` → `asset_groups` → `assets` → `asset_scores`. Foreign key violations will cause silent failures
2. **Parity validation** — After migration, MUST run `rebalance(portfolio, 12000)` with the same prices the spreadsheet uses and compare output per asset. Document results in a validation log. Tolerance: < R$ 1/asset (PRD G1/O1)
3. **Reference snapshot** — Before migration, MUST export a "reference output" from the spreadsheet: run rebalance with R$ 12,000 aporte and record the per-asset distribution. This becomes the test fixture for ADR-004 parity tests
4. **Idempotent script** — Migration script MUST use `UPSERT` (insert or update on conflict) so it can be safely re-run without duplicating data
5. **Post-migration price refresh** — After inserting assets, MUST trigger a manual price refresh (Edge Function) to populate `price_cache` with fresh API prices, replacing any `#N/A` values from the spreadsheet export
6. **Spreadsheet deprecation** — After successful parity validation, document that the Google Sheet is deprecated and disable the "publish to web" link. Do NOT delete the spreadsheet — keep as read-only archive for 6 months minimum
7. **User ID assignment** — Migration script MUST authenticate as Luis's user account or use service role key to set correct `user_id` on all inserted rows. Without correct `user_id`, RLS policies (ADR-007) will make the data inaccessible
