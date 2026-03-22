# Portfolio Spreadsheet Analysis

> Deep reverse-engineering of `data/portfolio.xlsx` (71KB, 6 tabs)
> Generated: 2026-03-18

---

## Overview

The spreadsheet implements a **3-level hierarchical portfolio rebalancing system** for a Brazilian investor with both domestic (B3) and international assets. Total portfolio value: **~R$ 243,783** (domestic) + **~USD 12,084** (international) = **~R$ 319,393** (combined at 5.2639 BRL/USD).

### Tab Structure

| # | Tab Name | Purpose | Rows x Cols | Formulas |
|---|----------|---------|-------------|----------|
| 1 | Distribuição de aporte | L1 — Central allocation panel | 18 x 10 | 100 |
| 2 | RI, RV e RF | L2 — Investment reserve, Store of value, Fixed income | 46 x 16 | 376 |
| 3 | FII | L2 — Real estate investment trusts (FIIs) | 24 x 19 | 265 |
| 4 | Ações | L2 — Brazilian stocks | 106 x 15 | 984 |
| 5 | Exterior | L2 — International assets (ETFs) | 46 x 16 | 439 |
| 6 | Balanceamentos | L3 — Questionnaire scoring system | ~40 x 90+ | ~500+ |

---

## Tab 1: Distribuição de aporte (Contribution Distribution)

### Purpose
Central control panel. User enters a contribution amount (R$ 12,000). The system distributes it across 10 asset types based on target percentages, considering current holdings.

### Layout

| Row | Col A | Col B | Col C | Col D | Col E | Col F | Col G | Col H | Col I | Col J |
|-----|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|
| 1 | Aporte total | **12000** | 255783.45 | | | | | | | |
| 2 | Tipo de ativo | % desejada | Prop. ajustada | Diferença | Condição | % Atual | Valor atual | Aporte por ativo | Valor após aporte | |

### Asset Types (Rows 3-12)

| Row | Asset Type | Target % | Current Value (R$) | Source |
|-----|-----------|----------|-------------------|--------|
| 3 | Reserva de investimento | 5% | 0.01 | `'RI, RV e RF'!F42` |
| 4 | Reserva de valor | 5% | 1,992.80 | `'RI, RV e RF'!F43` |
| 5 | Renda fixa BR | 10% | 12,899.03 | `'RI, RV e RF'!F44` |
| 6 | FIIs | 15% | 159,262.78 | `FII!F23` |
| 7 | Ações BR | 35% | 40,480.23 | `'Ações'!E102` |
| 8 | Ações US | 10% | 9,563.25 | `Exterior!H42` |
| 9 | REITs | 5% | 4,554.63 | `Exterior!H43` |
| 10 | Renda fixa exterior | 5% | 4,955.09 | `Exterior!H44` |
| 11 | Ações Europa | 5% | 4,853.79 | `Exterior!H45` |
| 12 | Ações Asia | 5% | 5,221.85 | `Exterior!H46` |

### Column Formulas (per row, using row 3 as example)

| Column | Header | Formula | Description |
|--------|--------|---------|-------------|
| B | % desejada | Manual input | Target allocation % (sums to 100%) |
| C | Prop. ajustada | `=IF(E3=1,D3/D13,0)` | Adjusted proportion — only if condition=1, normalizes deficit vs total deficit |
| D | Diferença | `=IF(E3=1,C1*B3-G3,0)` | Deficit = total_with_contribution * target% - current_value |
| E | Condição | `=IF(B3>G3/C1,1,0)` | Condition: 1 if target% > current% (underweight), else 0 |
| F | % Atual | `=G3/G13` | Current allocation = current_value / total_current |
| G | Valor atual | Cross-tab reference | Current value from respective tab |
| H | Aporte por ativo | `=IF(G3/C1>B3,C1*B3-G3,C3*B1)` | Contribution per type — cascading waterfall |
| I | Valor após aporte | `=G3+H3` | Value after contribution |
| J | | `=I3/C1` | Final allocation % |

