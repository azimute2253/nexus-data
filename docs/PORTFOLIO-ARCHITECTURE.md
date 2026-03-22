# Portfolio Web App — Architecture Design

> Web application to replace the Google Sheets portfolio rebalancing system
> Generated: 2026-03-18

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Astro 6 + React (islands) | Already used in azimute-blog; React for interactive dashboards |
| Backend | Supabase (Postgres + RLS) | Already integrated (auth exists); real-time subscriptions |
| Auth | Supabase Auth | Members area already implemented |
| Prices API | brapi.dev (B3), Yahoo Finance (US), exchangerate-api.com | Free tiers sufficient for personal use |
| Charts | Recharts or Chart.js | Lightweight, React-compatible |
| Styling | Tailwind CSS | Already available in project |

---

## Database Schema

### Core Tables

```sql
-- ============================================================
-- Asset types: the L1 allocation (10 categories)
-- ============================================================
CREATE TABLE asset_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,                    -- "FIIs", "Ações BR", etc.
  slug TEXT NOT NULL,                    -- URL-friendly: "fiis", "acoes-br"
  target_percentage DECIMAL(5,4) NOT NULL, -- 0.15 = 15%
  sort_order INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'BRL' CHECK (currency IN ('BRL', 'USD')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

-- Enable RLS
ALTER TABLE asset_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own types" ON asset_types
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- Asset groups within types: the L2 grouping (Grupo 1-5)
-- ============================================================
CREATE TABLE asset_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type_id UUID REFERENCES asset_types ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,                    -- "Grupo 1", "Logística", etc.
  target_percentage DECIMAL(5,4) NOT NULL, -- % of parent type
  scoring_method TEXT DEFAULT 'questionnaire'
    CHECK (scoring_method IN ('manual', 'questionnaire')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE asset_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own groups" ON asset_groups
  FOR ALL USING (
    asset_type_id IN (SELECT id FROM asset_types WHERE user_id = auth.uid())
  );

-- ============================================================
-- Individual assets (stocks, FIIs, ETFs, crypto, bonds)
-- ============================================================
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES asset_groups ON DELETE CASCADE NOT NULL,
  ticker TEXT NOT NULL,                  -- "VALE3", "BTLG11", "QQQM"
  display_name TEXT,                     -- Optional friendly name
  sector TEXT,                           -- "Logística", "Papel", etc.
  quantity DECIMAL(16,8) DEFAULT 0,      -- 8 decimals for crypto/fractional
  avg_cost DECIMAL(12,4),                -- Average purchase price
  api_source TEXT DEFAULT 'brapi'        -- 'brapi', 'yahoo', 'manual', 'crypto'
    CHECK (api_source IN ('brapi', 'yahoo', 'manual', 'crypto')),
  is_active BOOLEAN DEFAULT true,        -- false = excluded from rebalancing
  manual_override BOOLEAN DEFAULT false, -- "Vou aportar?" equivalent
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own assets" ON assets
  FOR ALL USING (
    group_id IN (
      SELECT ag.id FROM asset_groups ag
      JOIN asset_types at ON ag.asset_type_id = at.id
      WHERE at.user_id = auth.uid()
    )
  );

-- ============================================================
-- Price cache: avoid hitting APIs too frequently
-- ============================================================
CREATE TABLE price_cache (
  ticker TEXT PRIMARY KEY,
  price DECIMAL(16,4) NOT NULL,
  currency TEXT DEFAULT 'BRL',
  source TEXT NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- No RLS needed — prices are shared/public data

-- ============================================================
-- Questionnaire presets: reusable question sets
-- ============================================================
CREATE TABLE questionnaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,                    -- "FII Scoring", "Ações Scoring"
  description TEXT,
  questions JSONB NOT NULL DEFAULT '[]',
  -- questions schema: [{ id, text, weight, inverted }]
  -- inverted: if true, Yes=-1 and No=+1
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE questionnaires ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own questionnaires" ON questionnaires
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- Asset scores: questionnaire answers per asset
-- ============================================================
CREATE TABLE asset_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES assets ON DELETE CASCADE NOT NULL,
  questionnaire_id UUID REFERENCES questionnaires ON DELETE CASCADE NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  -- answers schema: { "question_id": true/false }
  total_score INTEGER GENERATED ALWAYS AS (
    -- Computed in app layer, stored for query performance
    0
  ) STORED,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id, questionnaire_id)
);

ALTER TABLE asset_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own scores" ON asset_scores
  FOR ALL USING (
    asset_id IN (
      SELECT a.id FROM assets a
      JOIN asset_groups ag ON a.group_id = ag.id
      JOIN asset_types at ON ag.asset_type_id = at.id
      WHERE at.user_id = auth.uid()
    )
  );

-- ============================================================
-- Contributions: history of investment entries
-- ============================================================
CREATE TABLE contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'BRL',
  distribution JSONB NOT NULL DEFAULT '{}',
  -- distribution schema: { "asset_id": amount_in_currency }
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own contributions" ON contributions
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- Exchange rates cache
-- ============================================================
CREATE TABLE exchange_rates (
  pair TEXT PRIMARY KEY,                 -- "USDBRL", "BTCBRL"
  rate DECIMAL(16,6) NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes

```sql
CREATE INDEX idx_assets_group ON assets(group_id);
CREATE INDEX idx_assets_ticker ON assets(ticker);
CREATE INDEX idx_asset_scores_asset ON asset_scores(asset_id);
CREATE INDEX idx_price_cache_fetched ON price_cache(fetched_at);
CREATE INDEX idx_contributions_user ON contributions(user_id, applied_at DESC);
```

### Views

```sql
-- Portfolio summary per asset type
CREATE VIEW portfolio_summary AS
SELECT
  at.id AS type_id,
  at.name AS type_name,
  at.target_percentage,
  at.currency,
  COALESCE(SUM(a.quantity * COALESCE(pc.price, 0)), 0) AS current_value,
  COUNT(a.id) AS asset_count
