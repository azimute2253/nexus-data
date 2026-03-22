# Google Sheet Analysis — Portfolio de Investimentos

**Sheet ID:** `1HG6pQdx-P85vd8EVg7bDzI2X-yW4bAF1HQVbXIaes0g`
**Analyzed:** 2026-03-18
**Data Source:** Public CSV export (no authentication required)
**Status:** ✅ **Analysis Complete**

---

## 1. Sheet Structure

### Tabs Identified

1. **Alocação de Ativos** (Portfolio Allocation) — Main overview
2. **FIIs** (Real Estate Investment Trusts) — Detailed FII holdings

---

## 2. Tab: Alocação de Ativos (Portfolio Allocation)

### Purpose
High-level portfolio allocation tracker with target percentages and rebalancing calculations.

### Columns
| Column | Type | Description | Sample Values |
|--------|------|-------------|---------------|
| Tipo de ativo | text | Asset class name | "Reserva de investimento", "FIIs", "Ações BR" |
| Porcentagem desejada | percentage | Target allocation | "5,00%", "15,00%", "35,00%" |
| Proporção ajustada | percentage | Adjusted proportion (conditional) | "9,62%", "0,00%", "36,90%" |
| Diferença | currency | Rebalancing amount needed | "R$ 12.789,19", "R$ 0,00" |
| Condição | boolean | Rebalancing condition (1=yes, 0=no) | 0, 1 |
| % Atual | percentage | Current allocation | "0,82%", "65,33%", "16,60%" |
| Valor atual | currency | Current value | "R$ 1.993,98", "R$ 159.262,78" |
| Aporte por ativo | currency | Contribution per asset | "R$ 974,77", "R$ 0,00" |
| Valor após aportes | currency | Value after contribution | "R$ 2.968,75", "R$ 159.262,78" |

### Asset Classes Tracked
1. **Reserva de investimento** (Investment reserve) — 5% target
2. **Reserva de valor** (Store of value) — 5% target
3. **Renda fixa BR** (Brazilian fixed income) — 10% target
4. **FIIs** (Real estate funds) — 15% target
5. **Ações BR** (Brazilian stocks) — 35% target
6. **Ações US** (US stocks) — 10% target
7. **REITs** (US real estate) — 5% target
8. **Renda fixa no exterior** (Foreign fixed income) — 5% target
9. **Ações Europa** (European stocks) — 5% target
10. **Ações Asia** (Asian stocks) — 5% target

### Key Metrics
- **Total Portfolio:** R$ 243.784,08 (current)
- **Total Contribution:** R$ 12.000,00
- **Portfolio After Contributions:** R$ 255.784,08
- **USD Equivalent:** ~$12.084,15

### Business Logic
- Calculates rebalancing needs based on target vs. current allocation
- Conditional logic determines if an asset class should receive contributions
- FIIs currently overweight (65.33% vs. 15% target) → no new contributions
- Other asset classes adjusted proportionally to compensate

---

## 3. Tab: FIIs (Real Estate Investment Trusts)

### Purpose
Detailed tracking of individual FII holdings with sector allocation and rebalancing logic.

### Columns
| Column | Type | Description | Sample Values |
|--------|------|-------------|---------------|
| (Index) | number | Position number | 1, 2, 3... |
| Fundos | text | FII ticker symbol | "BTLG11", "XPLG11", "HGLG11" |
| Setor | text | Sector classification | "Logistica", "Shopping", "Varejo", "Papel" |
| Quantidade | integer | Number of shares owned | 93, 94, 1057 |
| Cotação | currency | Current price per share | "R$ 103,80", "R$ 101,66" |
| Saldo | currency | Total position value | "R$ 9.653,40", "R$ 9.556,04" |
| %Carteira | percentage | % of FII portfolio | "6,06%", "6,00%", "5,76%" |
| % Ideal | percentage | Target allocation within FIIs | "18,18%", "90,91%", "-9,09%" |
| Bal | percentage | Balance indicator | "12,49%", "87,51%" |
| Bal (currency) | currency | Rebalancing amount | "R$ 19.303,47", "R$ 135.228,31" |
| (Flag) | integer | Buy signal (-2, -10, 0, 1) | -2, -10, 1, 0 |
| (Flag 2) | binary | Secondary flag | 0, 1 |
| Vou aportar? | text | Will contribute? | "Sim", "Não" |
| Aporte ideal por ativo | currency | Ideal contribution per asset | "R$ 0,00" (all currently) |
| Quantidade | number | Additional shares to buy | "0,0" |
| Valores total | - | Empty column | - |
| Ultimos prov. | currency | Last dividend | "0,78", "0,82", "1,1" |
| Somat prov. | - | Dividend sum | - |

