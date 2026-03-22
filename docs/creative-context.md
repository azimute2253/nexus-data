# Context for Creative Document — Nexus Data

## What This Project Is

A web application to replace a complex Google Sheets portfolio rebalancing system for a Brazilian investor. The spreadsheet has 6 tabs, 2000+ formulas, manages ~R$243K in domestic assets + ~USD 12K international, covering 91 stocks, 20 FIIs, international ETFs, fixed income, and crypto.

## Core Problem

The investor uses Google Sheets with GOOGLEFINANCE for real-time pricing and a 3-level hierarchical rebalancing algorithm. It works but is fragile (GOOGLEFINANCE breaks), hard to maintain (2000+ formulas), not mobile-friendly, and can't track history.

## Key Features the Spreadsheet Already Does

1. **L1 — Asset Type Allocation**: 10 asset classes with target percentages, cascading waterfall contribution distribution
2. **L2 — Group Allocation**: Within each asset type, assets are grouped (Grupo 1-5) with target percentages
3. **L3 — Individual Asset Allocation**: Score-based allocation using Yes/No questionnaires (Balanceamentos tab)
4. **Real-time Pricing**: GOOGLEFINANCE for B3 stocks, FIIs, US ETFs, crypto, forex
5. **Rebalancing Calculator**: Input contribution amount → auto-distributes across all assets
6. **Manual Overrides**: "Vou aportar?" flag, Grupo 0 exclusion
7. **Dividend Tracking**: Last dividend per FII

## Current Portfolio

- **Total**: ~R$ 243K domestic + ~USD 12K international = ~R$ 319K combined
- **10 Asset Classes**: Reserva de investimento (5%), Reserva de valor (5%), Renda fixa BR (10%), FIIs (15%), Ações BR (35%), Ações US (10%), REITs (5%), Renda fixa exterior (5%), Ações Europa (5%), Ações Asia (5%)
- **FIIs massively overweight**: 65% vs 15% target → no new contributions
- **91 stocks** across 4 groups by conviction level
- **20 FIIs** across 8 sectors
- **~20 international ETFs** across 5 groups

## Proposed Tech Stack (from architecture doc)

- **Frontend**: Astro 6 + React islands
- **Backend**: Supabase (Postgres + RLS)
- **Auth**: Supabase Auth
- **Prices**: brapi.dev (B3), Yahoo Finance (US), exchangerate-api.com
- **Charts**: Recharts or Chart.js
- **Styling**: Tailwind CSS
- **Deploy**: Vercel
- **Cost**: R$ 0/month (free tiers)

## Database Design

Full schema with: asset_types, asset_groups, assets, price_cache, questionnaires, asset_scores, contributions, exchange_rates. All with RLS.

## UI Pages Designed

1. Central Dashboard — portfolio overview, pie charts, contribution calculator
2. Asset Type Page — groups within type
3. Group Detail — individual assets with scores, prices, buy suggestions
4. Questionnaire Editor — create/edit scoring criteria
5. Asset Scoring Modal — score individual assets

## The Rebalancing Algorithm

3-level cascading waterfall:
1. Distribute contribution across 10 asset types by deficit
2. Within each type, distribute across groups by target %
3. Within each group, distribute to individual assets by score-based ideal %

Overweight items get zero. Underweight items share proportionally to their deficit.

## Live Spreadsheet Data (fetched now)

Portfolio total: R$ 242,338.83
Contribution: R$ 12,000
After contribution: R$ 254,338.83

Current allocation vs target:
- FIIs: 65.62% (target 15%) — OVERWEIGHT, no contribution
- Ações BR: 16.43% (target 35%) — receives R$ 4,444
- Ações US: 3.93% (target 10%) — receives R$ 1,438
- Renda fixa BR: 5.32% (target 10%) — receives R$ 1,132
- All others underweight, receiving proportional contributions

## User Profile

- Brazilian physician, investor
- Single user (personal tool, not SaaS)
- Wants: simplicity, performance, mobile-friendly
- Currently manages everything in Google Sheets
- Budget: zero (free tiers only)

## What the Creative Must Cover

1. Vision and tagline
2. Problem statement (why replace the spreadsheet)
3. Target user and use cases
4. Core features (MVP scope)
5. Future features (phases 2-3)
6. Technical constraints and decisions
7. Success criteria
8. Non-goals (what this is NOT)