FROM asset_types at
LEFT JOIN asset_groups ag ON ag.asset_type_id = at.id
LEFT JOIN assets a ON a.group_id = ag.id AND a.is_active = true
LEFT JOIN price_cache pc ON pc.ticker = a.ticker
GROUP BY at.id, at.name, at.target_percentage, at.currency;
```

---

## API Routes

### Price Fetching

```
GET /api/prices/[ticker]
  → Checks price_cache (5min TTL)
  → If stale, fetches from brapi/yahoo
  → Returns { ticker, price, currency, fetchedAt }

POST /api/prices/refresh
  → Body: { tickers: string[] }
  → Batch refresh all prices
  → Returns { results: { ticker, price }[], errors: string[] }

GET /api/exchange-rates
  → Returns { USDBRL, BTCBRL, BTCUSD }
```

### Rebalancing Engine

```
POST /api/rebalance
  → Body: { contribution: number, currency: "BRL" }
  → Runs the 3-level algorithm
  → Returns:
    {
      total_portfolio: number,
      distribution: {
        type_id: {
          name: string,
          target_pct: number,
          current_value: number,
          contribution: number,
          groups: {
            group_id: {
              name: string,
              contribution: number,
              assets: {
                asset_id: {
                  ticker: string,
                  current_qty: number,
                  current_value: number,
                  ideal_pct: number,
                  contribution: number,
                  units_to_buy: number
                }
              }
            }
          }
        }
      }
    }
```

### Questionnaire

```
GET /api/questionnaires
  → List user's questionnaire presets

POST /api/questionnaires
  → Body: { name, questions: [{ text, weight?, inverted? }] }
  → Creates a new questionnaire

PUT /api/questionnaires/[id]
  → Updates questionnaire

POST /api/questionnaires/[id]/score
  → Body: { asset_id, answers: { question_id: boolean } }
  → Calculates and stores score
  → Returns { score, ideal_percentage }
```

### Portfolio CRUD

```
GET    /api/portfolio/types          → List asset types with totals
POST   /api/portfolio/types          → Create asset type
PUT    /api/portfolio/types/[id]     → Update target %
DELETE /api/portfolio/types/[id]     → Archive type

GET    /api/portfolio/groups/[typeId] → List groups in a type
POST   /api/portfolio/groups         → Create group
PUT    /api/portfolio/groups/[id]    → Update group

GET    /api/portfolio/assets/[groupId] → List assets with prices
POST   /api/portfolio/assets         → Add asset
PUT    /api/portfolio/assets/[id]    → Update qty, toggle active
DELETE /api/portfolio/assets/[id]    → Remove asset

POST   /api/portfolio/assets/[id]/buy  → Record purchase
  → Body: { quantity, price }
  → Updates quantity, recalculates avg_cost
```

---

## Rebalancing Algorithm (TypeScript)

```typescript
interface RebalanceInput {
  contribution: number;
  currency: 'BRL';
}

interface PortfolioState {
  types: AssetType[];  // with nested groups and assets
  exchangeRates: { USDBRL: number; BTCBRL: number };
}