### FII Holdings Summary
**Total Holdings:** 20 FIIs
**Total Value:** R$ 159.262,78
**Total Shares:** ~5,000+ across all FIIs

### Sector Breakdown
| Sector | FIIs Count | Examples |
|--------|-----------|----------|
| **Logística** (Logistics) | 5 | BTLG11, XPLG11, HGLG11, GARE11, GGRC11 |
| **Shopping** (Malls) | 2 | HGBS11, HSML11 |
| **Varejo** (Retail) | 4 | HGRU11, SEQR11, TRXF11, RZAT11 |
| **Papel** (Paper/Receivables) | 4 | KNCR11, KNSC11, MXRF11, PCIP11 |
| **Infra** (Infrastructure) | 2 | CPTI11, JURO11 |
| **Agro** (Agriculture) | 1 | RZTR11 |
| **Fiagro** (Agribusiness) | 1 | SNAG11 |
| **Energia** (Energy) | 1 | SNEL11 |

### Top Holdings
1. **RZAT11** (Retail) — R$ 10.807,20 (6,79%)
2. **SEQR11** (Retail) — R$ 10.358,34 (6,50%)
3. **HSML11** (Shopping) — R$ 10.355,00 (6,50%)
4. **HGRU11** (Retail) — R$ 9.824,52 (6,17%)
5. **BTLG11** (Logistics) — R$ 9.653,40 (6,06%)

### Business Logic
- **% Ideal:** Target allocation within FII sub-portfolio (logistics heavily favored: XPLG11 at 90.91%)
- **Bal:** Indicates rebalancing need (positive = underweight, negative = overweight)
- **Vou aportar?:** All set to "Sim" but `Aporte ideal por ativo` is R$ 0,00 (no contributions planned)
- **Últimos prov.:** Tracks last dividend per share for income analysis

---

## 4. Data Entities & Relationships

### Primary Entities

#### 1. Asset Class (from Alocação tab)
**Attributes:**
- Name (tipo de ativo)
- Target allocation (porcentagem desejada)
- Current allocation (% atual)
- Current value (valor atual)
- Rebalancing need (diferença, condição)

**Unique ID:** Asset class name
**Relationships:** FIIs → detailed breakdown in FIIs tab

#### 2. FII Holding (from FIIs tab)
**Attributes:**
- Ticker (fundos)
- Sector (setor)
- Shares owned (quantidade)
- Current price (cotação)
- Position value (saldo)
- Portfolio weight (%carteira)
- Target allocation (% ideal)
- Last dividend (últimos prov.)

**Unique ID:** Ticker symbol
**Relationships:** Rolls up to "FIIs" asset class in portfolio allocation

### Data Relationships
```
Portfolio (R$ 243.784,08)
├── Reserva de investimento (R$ 0,01)
├── Reserva de valor (R$ 1.993,98)
├── Renda fixa BR (R$ 12.899,03)
├── FIIs (R$ 159.262,78) ◄─┐
│   ├── BTLG11              │
│   ├── XPLG11              │
│   └── ... (20 FIIs)       │
├── Ações BR (R$ 40.480,23) │
├── Ações US (R$ 9.563,07)  │
└── ... (other classes)     │
                            │
FIIs Tab (detailed) ────────┘
```

---

## 5. Proposed Dashboard Functionalities

### 5.1 Display Features

#### **Overview Dashboard**
- ✅ **Portfolio Total:** Large number display (R$ 243.784,08)
- ✅ **Asset Allocation Pie Chart:**
  - 10 slices (one per asset class)
  - Color-coded by geography/type
  - Hover: shows current vs. target %