### Key Insight: Cascading Waterfall Distribution

The contribution distribution uses a **priority waterfall** algorithm:
1. For each asset type, calculate the deficit: `total_portfolio * target% - current_value`
2. If the type is overweight (condition=0), skip it entirely (no contribution)
3. For underweight types, normalize deficit proportions only among eligible types
4. The `H` column applies a cascading check: first row gets full proportional allocation, subsequent rows check if previous was allocated

### Currency Conversion (Rows 15-17)

```
Row 15: Aporte = 12,000 | Total after = 255,783.45
Row 16: USD balance conversion using GOOGLEFINANCE("CURRENCY:USDBRL") = 5.2639
Row 17: USD equivalent = 12,084.15
```

The system checks if the USD portion makes the portfolio exceed a threshold, then adjusts accordingly.

---

## Tab 2: RI, RV e RF (Reserves + Fixed Income)

### Purpose
Manages 3 sub-categories of low-risk assets: Investment Reserve (Grupo 1), Store of Value/BTC (Grupo 2), and Brazilian Fixed Income (Grupo 3). Each asset is assigned to a group, and rebalancing happens within each group.

### Column Structure

| Col | Header | Description |
|-----|--------|-------------|
| A | (row #) | Sequential numbering |
| B | Ativo | Asset name |
| C | Setor | Sector |
| D | Quantidade | Quantity |
| E | Cotação | Price (1 for fixed income) |
| F | Saldo | Balance = D*E |
| G | %Carteira | % of group total |
| H | %C/aporte | % of group post-contribution |
| I | % Ideal | Ideal % from scoring |
| J | Bal | Rebalancing condition (0/1) |
| K | Bal | Contribution amount if eligible |
| L | (Group) | Group assignment (Grupo 0-5) |
| M | Aporte | Score from Balanceamentos tab |
| N | (Condition) | `=IF(I<H,0,1)` — can receive contribution? |
| O | Aporte ideal por ativo | Ideal contribution per asset |
| P | % após aport | % after contribution |

### Active Assets

| Asset | Group | Value (R$) | Notes |
|-------|-------|-----------|-------|
| ROMP | Grupo 1 | 0.01 | Placeholder with minimal value |
| Tesouro IPCA | Grupo 3 | 3,102.81 | Treasury bond |
| CDB, LCA, ETC | Grupo 3 | 9,796.22 | Bank certificates |
| BTC | Grupo 2 | 1,992.80 | Bitcoin via GOOGLEFINANCE("CURRENCY:BTCBRL") |

### Group Summary (Rows 42-46)

| Group | Name | Target % | Contribution | Current Value | Post-Contribution |
|-------|------|----------|-------------|---------------|-------------------|
| G1 | Reserva Inv | 5% | R$ 1,154.82 | R$ 0.01 | R$ 1,154.83 |
| G2 | Reserva Val | 5% | R$ 974.88 | R$ 1,992.80 | R$ 2,967.67 |
| G3 | Renda fixa | 10% | R$ 1,144.90 | R$ 12,899.03 | R$ 14,043.93 |
| G4 | (unused) | 0% | — | — | — |
| G5 | (unused) | 0% | — | — | — |

### Scoring Formula (Column I)

```
I = IFS(L="Grupo 0", 0,
        L="Grupo 1", M/M42,    // score / group_total_score
        L="Grupo 2", M/M43,
        L="Grupo 3", M/M44,
        ...)
```

Score `M` comes from the Balanceamentos tab. It's normalized within the group to get ideal %.

### Contribution Formula (Column K)

```
K = IFS(L="Grupo 0", 0,
        L="Grupo 1", (E42*I - F) * N,   // (group_post_value * ideal% - current_value) * condition
        ...)
```

This calculates: "if this asset gets its ideal % of the group's post-contribution value, how much needs to be added?"

---

## Tab 3: FII (Real Estate Investment Trusts)

### Purpose
Manages 20 FIIs with real-time price fetching via GOOGLEFINANCE. Total value: **R$ 159,262.78**.

### Active FIIs

| # | Ticker | Setor | Qty | Price | Value | Score |
|---|--------|-------|-----|-------|-------|-------|
| 1 | BTLG11 | Logistica | 93 | 103.80 | 9,653.40 | -2 |
| 2 | XPLG11 | Logistica | 94 | 101.66 | 9,556.04 | -10 |
| 3 | HGLG11 | Logistica | 59 | 155.60 | 9,180.40 | 1 |
| 4 | GARE11 | Logistica | 1,057 | 8.36 | 8,836.52 | 0 |
| 5 | GGRC11 | Logistica | 909 | 10.18 | 9,253.62 | 0 |
| 6 | HGBS11 | Shopping | 460 | 20.23 | 9,305.80 | 0 |
| 7 | HSML11 | Shopping | 109 | 95.00 | 10,355.00 | 0 |
| 8 | HGRU11 | Varejo | 76 | 129.27 | 9,824.52 | 0 |
| 9 | SEQR11 | Varejo | 186 | 55.69 | 10,358.34 | 0 |
| 10 | TRXF11 | Varejo | 90 | 91.76 | 8,258.40 | 0 |
| 11 | RZAT11 | Varejo | 120 | 90.06 | 10,807.20 | 0 |
| 12 | KNCR11 | Papel | 10 | 105.03 | 1,050.30 | 0 |
| 13 | KNSC11 | Papel | 224 | 8.88 | 1,989.12 | 0 |
| 14 | MXRF11 | Papel | 305 | 9.72 | 2,964.60 | 0 |
| 15 | PCIP11 | Papel | 62 | 85.50 | 5,301.00 | 0 |
| 16 | CPTI11 | Infra | 105 | 89.45 | 9,392.25 | 0 |
| 17 | JURO11 | Infra | 93 | 102.99 | 9,578.07 | 0 |
| 18 | RZTR11 | Agro | 101 | 95.26 | 9,621.26 | 0 |
| 19 | SNAG11 | Fiagro | 518 | 10.68 | 5,532.24 | 0 |
| 20 | SNEL11 | Energia | 990 | 8.53 | 8,444.70 | 0 |

### Sectors
Logistica, Shopping, Varejo (Retail), Papel (Paper/CRI), Infra, Agro, Fiagro, Energia

### Key Formulas

- **Price**: `=IFERROR(GOOGLEFINANCE(B2), fallback)` — real-time B3 prices with fallback
- **Ideal %**: `=K/K23` where K = score from Balanceamentos
- **Contribution condition**: `=IFS(M="Não",0, F/E24<H,1, F/E24>H,0)` — considers "Vou aportar?" (Will I invest?) flag
- **Contribution amount**: `=IF(L=1, E24*H-F, 0)` — fills deficit to ideal %

### "Vou aportar?" (Will I invest?) Column
A manual override — user can set "Sim"/"Não" per FII to include/exclude from rebalancing.

### Dividend Tracking
Columns R-S track last dividend per share (`Ultimos prov.`) and totals.

---

## Tab 4: Ações (Brazilian Stocks)

### Purpose
Manages **91 individual stocks** across 4 groups with real-time GOOGLEFINANCE pricing. Total value: **R$ 40,480.23**.

### Group Distribution

| Group | Target % | # Stocks | Total Score |
|-------|----------|----------|-------------|
| Grupo 1 | 60% | 26 | 210 |
| Grupo 2 | 20% | 24 | 148 |
| Grupo 3 | 15% | 19 | 125 |
| Grupo 4 | 5% | 14 | 78 |

### Scoring Normalization (Rows 103-106)

The system converts raw scores to ideal percentages per group:

```
H105 = L106 * B103 / H106
     = 100 * 0.6 / 210
     = 0.2857142857    (multiplier for Grupo 1)
```

Each asset's ideal % = `score * group_multiplier / 100`

For example, VALE3 with score=11 in Grupo 1:
```
Ideal % = 11 * 0.2857142857 / 100 = 0.03142857143 (3.14%)
```

### Active Stocks Sample (first 20)

| # | Ticker | Qty | Price | Value | Group | Score | Ideal % |
|---|--------|-----|-------|-------|-------|-------|---------|
| 1 | VALE3 | 54 | 77.13 | 4,165.02 | G1 | 11 | 3.14% |
| 2 | BBAS3 | 73 | 23.41 | 1,708.93 | G1 | 11 | 3.14% |
| 3 | PETR4 | 37 | 47.00 | 1,739.00 | G1 | 9 | 2.57% |
| 4 | CSMG3 | 11 | 54.20 | 596.20 | G3 | 5 | 0.60% |
| 5 | CMIG4 | 21 | 11.81 | 248.01 | G0 | - | 0% |
| 7 | ISAE3 | 14 | 32.61 | 456.54 | G2 | 9 | 1.22% |
| 9 | BBSE3 | 31 | 34.52 | 1,070.12 | G1 | 11 | 3.14% |
| 11 | ABCB4 | 15 | 25.82 | 387.30 | G2 | 7 | 0.95% |
| 16 | CMIG3 | 58 | 15.60 | 904.80 | G1 | 9 | 2.57% |
| 27 | ENGI3 | 62 | 12.54 | 777.48 | G1 | 9 | 2.57% |
| 38 | WEGE3 | 27 | 46.16 | 1,246.32 | G1 | 11 | 3.14% |
| 46 | POMO3 | 113 | 5.56 | 628.28 | G1 | 9 | 2.57% |
| 52 | FLRY3 | 56 | 15.34 | 859.04 | G1 | 9 | 2.57% |
| 54 | RDOR3 | 25 | 37.02 | 925.50 | G1 | 11 | 3.14% |
| 78 | ITSA3 | 75 | 13.40 | 1,005.00 | G1 | 9 | 2.57% |
| 80 | ITUB3 | 30 | 41.14 | 1,234.20 | G1 | 11 | 3.14% |
| 87 | PSSA3 | 21 | 47.65 | 1,000.65 | G1 | 11 | 3.14% |

### Grupo 0 — Excluded Assets
Assets in "Grupo 0" (CMIG4, ITSA4, UNIP6, TAEE11, SAPR4, KLBN4, etc.) are **excluded from rebalancing** — they receive 0% allocation and no contributions.

---

## Tab 5: Exterior (International Assets)

### Purpose
Manages **international assets (ETFs)** denominated in USD, with BRL conversion via GOOGLEFINANCE. Uses the same group-based scoring as RI, RV e RF.

### Active International Assets

| # | Ticker | Qty | Price (USD) | Value (USD) | BRL Equiv | Group |
|---|--------|-----|-------------|-------------|-----------|-------|
| 1 | QQQM | 0.953 | 608.38 | 579.79 | 3,051.94 | G1 |
| 2 | SCHD | 2.336 | 244.96 | 572.23 | 3,012.14 | G1 |
| 3 | AVUV | 21.74 | 30.58 | 664.75 | 3,499.17 | G1 |
| 4 | SCHY | 3.746 | 73.68 | 275.93 | 1,452.48 | G2 |
| 5 | VNQI | 3.669 | 91.12 | 334.32 | 1,759.82 | G2 |
| 6 | BNDX | 8.289 | 26.81 | 222.25 | 1,169.93 | G3 |
| 7 | IAGG | 4.077 | 26.70 | 108.83 | 572.87 | G3 |
| 10 | EIMI | 10.49 | 23.33 | 244.90 | 1,289.10 | G4 |
| 11 | VWO | 6.745 | 91.96 | 620.36 | 3,265.52 | G4 |
| 14 | VXUS | 9.276 | 39.23 | 363.74 | 1,914.69 | G5 |
| 15 | VEA | 10.905 | 51.22 | 558.35 | 2,939.09 | G5 |
| 19 | AVES | 8.756 | 22.95 | 200.90 | 1,057.54 | G5 |
| 20 | EWZ | 5.758 | 42.86 | 246.79 | 1,299.07 | G5 |

### Groups (from Distribuição de aporte)

| Group | Asset Category | Target % (of Exterior) |
|-------|---------------|----------------------|
| G1 | Ações US (US Stocks) | Linked to row 8 |
| G2 | REITs | Linked to row 9 |
| G3 | Renda fixa exterior | Linked to row 10 |
| G4 | Ações Europa | Linked to row 11 |
| G5 | Ações Asia | Linked to row 12 |

### Currency Handling
- Column C: `=F*I46` — converts USD value to BRL using exchange rate
- Cell I46: `=GOOGLEFINANCE("CURRENCY:USDBRL")` = 5.2639

---

## Tab 6: Balanceamentos (Scoring/Questionnaires)

### Purpose
The scoring engine. Contains **Yes/No questionnaires** whose results determine the "score" for each asset. The score flows into the asset tabs as the `M` column (for RI/RV/RF and Exterior) or `K` column (for Ações).

### Structure

The tab is organized as a matrix:
- **Rows 1-14**: Questions (Yes/No criteria)
- **Row 15**: Total score per asset
- **Columns C onwards**: One column per asset

For **FIIs** (columns C-W, ~21 columns):
- Each column represents one FII (BTLG11, XPLG11, etc.)
- Rows contain Yes=1/No=-1 answers
- Row 15: `=SUM(C1:C14)` — total score
- Scores can be negative (e.g., BTLG11 = -2, XPLG11 = -10)

For **Ações** (columns C-CI+, ~90 columns starting at row ~23):
- Same structure as FIIs but for stocks
- Row 37: Total score per stock
- Scores are typically positive odd numbers: 1, 3, 5, 7, 9, 11

### Score Values Observed

| Score | Meaning | Count (Ações) |
|-------|---------|---------------|
| 0 | Excluded (Grupo 0) | ~10 |
| 1 | Minimal allocation | 5 |
| 3 | Low allocation | 12 |
| 5 | Below average | 18 |
| 7 | Average | 25 |
| 9 | Above average | 22 |
| 11 | Maximum allocation | 15 |

### Score Interpretation

Given that scores are odd numbers from 1-11, the questionnaire likely has **11 questions**:
- Each answer: Yes = +1, No = 0 (or vice versa)
- Total score = number of "Yes" answers
- For FIIs, scores can be negative, suggesting Yes = +1, No = -1

### Score → Ideal % Conversion

The score is normalized within each group:

```
ideal_% = score * (group_target_% / total_group_score)
```

Example for VALE3 (Grupo 1, score=11):
```
group_multiplier = 100 * 0.60 / 210 = 0.2857
ideal_% = 11 * 0.2857 / 100 = 3.14%
```

---

## Complete Rebalancing Algorithm

### Step 1: L1 — Distribute Contribution Across Asset Types

```
INPUT: contribution = 12000, target_percentages[], current_values[]
total_after = sum(current_values) + contribution

FOR each asset_type:
  deficit = total_after * target% - current_value
  IF target% > current_value / total_after:
    condition = 1  (underweight)
  ELSE:
    condition = 0  (overweight — skip)

total_deficit = sum(deficits where condition=1)

FOR each underweight asset_type:
  adjusted_proportion = deficit / total_deficit
  contribution_amount = adjusted_proportion * contribution
```

### Step 2: L2 — Distribute Within Asset Type to Groups

Each asset type tab receives its contribution from Step 1. Within each tab:

```
FOR each group (G1-G5):
  group_contribution = from Step 1
  group_current_value = sum(assets in group)
  group_post_value = group_current_value + group_contribution
```

### Step 3: L3 — Distribute Within Group to Individual Assets

```
FOR each asset in group:
  score = from Balanceamentos tab
  ideal_% = score / total_group_score

  current_% = asset_value / group_post_value
  IF ideal_% > current_%:  (underweight)
    contribution = group_post_value * ideal_% - asset_value
  ELSE:
    contribution = 0  (overweight — skip)

// Normalize contributions among eligible assets
total_eligible_contribution = sum(contributions where > 0)
FOR each eligible asset:
  final_contribution = (contribution / total_eligible_contribution) * group_contribution
```

### Step 4: Unit Calculation

For stocks/FIIs with discrete units:
```
units_to_buy = FLOOR(final_contribution / current_price)
```

---

## API Dependencies

| API | Usage | Assets |
|-----|-------|--------|
| GOOGLEFINANCE(ticker) | Real-time B3 stock prices | 91 stocks |
| GOOGLEFINANCE("BVMF:ticker") | B3 prices (alternative format) | ~15 tickers |
| GOOGLEFINANCE("CURRENCY:USDBRL") | USD/BRL exchange rate | 1 |
| GOOGLEFINANCE("CURRENCY:BTCBRL") | BTC/BRL price | 1 |
| GOOGLEFINANCE("CURRENCY:BTCUSD") | BTC/USD price | 1 |
| GOOGLEFINANCE(us_ticker) | US stock/ETF prices | 20 ETFs |

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│              Balanceamentos (Scoring Tab)                │
│  Questions → Yes/No → Score per asset                   │
│  FII scores (row 15) | Ação scores (row 37)             │
└──────────┬────────────────────────┬─────────────────────┘
           │                        │
           ▼                        ▼
┌──────────────────┐    ┌──────────────────┐
│   FII Tab        │    │   Ações Tab       │
│   Score → K col  │    │   Score → K col   │
│   Ideal% → H col │    │   Ideal% → G col │
│   Total → F23    │    │   Total → E102    │
└────────┬─────────┘    └─────────┬────────┘
         │                         │
         ▼                         ▼
┌─────────────────────────────────────────────────────────┐
│         Distribuição de aporte (Central Panel)           │
│                                                          │
│  Input: Contribution Amount (R$ 12,000)                  │
│                                                          │
│  Current values from each tab:                           │
│    FII!F23, 'Ações'!E102, 'RI, RV e RF'!F42-F46,       │
│    Exterior!H42-H46                                      │
│                                                          │
│  Output: Contribution per asset type                     │
│    → H column (cascading waterfall)                      │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│  RI, RV e RF Tab        │     │  Exterior Tab           │
│  3 groups (G1-G3)       │     │  5 groups (G1-G5)       │
│  Score-based allocation │     │  Score-based allocation  │
│  GOOGLEFINANCE prices   │     │  GOOGLEFINANCE prices    │
│  BTC via BTCBRL         │     │  USD/BRL conversion      │
└─────────────────────────┘     └─────────────────────────┘
```

---

## Key Observations

1. **GOOGLEFINANCE dependency**: The entire system relies on Google Sheets' GOOGLEFINANCE function for real-time data. This is the primary challenge for web migration.

2. **Grupo 0 exclusion**: Assets can be "parked" in Grupo 0 (score=0) to exclude them from rebalancing without removing them.

3. **Negative scores in FIIs**: The FII scoring allows negative scores (-2, -10), meaning the questionnaire uses +1/-1 scoring, and assets with net negative answers get excluded.

4. **"Vou aportar?" override**: FIIs have a manual "Yes/No" column that overrides the scoring system — even if the score suggests investment, the user can manually exclude an FII.

5. **Cascading waterfall**: The contribution distribution in Tab 1 uses a cascading priority system, not simple proportional allocation. The first eligible type gets served first, with remaining amount flowing to the next.

6. **91 active stock positions**: This is a heavily diversified portfolio with small positions across many stocks, grouped into 4 tiers by conviction level.

7. **Currency hedging**: The Exterior tab handles USD/BRL conversion and tracks both USD values and BRL equivalents. The system also handles a USD cash balance separately.