function rebalance(input: RebalanceInput, state: PortfolioState): Distribution {
  const { contribution } = input;
  const { types, exchangeRates } = state;

  // Convert all values to BRL
  const typesWithValues = types.map(t => ({
    ...t,
    currentValue: calculateTypeValue(t, exchangeRates),
  }));

  const totalCurrent = typesWithValues.reduce((s, t) => s + t.currentValue, 0);
  const totalAfter = totalCurrent + contribution;

  // =========================================
  // STEP 1: L1 Distribution (type level)
  // =========================================
  const typeDistribution = distributeByDeficit(
    contribution,
    totalAfter,
    typesWithValues.map(t => ({
      id: t.id,
      targetPct: t.targetPercentage,
      currentValue: t.currentValue,
    }))
  );

  // =========================================
  // STEP 2-3: L2-L3 Distribution (group → asset)
  // =========================================
  const result: Distribution = {};

  for (const [typeId, typeContribution] of Object.entries(typeDistribution)) {
    if (typeContribution <= 0) continue;

    const type = typesWithValues.find(t => t.id === typeId)!;
    const groups = type.groups.filter(g => g.targetPercentage > 0);

    for (const group of groups) {
      const groupContribution = typeContribution * group.targetPercentage;
      const assets = group.assets.filter(a => a.isActive && !a.manualOverride);

      // Calculate ideal % from scores
      const totalScore = assets.reduce((s, a) => s + Math.max(0, a.score), 0);
      if (totalScore === 0) continue;

      const groupCurrentValue = assets.reduce((s, a) => s + a.currentValue, 0);
      const groupAfterValue = groupCurrentValue + groupContribution;

      // Find underweight assets
      const eligible = assets.filter(a => {
        const idealPct = a.score / totalScore;
        const currentPct = a.currentValue / groupAfterValue;
        return idealPct > currentPct;
      });

      if (eligible.length === 0) continue;

      // Calculate raw deficits
      const deficits = eligible.map(a => {
        const idealPct = a.score / totalScore;
        return {
          asset: a,
          deficit: groupAfterValue * idealPct - a.currentValue,
        };
      });

      const totalDeficit = deficits.reduce((s, d) => s + d.deficit, 0);

      // Distribute proportionally
      for (const { asset, deficit } of deficits) {
        const assetContribution = (deficit / totalDeficit) * groupContribution;
        const unitsToBuy = Math.floor(assetContribution / asset.currentPrice);

        result[asset.id] = {
          ticker: asset.ticker,
          contribution: assetContribution,
          unitsToBuy,
          currentValue: asset.currentValue,
          idealPct: asset.score / totalScore,
        };
      }
    }
  }

  return result;
}

function distributeByDeficit(
  contribution: number,
  totalAfter: number,
  items: { id: string; targetPct: number; currentValue: number }[]
): Record<string, number> {
  const result: Record<string, number> = {};

  // Find underweight items
  const underweight = items.filter(
    i => i.targetPct > i.currentValue / totalAfter
  );

  if (underweight.length === 0) return result;

  // Calculate deficits
  const deficits = underweight.map(i => ({
    id: i.id,
    deficit: totalAfter * i.targetPct - i.currentValue,
  }));

  const totalDeficit = deficits.reduce((s, d) => s + d.deficit, 0);

  // Distribute proportionally to deficit
  for (const { id, deficit } of deficits) {
    result[id] = (deficit / totalDeficit) * contribution;
  }

  // Zero out overweight items
  for (const i of items) {
    if (!(i.id in result)) result[i.id] = 0;
  }

  return result;
}
```

---

## UI Components & Pages

### 1. Central Dashboard (`/dashboard/portfolio`)

```
┌──────────────────────────────────────────────────────────┐
│  Portfolio Overview                     Total: R$ 319,393 │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────┐  ┌──────────────────────────────┐   │
│  │                  │  │ Asset Type    Target  Current │   │
│  │   PIE CHART      │  │ FIIs          15%    49.9%   │   │
│  │   (Current vs    │  │ Ações BR      35%    12.7%   │   │
│  │    Target)       │  │ Renda Fixa    10%     4.0%   │   │
│  │                  │  │ Ações US      10%     3.0%   │   │
│  │                  │  │ ...                          │   │
│  └─────────────────┘  └──────────────────────────────┘   │
│                                                           │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ New Contribution                                      │ │
│  │ Amount: [R$ 12,000.00]  [Calculate Rebalancing]      │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Rebalancing Result                                    │ │
│  │ Type            Contribute    Status                  │ │
│  │ Ações BR        R$ 4,428.51   ↑ Underweight           │ │
│  │ Ações US        R$ 1,446.11   ↑ Underweight           │ │
│  │ Renda Fixa      R$ 1,144.90   ↑ Underweight           │ │
│  │ Reserva Inv     R$ 1,154.82   ↑ Underweight           │ │
│  │ FIIs            R$ 0.00       ● Overweight            │ │
│  │                               [Apply Contribution]    │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 2. Asset Type Page (`/dashboard/assets/[type]`)