- ✅ **Rebalancing Alert:**
  - Highlight overweight/underweight classes
  - Show "Diferença" amounts for each
- ✅ **Contribution Calculator:**
  - Input field: "Aporte total"
  - Auto-calculates distribution across assets
  - Shows "Valor após aportes" projections

#### **FII Portfolio Page**
- ✅ **Sector Allocation Donut Chart:**
  - 8 sectors (Logística, Shopping, Varejo, etc.)
  - Interactive drill-down to holdings
- ✅ **Holdings Table:**
  - Sortable columns: Ticker, Sector, Value, %, Dividend
  - Color-coded rows: green (underweight), red (overweight)
  - Click ticker → detail modal
- ✅ **Top Holdings Cards:**
  - 5 largest positions
  - Mini sparkline of recent price (if historical data available)
- ✅ **Dividend Tracker:**
  - Table: Ticker | Last Dividend | Yield (calculated)
  - Total monthly income estimate

#### **Rebalancing View**
- ✅ **What-If Simulator:**
  - Slider: contribution amount
  - Live update: how allocation changes
  - Highlight: which assets receive funds
- ✅ **Trade Suggestions:**
  - List: "Buy X shares of BTLG11" based on ideal allocation
  - Priority ranking (which FIIs to prioritize)

### 5.2 Filters & Search

#### **Asset Class Filter**
- ✅ Multi-select: Brazilian, US, Europe, Asia, Fixed Income, Real Estate
- ✅ Filter by: Overweight | Underweight | Balanced

#### **FII Filters**
- ✅ Sector dropdown (Logística, Shopping, etc.)
- ✅ Search by ticker (autocomplete)
- ✅ Sort by: % Portfolio, Value, Dividend Yield, Target Allocation

### 5.3 CRUD Operations

| Operation | Status | Notes |
|-----------|--------|-------|
| **View** | ✅ Read-only | Fetch via CSV export (no auth needed) |
| **Add** | ❌ Not supported | Would require OAuth + write permissions |
| **Edit** | ❌ Not supported | Sheet is managed externally |
| **Delete** | ❌ Not supported | Read-only dashboard |

**Recommendation:** Dashboard is **view-only**. User edits sheet directly, dashboard reflects changes on refresh.

### 5.4 Data Visualizations

#### **Charts to Implement**
1. **Pie Chart:** Asset allocation (current vs. target overlaid)
2. **Donut Chart:** FII sector breakdown
3. **Bar Chart (Horizontal):** Rebalancing needs (positive/negative bars)
4. **Stacked Bar Chart:** FII allocation within sectors
5. **Heatmap:** FII performance matrix (sector × allocation status)
6. **Gauge Chart:** Portfolio vs. target alignment (0-100%)

