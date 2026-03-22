# Waves — Planejamento de Entregas

Planejamento de 33 stories em 9 épicos distribuídas em 7 waves com máxima paralelização.

---

## 📊 Inventário: 33 Stories em 9 Epics

| Epic | Stories | Tema |
|------|---------|------|
| 1 — Foundation | 1.1 (M), 1.2 (S), 1.3 (S) | Schema Supabase, RLS, Auth |
| 2 — Migração | 2.1 (S), 2.2 (M), 2.3 (S) | CSV parser, script migração, validação paridade |
| 3 — Price Engine | 3.1 (S), 3.2 (M), 3.3 (XS), 3.4 (M), 3.5 (S), **3.6 (S)** | brapi, aggregator, câmbio, integration, manual refresh, auto-refresh on entry |
| 4 — Algoritmo | 4.1 (M), 4.2 (S), 4.3 (M), 4.4 (M) | L1→L2→L3 cascata + orquestrador + testes paridade |
| 5 — Dashboard | 5.1 (M), 5.2 (S), 5.3 (S), 5.4 (S), 5.5 (M) | Data layer, tabela, pizza chart, desvios, calculadora UI |
| 6 — CRUD | 6.1 (S), 6.2 (S), 6.3 (M), 6.4 (S) | Tipos, grupos, ativos, flags |
| 7 — Scoring | 7.1 (M), 7.2 (M), 7.3 (S) | Editor questionário, modal scoring, normalização |
| 8 — Mobile | 8.1 (M), 8.2 (S), 8.3 (S) | Layout cards, fluxo 2-toques, tabs |
| 9 — Integração | 9.1 (M), 9.2 (S), 9.3 (S) | Rotas, layout azimute-blog, feature flag |

**Sizing:** 12 Medium + 19 Small + 3 XS = ~40-50 dev-days total

---

## 🌊 Waves com Máxima Paralelização

### Wave 1 — Fundação (1 story, bloqueadora)

**1.1 Schema Supabase (M)** ✅ Completo

Tudo depende do schema. Sem paralelização.

---

### Wave 2 — 4 tracks paralelos ⚡

- **Track A:** 1.2 RLS (S) ✅ Completo
- **Track B:** 2.1 CSV Parser (S) ✅ Completo  
- **Track C:** 4.1 L1 Algorithm (M) ✅ Completo
- **Track D:** _(nada — espera RLS)_

**Status:** 100% completo

---

### Wave 3 — 5 tracks paralelos ⚡⚡

- **Track A:** 1.3 Auth (S) ✅ Completo
- **Track B:** 3.1 brapi adapter (S) + 3.3 câmbio (XS) ✅ Completo
- **Track C:** 4.2 L2 Algorithm (S) ✅ Completo
- **Track D:** 7.3 Score Normalization (S) ✅ Completo
- **Track E:** 2.2 Migration Script (M) ✅ Completo

**Status:** 100% completo

---

### Wave 4 — 5 tracks paralelos ⚡⚡

- **Track A:** 9.1 Rotas (M) ✅ Completo
- **Track B:** 3.2 Price Aggregator (M) → 3.4 Price Engine Integration (M) ✅ Completo
- **Track C:** 4.3 L3 Algorithm (M) ✅ Completo
- **Track D:** 9.2 Layout integration (S) ✅ Completo (11/12)
- **Track E:** 6.1 CRUD Types (S, antecipada da Wave 5) ✅ Completo

**Status:** 100% completo (9.2 com minor issue não-bloqueador)

---

### Wave 5 — 6 tracks paralelos ⚡⚡⚡

- **Track A:** 6.2 CRUD Groups (S) _(6.1 já completo)_
- **Track B:** 7.1 Questionnaire Editor (M)
- **Track C:** 5.1 Dashboard Data Layer (M)
- **Track D:** 4.4 Orchestrator + Parity Tests (M)
- **Track E:** 9.3 Feature Flag UI (S)
- **Track F:** 2.3 Parity Validation (S)

**Status:** Aguardando execução

---

### Wave 6 — 6 tracks paralelos ⚡⚡⚡

- **Track A:** 5.2 Allocation Table (S) + 5.4 Deviation Indicators (S)
- **Track B:** 5.3 Pizza Chart (S)
- **Track C:** 6.3 CRUD Assets (M) → 6.4 Flags (S)
- **Track D:** 5.5 Calculator UI (M)
- **Track E:** 7.2 Scoring Modal (M)
- **Track F:** 3.5 Manual Refresh (S) + **3.6 Auto-refresh on Entry (S)** ✨

**Status:** Aguardando execução

**Story 3.6 adicionada:** Auto-refresh on portfolio entry com cooldown configurável (default 4h). Documentada em ADR-005 addendum.

---

### Wave 7 — Final (Mobile + Polish)

- **Track A:** 8.1 Mobile Layout (M) → 8.2 Mobile Rebalance Flow (S)
- **Track B:** 8.3 Tab Navigation (S)

**Status:** Aguardando execução

---

## 🎯 Caminho Crítico

**1.1 → 1.2 → 3.1 → 3.2 → 3.4 → 5.1 → 5.5 → 8.2**

13 stories no longest path — qualquer atraso aqui atrasa tudo.

---

## 📈 Progresso

| Wave | Stories | Completo | Status |
|------|---------|----------|--------|
| Wave 1 | 1 | 1/1 | ✅ 100% |
| Wave 2 | 3 | 3/3 | ✅ 100% |
| Wave 3 | 5 | 5/5 | ✅ 100% |
| Wave 4 | 5 | 5/5 | ✅ 100% |
| Wave 5 | 6 | 0/6 | 🔜 Próxima |
| Wave 6 | 7 | 0/7 | ⏳ Aguardando |
| Wave 7 | 3 | 0/3 | ⏳ Aguardando |
| **Total** | **33** | **14/33** | **42% completo** |

**Última atualização:** 2026-03-22 19:20 BRT