```
┌──────────────────────────────────────────────────────────┐
│  ← Back | Ações BR                    Total: R$ 40,480   │
│  Contribution from rebalancing: R$ 4,428.51              │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  Groups:                                                  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Grupo 1 (60%)  │  26 assets  │  R$ 24,288  │ [View] │  │
│  │ Grupo 2 (20%)  │  24 assets  │  R$ 8,096   │ [View] │  │
│  │ Grupo 3 (15%)  │  19 assets  │  R$ 6,072   │ [View] │  │
│  │ Grupo 4 (5%)   │  14 assets  │  R$ 2,024   │ [View] │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  [+ Add Group]  [Edit Scoring]                            │
└──────────────────────────────────────────────────────────┘
```

### 3. Group Detail (`/dashboard/assets/[type]/[group]`)

```
┌──────────────────────────────────────────────────────────┐
│  ← Ações BR | Grupo 1 (60%)            R$ 24,288.12     │
│  Scoring: Questionnaire ▾                                │
├──────────────────────────────────────────────────────────┤
│  Ticker  Qty  Price    Value     Score Ideal%  Buy       │
│  VALE3   54   77.13    4,165.02   11   3.14%   0        │
│  WEGE3   27   46.16    1,246.32   11   3.14%   1        │
│  POMO3   113   5.56      628.28    9   2.57%  45        │
│  RDOR3   25   37.02      925.50   11   3.14%   6        │
│  ITUB3   30   41.14    1,234.20   11   3.14%   2        │
│  PSSA3   21   47.65    1,000.65   11   3.14%   4        │
│  ...                                                      │
│                                                           │
│  [+ Add Asset]  [Score All]  [Refresh Prices]            │
└──────────────────────────────────────────────────────────┘
```

### 4. Questionnaire Editor (`/dashboard/questionnaires/[id]`)

```
┌──────────────────────────────────────────────────────────┐
│  Questionnaire: "Ações Scoring"        11 questions      │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ 1. A empresa paga dividendos regularmente?     [×]  │ │
│  │ 2. O P/L está abaixo da média do setor?        [×]  │ │
│  │ 3. A dívida líquida/EBITDA é menor que 3?      [×]  │ │
│  │ 4. A empresa tem crescido receita nos últimos   [×]  │ │
│  │    5 anos?                                           │ │
│  │ 5. O ROE é maior que 10%?                      [×]  │ │
│  │ ...                                                  │ │
│  │ [+ Add Question]                                     │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  Preview: Score asset → [Select ticker ▾] [Score]        │
│                                                           │
│  VALE3:                                                   │
│  Q1: [Yes] Q2: [No] Q3: [Yes] ... → Score: 11/11        │
│                                                           │
│  [Save Questionnaire]                                     │
└──────────────────────────────────────────────────────────┘
```

### 5. Asset Scoring Modal

```
┌──────────────────────────────────────────┐
│  Score: VALE3 (Vale S.A.)                │
│  Questionnaire: Ações Scoring            │
├──────────────────────────────────────────┤
│                                           │
│  1. Dividendos regulares?    [Yes] [No]  │
│  2. P/L abaixo da média?    [Yes] [No]  │
│  3. Dívida/EBITDA < 3?      [Yes] [No]  │
│  4. Crescimento de receita?  [Yes] [No]  │
│  5. ROE > 10%?              [Yes] [No]  │
│  6. ...                      [Yes] [No]  │
│                                           │
│  Score: 11 / 11                          │
│  Ideal allocation: 3.14%                 │
│                                           │
│  [Save] [Cancel]                         │
└──────────────────────────────────────────┘
```

---

## Price API Integration

### brapi.dev (B3 — Brazilian stocks & FIIs)

```typescript
// Free tier: 15,000 requests/month
const BRAPI_BASE = 'https://brapi.dev/api';

async function fetchBrapiPrice(ticker: string): Promise<number> {
  const res = await fetch(`${BRAPI_BASE}/quote/${ticker}?token=${BRAPI_TOKEN}`);
  const data = await res.json();
  return data.results[0].regularMarketPrice;
}

// Batch: up to 20 tickers at once
async function fetchBrapiBatch(tickers: string[]): Promise<Record<string, number>> {
  const joined = tickers.join(',');
  const res = await fetch(`${BRAPI_BASE}/quote/${joined}?token=${BRAPI_TOKEN}`);
  const data = await res.json();
  return Object.fromEntries(
    data.results.map((r: any) => [r.symbol, r.regularMarketPrice])
  );
}
```