#### **Chart Libraries**
- **Recommended:** [Chart.js](https://www.chartjs.org/) or [Recharts](https://recharts.org/)
- **Alternative:** [D3.js](https://d3js.org/) for custom interactive viz

### 5.5 Mobile Responsiveness

**Key Considerations:**
- **Data volume:** 10 asset classes + 20 FIIs = manageable for mobile
- **Tables:** Use card layout on mobile (collapse columns)
- **Charts:** Responsive resizing, touch-friendly legends
- **Priority info:** Show totals and top 5 holdings first
- **Sticky headers:** Keep portfolio total visible on scroll

**Mobile Layout:**
```
[Portfolio Total Card]
[Asset Allocation Chart]
[Quick Stats: Top Holding | Rebalancing Needed | Monthly Dividend]
[Tab Navigation: Overview | FIIs | Rebalancing]
```

---

## 6. Technical Implementation

### 6.1 Data Fetching

**Method 1: Public CSV Export (Current - WORKING)**
```javascript
const SHEET_ID = '1HG6pQdx-P85vd8EVg7bDzI2X-yW4bAF1HQVbXIaes0g';

// Portfolio allocation (default sheet)
const portfolioCSV = await fetch(
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`
);

// FIIs (gid=0)
const fiisCSV = await fetch(
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`
);
```

**Pros:** No authentication, fast, simple
**Cons:** Requires CSV parsing, gid-based tab access (fragile if tabs reorder)

**Method 2: Google Sheets API (Future)**
- Use existing `scripts/fetch-sheet.mjs` with OAuth token
- Fetches tab names dynamically (more robust)
- Requires one-time OAuth setup

**Update Frequency:**
- **Real-time:** Not needed (portfolio updates manually)
- **Recommended:** Hourly cron job or on-demand refresh button
- **Caching:** 1-hour client-side cache + SSR/ISR

### 6.2 Data Processing

**CSV Parsing:**
```javascript
// Use PapaParse or csv-parse
import Papa from 'papaparse';

const parsed = Papa.parse(csvText, {
  header: true,
  dynamicTyping: true,
  skipEmptyLines: true,
});

// Post-process: convert Brazilian currency (R$ 1.234,56 → 1234.56)
const parseCurrency = (str) => {
  return parseFloat(
    str.replace('R$ ', '').replace(/\./g, '').replace(',', '.')
  );
};
```

**Data Normalization:**
- Store in JSON structure (already in `data/sheet-data.json`)
- Calculate derived fields:
  - Total portfolio value
  - Asset class percentages
  - Rebalancing deltas
  - Dividend yields (if dividend data available)

### 6.3 UI Components

**Component Library:** [shadcn/ui](https://ui.shadcn.com/) (Astro-compatible via React Islands)

**Key Components:**
1. **PortfolioSummaryCard** — Total value, allocation pie chart
2. **AssetClassTable** — Sortable, filterable table
3. **FIIHoldingsGrid** — Card grid or data table
4. **RebalancingCalculator** — Input slider, live updates
5. **SectorBreakdownChart** — Donut chart with legend
6. **DividendTracker** — Table + total income display

**Astro Islands Strategy:**
```astro
---
// Dashboard.astro
import PortfolioSummary from '@/components/PortfolioSummary.tsx';
import FIIHoldings from '@/components/FIIHoldings.tsx';

const sheetData = await fetchSheetData(); // SSR
---

<Layout>
  <PortfolioSummary client:load data={sheetData.portfolio} />
  <FIIHoldings client:visible data={sheetData.fiis} />
</Layout>
```

### 6.4 State Management

**Recommendation:** No global state needed initially

**Component-level state:**
- Filters (sector, sort order) — `useState` in React islands
- Active tab (Overview | FIIs | Rebalancing) — URL query params

**If needed later:**
- [Zustand](https://zustand-demo.pmnd.rs/) — lightweight, SSR-friendly
- [Nanostores](https://github.com/nanostores/nanostores) — Astro-native

### 6.5 Styling

**Approach:** Tailwind CSS (already in project)

**Color Palette:**
- **Overweight assets:** Red (#ef4444)
- **Underweight assets:** Green (#10b981)
- **Balanced assets:** Blue (#3b82f6)
- **FII sectors:** Distinct hues per sector

**Typography:**
- Currency values: Tabular numbers (`font-variant-numeric: tabular-nums`)
- Percentages: Monospace for alignment

---

## 7. Recommended Implementation Phases

### Phase 1: MVP (1-2 weeks)
**Scope:** Read-only dashboard with core features

**Tasks:**
1. ✅ **Data fetching:** CSV export → JSON conversion (DONE)
2. **API route:** `/api/portfolio-data.json` (fetch + cache)
3. **Dashboard page:** `/dashboard/portfolio`
4. **Components:**
   - Portfolio summary card (total, allocation pie chart)
   - Asset class table (sortable, shows current vs. target)
   - FII holdings table (filterable by sector)
5. **Basic styling:** Tailwind, responsive layout
6. **Refresh button:** Manual data reload

**Deliverables:**
- View portfolio allocation
- See FII holdings breakdown
- Identify overweight/underweight assets

---

### Phase 2: Enhanced Visualizations (1 week)
**Scope:** Interactive charts and rebalancing tools

**Tasks:**
1. **Charts:**
   - Donut chart for FII sectors
   - Bar chart for rebalancing needs
   - Gauge for portfolio alignment
2. **Rebalancing calculator:**
   - Input contribution amount
   - Show recommended distribution
3. **Dividend tracker:**
   - Table with yields
   - Estimated monthly income

**Deliverables:**
- Visual analysis tools
- What-if contribution planning

---

### Phase 3: Advanced Features (Future)
**Scope:** Historical data, alerts, optimizations

**Tasks:**
1. **Historical tracking:**
   - Store snapshots in Supabase
   - Line charts for portfolio growth over time
2. **Alerts:**
   - Email/push when allocation drift > threshold
   - Dividend payment reminders
3. **Performance analytics:**
   - ROI per asset class
   - Dividend yield trends
4. **Export:**
   - PDF report generation
   - CSV download of holdings

---

## 8. Technical Stack Summary

| Layer | Technology |
|-------|-----------|
| **Framework** | Astro (SSR/ISR) |
| **UI Components** | React islands (shadcn/ui) |
| **Charts** | Chart.js or Recharts |
| **Styling** | Tailwind CSS |
| **Data Source** | Google Sheets CSV export |
| **Data Storage** | JSON file cache (`data/sheet-data.json`) |
| **API Routes** | Astro endpoints (`/api/*`) |
| **Authentication** | Supabase (existing setup) |
| **Deployment** | Vercel (existing) |

---

## 9. Next Steps

### Immediate Actions

1. **Create API endpoint:**
   ```bash
   # File: src/pages/api/portfolio-data.json.ts
   # Fetches CSV, converts to JSON, caches for 1 hour
   ```

2. **Build dashboard layout:**
   ```bash
   # File: src/pages/dashboard/portfolio.astro
   # Layout: header, summary cards, tabs (Overview | FIIs | Rebalancing)
   ```

3. **Implement PortfolioSummary component:**
   ```bash
   # File: src/components/PortfolioSummary.tsx
   # Shows: total value, allocation pie chart, quick stats
   ```

4. **Test with real data:**
   - Load from `data/sheet-data.json`
   - Verify currency parsing
   - Check mobile responsiveness

### Questions for User

1. **Authentication:** Should dashboard be public or require login?
2. **Refresh frequency:** Auto-refresh hourly, or manual button only?
3. **FII details:** Include historical price charts if available?
4. **Notifications:** Email alerts for rebalancing needs?

---

## 10. Sample Data Summary

### Portfolio Overview (Alocação de Ativos)
- **Total Value:** R$ 243.784,08
- **Largest Allocation:** FIIs (65.33%, overweight by ~50%)
- **Smallest Allocation:** Reserva de investimento (0.00%)
- **Contribution Planned:** R$ 12.000,00

### FII Holdings
- **Number of FIIs:** 20
- **Total FII Value:** R$ 159.262,78
- **Top Sector:** Logistics (5 FIIs, ~30% of FII portfolio)
- **Smallest Position:** KNCR11 (R$ 1.050,30, 0.66%)
- **Largest Position:** RZAT11 (R$ 10.807,20, 6.79%)

### Rebalancing Insights
- **FIIs:** Massively overweight → no new contributions
- **Ações BR:** Underweight → receives R$ 4.428,53
- **Ações US:** Underweight → receives R$ 1.446,13
- **All others:** Receive proportional contributions

---

## Appendix: Data Access Methods

### Method 1: Public CSV (Current - WORKING)
```bash
# Portfolio allocation
curl "https://docs.google.com/spreadsheets/d/1HG6pQdx-P85vd8EVg7bDzI2X-yW4bAF1HQVbXIaes0g/export?format=csv"

# FIIs (gid=0)
curl "https://docs.google.com/spreadsheets/d/1HG6pQdx-P85vd8EVg7bDzI2X-yW4bAF1HQVbXIaes0g/export?format=csv&gid=0"
```

### Method 2: Google Sheets API (Future)
```javascript
// scripts/fetch-sheet.mjs (existing)
import { fetchSheet } from './scripts/fetch-sheet.mjs';

const data = await fetchSheet();
// Returns: { metadata, tabs: { sheet1: rows[], sheet2: rows[] } }
```

### Method 3: Scheduled Cron (Production)
```bash
# .github/workflows/fetch-sheet.yml
# Runs hourly, commits updated data/sheet-data.json
```

---

**End of Analysis** — Ready for implementation!
