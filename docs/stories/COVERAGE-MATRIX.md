# Coverage Matrix — PRD Features → User Stories

> Maps every P0 PRD feature to at least one user story. Ensures 100% coverage.
> Generated: 2026-03-22 by @sm (River)

---

## Feature → Story Mapping

| Feature | Description | Priority | Stories | Coverage |
|---------|------------|----------|---------|----------|
| **F-001** | Dashboard Central | P0 | 5.1 (data layer + total value), 5.2 (allocation table), 5.3 (pizza chart), 5.4 (deviation indicators) | **Full** — AC1→5.1, AC2→5.2, AC3→5.3, AC4→5.4, AC5→5.4+8.1 |
| **F-002** | Calculadora de Rebalanceamento | P0 | 4.1 (L1), 4.2 (L2), 4.3 (L3), 4.4 (orchestrator + parity), 5.5 (calculator UI) | **Full** — AC1→5.5, AC2→5.5+4.4, AC3→4.1, AC4→4.2, AC5→4.3, AC6→5.5, AC7→4.4, AC8→4.1 |
| **F-003** | CRUD Tipos de Ativo | P0 | 6.1 (asset type CRUD) | **Full** — AC1→6.1, AC2→6.1, AC3→6.1, AC4→6.1 |
| **F-004** | CRUD Grupos | P0 | 6.2 (group CRUD) | **Full** — AC1→6.2, AC2→6.2, AC3→6.2, AC4→6.2 |
| **F-005** | CRUD Ativos Individuais | P0 | 6.3 (asset CRUD), 6.4 (flags) | **Full** — AC1→6.3, AC2→6.3, AC3→6.4, AC4→6.4, AC5→6.3, AC6→6.3 |
| **F-006** | Questionarios de Scoring | P0 | 7.1 (editor), 7.2 (scoring modal), 7.3 (normalization) | **Full** — AC1→7.1, AC2→7.1, AC3→7.1, AC4→7.2, AC5→7.3, AC6→7.2, AC7→7.2 |
| **F-007** | Cotacoes em Tempo Real | P0 | 3.1 (brapi), 3.2 (yahoo), 3.3 (exchange), 3.4 (cron), 3.5 (manual refresh), 9.3 (staleness UI) | **Full** — AC1→3.1, AC2→3.2, AC3→3.3, AC4→3.4, AC5→3.5, AC6→9.3, AC7→3.4 |
| **F-008** | Login e Seguranca | P0 | 1.2 (RLS), 1.3 (auth integration) | **Full** — AC1→1.3, AC2→1.2, AC3→1.3, AC4→1.3 |
| **F-009** | Interface Mobile-First | P0 | 8.1 (card layout), 8.2 (2-tap flow), 8.3 (tab navigation) | **Full** — AC1→8.1, AC2→8.2, AC3→8.1, AC4→8.3 |
| **F-010** | Importacao do Google Sheets | P0 | 2.1 (CSV parser), 2.2 (migration script), 2.3 (parity validation) | **Full** — AC1→2.1, AC2→2.1, AC3→2.2, AC4→2.2, AC5→2.3 |
| **F-011** | Estrutura de Rotas e Integracao | P0 | 9.1 (routes + navigation), 9.2 (layout integration), 9.3 (feature flag) | **Full** — AC1→9.1, AC2→9.1, AC3→9.1, AC4→9.2 |

---

## PRD Goals → Story Mapping

| Goal | Objective | Primary Stories |
|------|-----------|----------------|
| **G1** | Paridade de rebalanceamento | 4.1, 4.2, 4.3, 4.4, 2.3 |
| **G2** | Confiabilidade das cotacoes | 3.1, 3.2, 3.3, 3.4, 9.3 |
| **G3** | Usabilidade mobile | 8.1, 8.2, 8.3, 5.5 |
| **G4** | Gestao simplificada do portfolio | 6.1, 6.2, 6.3, 7.1, 7.2 |
| **G5** | Visibilidade de desvios | 5.2, 5.3, 5.4 |
| **G6** | Override centralizado | 6.4 |

---

## ADR → Story Mapping

| ADR | Title | Stories Referencing |
|-----|-------|-------------------|
| **ADR-001** | Integration Strategy | 1.3, 9.1, 9.2, 9.3 |
| **ADR-002** | Database | 1.1, 1.2, 6.1, 6.2, 6.3 |
| **ADR-003** | Quote/Price API | 3.1, 3.2, 3.3, 3.4 |
| **ADR-004** | Rebalancing Algorithm | 4.1, 4.2, 4.3, 4.4, 7.3 |
| **ADR-005** | Price Caching | 3.4, 3.5, 5.1, 9.3 |
| **ADR-006** | Frontend Architecture | 5.1, 5.2, 5.3, 5.5, 6.1, 6.3, 7.1, 7.2, 8.1, 8.3, 9.1 |
| **ADR-007** | Authentication/Security | 1.2, 1.3, 3.1, 3.3, 3.4 |
| **ADR-008** | Data Migration | 2.1, 2.2, 2.3 |

---

## Story Summary by Epic

| Epic | # Stories | Effort Total | Stories |
|------|-----------|-------------|---------|
| E1 — Foundation | 3 | M+S+S | 1.1, 1.2, 1.3 |
| E2 — Data Migration | 3 | S+M+S | 2.1, 2.2, 2.3 |
| E3 — Price Engine | 5 | S+M+XS+M+S | 3.1, 3.2, 3.3, 3.4, 3.5 |
| E4 — Rebalancing Algorithm | 4 | M+S+M+M | 4.1, 4.2, 4.3, 4.4 |
| E5 — Dashboard & Portfolio | 5 | M+S+S+S+M | 5.1, 5.2, 5.3, 5.4, 5.5 |
| E6 — Asset Management | 4 | S+S+M+S | 6.1, 6.2, 6.3, 6.4 |
| E7 — Scoring System | 3 | M+M+S | 7.1, 7.2, 7.3 |
| E8 — Mobile Responsiveness | 3 | M+S+S | 8.1, 8.2, 8.3 |
| E9 — Integration & Routes | 3 | M+S+S | 9.1, 9.2, 9.3 |
| **TOTAL** | **33** | | |

---

## Uncovered Features (P1/P2 — Out of Scope for MVP)

| Feature | Priority | Status |
|---------|----------|--------|
| F-012 Graficos Interativos | P1 | Not covered (Phase 2) |
| F-013 Simulador What-If | P1 | Not covered (Phase 2) |
| F-014 Tracker de Dividendos | P1 | Not covered (Phase 2) |
| F-015 Gauge de Alinhamento | P1 | Not covered (Phase 2) |
| F-016 Historico de Aportes | P2 | Not covered (Phase 3) |
| F-017 Evolucao Patrimonial | P2 | Not covered (Phase 3) |
| F-018 Projecao de Normalizacao | P2 | Not covered (Phase 3) |
| F-019 Alertas de Desvio | P2 | Not covered (Phase 3) |
| F-020 Exportacao de Dados | P2 | Not covered (Phase 3) |
| F-021 Performance Analytics | P2 | Not covered (Phase 3) |

**P0 Coverage: 11/11 features = 100%**