### Yahoo Finance (US stocks & ETFs)

```typescript
// Via yahoo-finance2 npm package or direct API
async function fetchYahooPrice(ticker: string): Promise<number> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`
  );
  const data = await res.json();
  return data.chart.result[0].meta.regularMarketPrice;
}
```

### Exchange Rates

```typescript
// exchangerate-api.com free tier: 1,500 requests/month
async function fetchExchangeRate(from: string, to: string): Promise<number> {
  const res = await fetch(
    `https://v6.exchangerate-api.com/v6/${API_KEY}/pair/${from}/${to}`
  );
  const data = await res.json();
  return data.conversion_rate;
}
```

### Caching Strategy

```
- Price cache TTL: 5 minutes during market hours, 1 hour after
- Exchange rate TTL: 15 minutes
- Market hours: B3 10:00-17:00 BRT, US 9:30-16:00 ET
- Background refresh: Supabase Edge Function on cron (every 5min during market hours)
```

---

## Cost Estimate

### Supabase (Free tier)

| Resource | Free Tier | Usage Estimate |
|----------|-----------|---------------|
| Database | 500MB | ~5MB (well under) |
| Auth | 50,000 MAU | 1 user |
| Edge Functions | 500K invocations/month | ~8,640 (5min cron) |
| Realtime | 200 concurrent connections | 1 |
| Storage | 1GB | Not needed |

**Cost: R$ 0/month** (free tier is sufficient for single-user)

### Price APIs

| API | Free Tier | Usage | Cost |
|-----|-----------|-------|------|
| brapi.dev | 15,000 req/month | ~8,640 (5min refresh, ~120 tickers) | Free |
| Yahoo Finance | Unofficial API, no limit | ~4,320 (5min refresh, ~20 tickers) | Free |
| exchangerate-api.com | 1,500 req/month | ~1,440 (15min refresh) | Free |

**Total estimated cost: R$ 0/month**

If brapi.dev limit is exceeded, fallback to scraping StatusInvest or using the B3 direct API.

---

## Security Considerations

1. **RLS everywhere**: Every table has row-level security policies scoped to `auth.uid()`
2. **API keys server-side**: brapi/Yahoo keys stored in Supabase secrets, not exposed to client
3. **Rate limiting**: Edge Functions handle API calls, client never calls external APIs directly
4. **Input validation**: Zod schemas for all API request bodies
5. **No financial transactions**: This app only calculates — it doesn't execute trades

---

## File Structure

```
src/
├── pages/
│   ├── dashboard/
│   │   ├── portfolio.astro           # Central dashboard (L1)
│   │   ├── assets/
│   │   │   ├── [type].astro          # Asset type page (L2)
│   │   │   └── [type]/[group].astro  # Group detail (L3)
│   │   ├── questionnaires/
│   │   │   ├── index.astro           # List questionnaires
│   │   │   └── [id].astro            # Edit questionnaire
│   │   └── contributions.astro       # Contribution history
│   └── api/
│       ├── prices/
│       │   ├── [ticker].ts           # Single price fetch
│       │   └── refresh.ts            # Batch refresh
│       ├── exchange-rates.ts
│       ├── rebalance.ts              # Core algorithm
│       ├── portfolio/
│       │   ├── types.ts
│       │   ├── groups.ts
│       │   └── assets.ts
│       └── questionnaires/
│           ├── index.ts
│           └── [id]/score.ts
├── components/
│   ├── portfolio/
│   │   ├── AllocationChart.tsx        # Pie chart (current vs target)
│   │   ├── ContributionInput.tsx      # Amount input + calculate
│   │   ├── RebalanceResults.tsx       # Distribution table
│   │   ├── AssetTable.tsx             # Sortable asset list
│   │   ├── GroupCard.tsx              # Group summary card
│   │   └── PriceDisplay.tsx           # Real-time price with refresh
│   └── questionnaire/
│       ├── QuestionnaireEditor.tsx     # Add/edit questions
│       ├── ScoringModal.tsx           # Score an asset
│       └── ScorePreview.tsx           # Show score calculation
├── lib/
│   ├── rebalance.ts                   # Core algorithm (shared)
│   ├── prices.ts                      # Price fetching utilities
│   └── supabase.ts                    # Client + types
└── types/
    └── portfolio.ts                   # TypeScript interfaces
```
