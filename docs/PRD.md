# PRD — Nexus Data: Ferramenta de Rebalanceamento de Portfólio

## Metadata

| Campo | Valor |
|-------|-------|
| Autor | @pm (Morgan) |
| Creative Source | `docs/CREATIVE-nexus-data.md` |
| Status | Draft |
| Versao | 2.1 |
| Ultima atualizacao | 2026-03-22 |
| Projeto host | azimute-blog (azimute.cc) |

---

## 1. Executive Summary

Nexus Data é uma aplicação web pessoal de rebalanceamento de portfólio de investimentos, implementada como aba `/dashboard/portfolio` dentro da área de membros do site azimute.cc (azimute-blog). Substitui uma planilha Google Sheets com 2.000+ fórmulas encadeadas que gerencia ~R$ 243K em 131+ ativos distribuídos em 10 classes de ativo:

| # | Classe de Ativo | Target % |
|---|----------------|----------|
| 1 | Reserva de investimento | 5% |
| 2 | Reserva de valor | 5% |
| 3 | Renda fixa BR | 10% |
| 4 | FIIs | 15% |
| 5 | Ações BR | 35% |
| 6 | Ações US | 10% |
| 7 | REITs | 5% |
| 8 | Renda fixa exterior | 5% |
| 9 | Ações Europa | 5% |
| 10 | Ações Asia | 5% |

A planilha atual sofre de seis problemas concretos: (1) `GOOGLEFINANCE` falha silenciosamente retornando `#N/A` e invalidando toda a cascata de cálculos, (2) é inutilizável no celular (106 linhas × 15 colunas), (3) adicionar um ativo exige editar 3 abas diferentes, (4) não mantém nenhum histórico de aportes ou evolução patrimonial, (5) não projeta quanto tempo levará para normalizar classes overweight como FIIs (65% atual vs 15% target), e (6) o flag de exclusão de ativo do rebalanceamento ("Vou aportar?") existe apenas para FIIs — para demais classes exige gambiarras.

O Nexus Data resolve esses problemas com cotações de APIs confiáveis (brapi.dev, Yahoo Finance), interface responsiva mobile-first otimizada para o fluxo "digitar aporte → ver lista de compras", CRUD unificado de ativos com flags universais de exclusão, e o mesmo algoritmo de rebalanceamento em cascata de 3 níveis (L1 tipo → L2 grupo → L3 ativo) implementado em TypeScript testável.

---

## 2. Goals & Objectives

| Goal | Objective | Metric |
|------|-----------|--------|
| G1: Eliminar dependência da planilha Google Sheets | O1: Replicar 100% da lógica de rebalanceamento em TypeScript | Paridade: dado aporte de R$ 12.000 e mesmos preços, resultado idêntico à planilha (tolerância < R$ 1/ativo) |
| G2: Confiabilidade das cotações | O2: Obter preços de todos os 131+ ativos via APIs dedicadas (brapi, Yahoo Finance, exchangerate-api) | 100% dos ativos com preço atualizado sem `#N/A`; fallback visual com último preço + timestamp quando API falha |
| G3: Usabilidade mobile | O3: Implementar interface responsiva mobile-first com fluxo em 2 toques | Fluxo "digitar aporte → ver lista de compras" completável em tela de celular sem scroll horizontal |
| G4: Gestão simplificada do portfólio | O4: Construir CRUD unificado de tipos, grupos, ativos e questionários | Adicionar um novo ativo requer uma única tela em vez de editar 3 abas separadas |
| G5: Visibilidade de desvios de alocação | O5: Dashboard com alocação atual vs. target por classe de ativo | Desvios (ex: FIIs 65% vs 15% target) visíveis imediatamente ao abrir o app |
| G6: Centralizar override de exclusão | O6: Flags universais `is_active` e `manual_override` para todos os ativos | 100% dos 10 tipos de ativo suportam flags `is_active` e `manual_override` sem workarounds (baseline: apenas FIIs têm flag nativo) |

---

## 3. Features

### Módulo 1 — Dashboard e Visão do Portfólio

#### F-001: Dashboard Central
- **Prioridade:** P0
- **Origem no Creative:** Seção "Funcionalidades Core (MVP)" → "1. Dashboard Central — Visão do Portfólio"
- **Descrição:** Tela principal que exibe o valor total do portfólio consolidado em BRL (doméstico + internacional convertido via câmbio), tabela das 10 classes de ativos com target %, atual %, valor atual e status (overweight/underweight), gráfico de pizza comparando alocação atual vs. target, e indicadores visuais de desvio (barra vermelha para classes overweight como FIIs 65% vs 15%).
- **Acceptance Criteria:**
  - [ ] AC1: Valor total do portfólio exibido em BRL, consolidando ativos domésticos e internacionais com conversão de câmbio atualizada
  - [ ] AC2: Tabela lista as 10 classes de ativos com colunas: nome, target %, atual %, valor (BRL), status (overweight/underweight)
  - [ ] AC3: Gráfico de pizza renderiza alocação atual vs. target side-by-side
  - [ ] AC4: Classes com desvio significativo exibem indicador visual proporcional (ex: barra vermelha para FIIs +50pp)
  - [ ] AC5: No mobile, valor total e top holdings são visíveis sem scroll

---

### Módulo 2 — Motor de Rebalanceamento

#### F-002: Calculadora de Rebalanceamento com Cascata L1→L2→L3
- **Prioridade:** P0
- **Origem no Creative:** Seção "Funcionalidades Core (MVP)" → "2. Calculadora de Rebalanceamento"
- **Descrição:** Campo de input para valor do aporte (default R$ 12.000), botão "Calcular" que executa o algoritmo de cascata de 3 níveis. L1 distribui entre tipos de ativo, L2 distribui dentro de cada tipo entre grupos, L3 distribui dentro de cada grupo entre ativos individuais. O resultado é exibido hierarquicamente com expandir/colapsar. Classes overweight (ex: FIIs) recebem R$ 0. Cálculo usa FLOOR para ações/FIIs (unidades inteiras) e fracionário para ETFs internacionais.
- **Acceptance Criteria:**
  - [ ] AC1: Campo de input aceita valor numérico do aporte com default de R$ 12.000
  - [ ] AC2: Botão "Calcular" executa o algoritmo e exibe resultado hierárquico L1→L2→L3
  - [ ] AC3: L1 distribui corretamente entre os 10 tipos de ativo com base nos targets e valores atuais
  - [ ] AC4: L2 distribui dentro de cada tipo entre os grupos conforme targets de grupo
  - [ ] AC5: L3 calcula cotas individuais por ativo: FLOOR para ações/FIIs, fracionário para ETFs internacionais
  - [ ] AC6: Resultado exibe por ativo: ticker, quantidade de cotas a comprar, valor estimado (ex: "VALE3 — 2 cotas — R$ 154,26")
  - [ ] AC7: Dado aporte de R$ 12.000 e mesmos preços da planilha, distribuição é idêntica (tolerância < R$ 1/ativo)
  - [ ] AC8: Classes overweight recebem R$ 0 de aporte

---

### Módulo 3 — Gestão do Portfólio

#### F-003: CRUD de Tipos de Ativo
- **Prioridade:** P0
- **Origem no Creative:** Seção "Funcionalidades Core (MVP)" → "3. CRUD de Portfólio" → "Tipos de ativo"
- **Descrição:** Interface para gerenciar as 10 classes de ativo (Ações BR, FIIs, RF, etc.). Permite criar novo tipo, editar target %, e reordenar.
- **Acceptance Criteria:**
  - [ ] AC1: Lista os 10 tipos de ativo com respectivos target %
  - [ ] AC2: Editar target % de um tipo e salvar reflete imediatamente no cálculo de rebalanceamento
  - [ ] AC3: Criar novo tipo de ativo com nome e target %
  - [ ] AC4: Reordenar tipos de ativo via interface

#### F-004: CRUD de Grupos
- **Prioridade:** P0
- **Origem no Creative:** Seção "Funcionalidades Core (MVP)" → "3. CRUD de Portfólio" → "Grupos"
- **Descrição:** Dentro de cada tipo de ativo, interface para gerenciar grupos. Permite criar grupo, editar target % do grupo, e definir método de scoring.
- **Acceptance Criteria:**
  - [ ] AC1: Listar grupos de um tipo de ativo com target % do grupo
  - [ ] AC2: Criar novo grupo dentro de um tipo
  - [ ] AC3: Editar target % e método de scoring de um grupo
  - [ ] AC4: Soma dos target % dos grupos dentro de um tipo deve totalizar 100%

#### F-005: CRUD de Ativos Individuais
- **Prioridade:** P0
- **Origem no Creative:** Seção "Funcionalidades Core (MVP)" → "3. CRUD de Portfólio" → "Ativos individuais"
- **Descrição:** Interface para gerenciar os 131+ ativos. Campos: ticker, setor, quantidade, grupo, fonte de preço (brapi/yahoo/manual/crypto). Inclui flags `is_active` (exclui do rebalanceamento sem deletar — substitui o "Grupo 0" da planilha) e `manual_override` (exclui temporariamente — substitui o "Vou aportar? Não" dos FIIs).
- **Acceptance Criteria:**
  - [ ] AC1: Adicionar ativo com: ticker, setor, quantidade, grupo, fonte de preço
  - [ ] AC2: Editar qualquer campo de um ativo existente
  - [ ] AC3: Flag `is_active` = false exclui o ativo do rebalanceamento sem removê-lo do banco
  - [ ] AC4: Flag `manual_override` = true exclui o ativo temporariamente do rebalanceamento (equivalente ao "Vou aportar? Não")
  - [ ] AC5: Suporte a 131+ ativos sem degradação perceptível de performance
  - [ ] AC6: Fonte de preço selecionável entre brapi, yahoo, manual, crypto

---

### Módulo 4 — Sistema de Scoring

#### F-006: Questionários de Scoring
- **Prioridade:** P0
- **Origem no Creative:** Seção "Funcionalidades Core (MVP)" → "4. Sistema de Scoring por Questionário"
- **Descrição:** Editor de questionários com perguntas Sim/Não com peso +1/-1. Questionários diferentes para FIIs, Ações e ETFs, replicando a lógica existente na aba "Balanceamentos" da planilha. Modal de scoring permite selecionar ativo, responder perguntas, e ver score calculado automaticamente. Score normalizado dentro do grupo determina o % ideal por ativo. Suporta scores negativos (ex: XPLG11 com -10 na planilha).
- **Acceptance Criteria:**
  - [ ] AC1: Criar questionário com lista de perguntas Sim/Não e pesos (+1/-1)
  - [ ] AC2: Editar perguntas, pesos e ordem de um questionário existente
  - [ ] AC3: Questionários separados por tipo de ativo (FIIs, Ações, ETFs)
  - [ ] AC4: Modal de scoring: seleciona ativo → responde perguntas → score calculado automaticamente
  - [ ] AC5: Score normalizado dentro do grupo gera o % ideal por ativo
  - [ ] AC6: Scores negativos são suportados (ex: ativo com score -10)
  - [ ] AC7: Após pontuar um ativo, o rebalanceamento reflete a nova distribuição ideal

---

### Módulo 5 — Cotações

#### F-007: Cotações em Tempo Real via APIs
- **Prioridade:** P0
- **Origem no Creative:** Seção "Funcionalidades Core (MVP)" → "5. Cotações em Tempo Real"
- **Descrição:** Integração com APIs de preço: brapi.dev para ações e FIIs da B3 (batch de até 20 tickers/request), Yahoo Finance para ETFs internacionais, exchangerate-api.com para câmbio (USD/BRL, BTC/BRL). Cache de 5 minutos durante pregão e 1 hora fora do pregão. Botão "Atualizar preços" para refresh manual. Fallback visual quando API falha (exibe último preço + timestamp).
- **Acceptance Criteria:**
  - [ ] AC1: Ações e FIIs da B3 obtém cotação via brapi.dev em batches de até 20 tickers
  - [ ] AC2: ETFs internacionais obtém cotação via Yahoo Finance
  - [ ] AC3: Câmbio (USD/BRL, BTC/BRL) obtido via exchangerate-api.com
  - [ ] AC4: Cache com TTL de 5 minutos durante pregão e 1 hora fora do pregão
  - [ ] AC5: Botão "Atualizar preços" força refresh manual do cache
  - [ ] AC6: Quando API falha, exibe último preço disponível + timestamp + indicador visual de falha
  - [ ] AC7: Chaves de API são mantidas server-side (Edge Functions); client nunca acessa APIs de preço diretamente

---

### Módulo 6 — Autenticação

#### F-008: Login e Segurança
- **Prioridade:** P0
- **Origem no Creative:** Seção "Funcionalidades Core (MVP)" → "6. Autenticação"
- **Descrição:** Login via Supabase Auth com email/senha. Single-user, mas com Row Level Security (RLS) no banco para segurança. Sessão persistente para não exigir login a cada acesso.
- **Acceptance Criteria:**
  - [ ] AC1: Login via email/senha usando Supabase Auth
  - [ ] AC2: RLS ativo em todas as tabelas com policy `auth.uid()`
  - [ ] AC3: Sessão persistente — usuário não precisa logar a cada visita
  - [ ] AC4: Sem login, nenhum dado é acessível (todas as rotas protegidas)

---

### Módulo 7 — Responsividade

#### F-009: Interface Mobile-First
- **Prioridade:** P0
- **Origem no Creative:** Seção "Funcionalidades Core (MVP)" → "7. Responsividade Mobile"
- **Descrição:** Layout card-based no celular que colapsa tabelas. Fluxo otimizado: tela principal → digita aporte → vê lista de compras em 2 toques. Valor total e top holdings visíveis sem scroll. Navegação por tabs: Overview | Detalhes | Rebalancear.
- **Acceptance Criteria:**
  - [ ] AC1: Layout responsivo card-based em telas < 768px (tabelas colapsam em cards)
  - [ ] AC2: Fluxo de rebalanceamento completável em 2 toques no mobile
  - [ ] AC3: Valor total do portfólio e top holdings visíveis sem scroll no mobile
  - [ ] AC4: Navegação por tabs: Overview | Detalhes | Rebalancear

---

### Módulo 8 — Migração de Dados

#### F-010: Importação do Google Sheets
- **Prioridade:** P0
- **Origem no Creative:** Seção "Migração do Google Sheets"
- **Descrição:** Importação inicial dos dados do portfólio a partir da planilha Google Sheets (6 abas) via CSV, usando o script existente `scripts/fetch-sheet.mjs`. Mapeamento das abas para o schema relacional Supabase: Distribuição de aporte → `asset_types`, FII/Ações/RI/RV/RF/Exterior → `asset_groups` + `assets`, Balanceamentos → `questionnaires` + `asset_scores`. Parsing com PapaParse em formato brasileiro (R$ 1.234,56). Validação final comparando resultado de rebalanceamento Nexus Data vs planilha.
- **Acceptance Criteria:**
  - [ ] AC1: Script exporta dados das 6 abas da planilha via CSV público
  - [ ] AC2: Parser trata formato brasileiro (separador decimal vírgula, separador milhar ponto, símbolo R$)
  - [ ] AC3: Mapeamento das 6 abas para as 8 tabelas do schema Supabase está correto
  - [ ] AC4: Todos os 131+ ativos, 10 tipos, ~15 grupos, e scores migrados com sucesso
  - [ ] AC5: Resultado de rebalanceamento pós-migração é idêntico ao da planilha (tolerância < R$ 1/ativo)

---

### Módulo 9 — Navegação e Integração

#### F-011: Estrutura de Rotas e Integração com azimute-blog
- **Prioridade:** P0
- **Origem no Creative:** Seção "Navegação" + Seção "Solução" (integração com azimute.cc)
- **Descrição:** Estrutura de rotas hierárquica dentro do azimute-blog, refletindo os 3 níveis do portfólio. O Nexus Data é implementado como aba da área de membros existente, reutilizando auth, layout e infra do site.
- **Rotas:**
  - `/dashboard/portfolio` → Dashboard central (L1)
  - `/dashboard/assets/[type]` → Tipo de ativo com grupos (L2)
  - `/dashboard/assets/[type]/[group]` → Grupo com ativos individuais (L3)
  - `/dashboard/questionnaires` → Lista de questionários
  - `/dashboard/questionnaires/[id]` → Editor de questionário
- **Acceptance Criteria:**
  - [ ] AC1: Cada rota renderiza o conteúdo correto conforme hierarquia L1→L2→L3
  - [ ] AC2: Navegação entre níveis é fluida com breadcrumbs ou back navigation
  - [ ] AC3: URLs são deep-linkable (acessar URL direto carrega o conteúdo correto)
  - [ ] AC4: Integração visual com layout e navegação existente do azimute-blog

---

### Módulo 10 — Funcionalidades Futuras (Fase 2)

#### F-012: Gráficos Interativos
- **Prioridade:** P1
- **Origem no Creative:** Seção "Funcionalidades Futuras" → "Fase 2 — Visualizações e Análise"
- **Descrição:** Gráficos interativos incluindo donut por setor (FIIs), barras horizontais de rebalanceamento, e heatmap de alocação.
- **Acceptance Criteria:**
  - [ ] AC1: Gráfico donut por setor para FIIs
  - [ ] AC2: Barras horizontais mostrando distribuição de rebalanceamento
  - [ ] AC3: Heatmap de alocação por classe de ativo

#### F-013: Simulador What-If
- **Prioridade:** P1
- **Origem no Creative:** Seção "Funcionalidades Futuras" → "Fase 2 — Visualizações e Análise"
- **Descrição:** Slider de contribuição com atualização em tempo real da distribuição projetada.
- **Acceptance Criteria:**
  - [ ] AC1: Slider permite ajustar valor de contribuição de R$ 0 a R$ 50.000
  - [ ] AC2: Distribuição hierárquica (L1→L2→L3) atualiza em tempo real conforme slider muda
  - [ ] AC3: Resultado visual mostra impacto na alocação pós-aporte

#### F-014: Tracker de Dividendos
- **Prioridade:** P1
- **Origem no Creative:** Seção "Funcionalidades Futuras" → "Fase 2 — Visualizações e Análise"
- **Descrição:** Último provento por FII, yield estimado, renda mensal projetada.
- **Acceptance Criteria:**
  - [ ] AC1: Exibir último provento recebido por FII com data e valor
  - [ ] AC2: Calcular e exibir yield estimado anualizado por FII
  - [ ] AC3: Projetar renda mensal total de dividendos baseada nos yields atuais

#### F-015: Gauge de Alinhamento
- **Prioridade:** P1
- **Origem no Creative:** Seção "Funcionalidades Futuras" → "Fase 2 — Visualizações e Análise"
- **Descrição:** Indicador de 0-100% mostrando a aderência do portfólio aos targets definidos.
- **Acceptance Criteria:**
  - [ ] AC1: Gauge visual exibe % de aderência (0-100%) do portfólio aos targets
  - [ ] AC2: Valor atualiza após cada rebalanceamento ou mudança de preço

---

### Módulo 11 — Funcionalidades Futuras (Fase 3)

#### F-016: Histórico de Aportes
- **Prioridade:** P2
- **Origem no Creative:** Seção "Funcionalidades Futuras" → "Fase 3 — Histórico e Projeções"
- **Descrição:** Registro persistente de cada aporte com data, valor e distribuição aplicada. Rota: `/dashboard/contributions`.
- **Acceptance Criteria:**
  - [ ] AC1: Cada aporte registrado com data, valor total, e distribuição detalhada por ativo
  - [ ] AC2: Lista histórica de aportes acessível na rota `/dashboard/contributions`
  - [ ] AC3: Dados persistidos na tabela `contributions` do Supabase

#### F-017: Evolução Patrimonial
- **Prioridade:** P2
- **Origem no Creative:** Seção "Funcionalidades Futuras" → "Fase 3 — Histórico e Projeções"
- **Descrição:** Gráfico de evolução do valor total do portfólio ao longo do tempo.
- **Acceptance Criteria:**
  - [ ] AC1: Gráfico de linha mostra evolução do patrimônio total ao longo do tempo
  - [ ] AC2: Dados baseados em snapshots periódicos do valor do portfólio

#### F-018: Projeção de Normalização
- **Prioridade:** P2
- **Origem no Creative:** Seção "Funcionalidades Futuras" → "Fase 3 — Histórico e Projeções"
- **Descrição:** Projeção de quantos meses levará para normalizar classes overweight (ex: "FIIs volta ao target de 15% em X meses com aporte de R$ 12K/mês"). Resolve diretamente o problema #5 do Creative.
- **Acceptance Criteria:**
  - [ ] AC1: Dado o aporte mensal e alocação atual, calcula número de meses para normalizar cada classe overweight
  - [ ] AC2: Exibe projeção por classe de ativo (ex: "FIIs: ~18 meses para atingir 15%")
  - [ ] AC3: Recalcula automaticamente quando preços ou targets mudam

#### F-019: Alertas de Desvio
- **Prioridade:** P2
- **Origem no Creative:** Seção "Funcionalidades Futuras" → "Fase 3 — Histórico e Projeções"
- **Descrição:** Alerta visual in-app quando desvio de alocação de uma classe ultrapassa threshold configurável.
- **Acceptance Criteria:**
  - [ ] AC1: Threshold de desvio configurável por classe de ativo (em pontos percentuais)
  - [ ] AC2: Alerta visual in-app quando desvio excede o threshold

#### F-020: Exportação de Dados
- **Prioridade:** P2
- **Origem no Creative:** Seção "Funcionalidades Futuras" → "Fase 3 — Histórico e Projeções"
- **Descrição:** Exportação do portfólio em PDF e dos holdings em CSV.
- **Acceptance Criteria:**
  - [ ] AC1: Exportar visão geral do portfólio em formato PDF
  - [ ] AC2: Exportar lista de holdings em formato CSV com colunas: ticker, tipo, grupo, quantidade, preço, valor

#### F-021: Performance Analytics
- **Prioridade:** P2
- **Origem no Creative:** Seção "Funcionalidades Futuras" → "Fase 3 — Histórico e Projeções"
- **Descrição:** ROI por classe de ativo e rendimento comparado a benchmark.
- **Acceptance Criteria:**
  - [ ] AC1: Calcular e exibir ROI por classe de ativo com período selecionável
  - [ ] AC2: Comparar rendimento com benchmark (ex: CDI para RF, Ibovespa para Ações BR)

---

## 4. Success Metrics

| Metrica | Baseline | Target | Como Medir |
|---------|----------|--------|------------|
| Paridade de rebalanceamento com planilha | Planilha atual como referência | Diferença < R$ 1 por ativo dado mesmo aporte e mesmos preços | Teste automatizado: executar rebalanceamento no Nexus Data e na planilha com inputs idênticos; comparar resultado por ativo |
| Cobertura de cotações | 0% (dependência de GOOGLEFINANCE com ~5-10% de falha) | 100% dos 131+ ativos com preço atualizado via API | Query Supabase: `SELECT count(*) FILTER (WHERE price IS NOT NULL AND updated_at > now() - interval '24h') * 100.0 / count(*) FROM price_cache` — executar diariamente |
| Tempo do fluxo de aporte (mobile) | Inviável — planilha com 106 linhas × 15 colunas não funciona em tela de celular (scroll horizontal obrigatório, campos ilegíveis, impossível operar) | Fluxo "digitar aporte → ver lista de compras" em ≤ 2 toques | Teste manual: contar toques necessários partindo da tela inicial até visualizar lista completa |
| Tempo de carga do dashboard | ~8-12s (Google Sheets com 2.000+ fórmulas e GOOGLEFINANCE leva 8-12s para carregar e recalcular no desktop; no mobile é pior) | First Contentful Paint < 3s no 4G | Lighthouse: medir FCP com throttle Slow 4G |
| Passos para adicionar ativo | 3 operações em 3 abas distintas: (1) adicionar ativo na aba do tipo (FII/Ações/Exterior/RI,RV,RF), (2) criar coluna de scoring na aba Balanceamentos, (3) adicionar referência na aba Distribuição de aporte — total de 3 abas, ~12 edições de célula | 1 tela, ≤ 5 campos + scoring modal | Teste manual: contar telas/passos para adicionar um ativo novo completo (preencher campos + pontuar) |
| Taxa de falha de cotação | ~5-10% dos requests GOOGLEFINANCE retornam `#N/A` aleatoriamente (sistema atual sendo substituído) | < 1% dos requests retornam erro por dia | Edge Function error logging no Supabase: contabilizar respostas HTTP não-200 de brapi/Yahoo/exchangerate-api dividido pelo total de requests por dia; query: `SELECT count(*) FILTER (WHERE status != 'success') * 100.0 / count(*) FROM price_fetch_log WHERE created_at > now() - interval '24h'` |
| Cobertura de override centralizado | Apenas FIIs têm flag "Vou aportar?" (1 de 10 tipos); demais classes exigem gambiarra de Grupo 0 | 100% dos 10 tipos de ativo suportam flags `is_active` e `manual_override` por ativo, sem workarounds | Teste manual: para cada um dos 10 tipos, criar ativo de teste, alternar `is_active` e `manual_override`, e confirmar que o ativo é excluído/incluído no rebalanceamento |

---

## 5. Technical Constraints

### Stack Obrigatória

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Frontend | Astro 6 + React (islands) | Já usado no azimute-blog; SSR + hidratação parcial para performance |
| Backend/DB | Supabase (Postgres + RLS) | Auth integrado; free tier cobre single-user |
| Cotações BR | brapi.dev | Free: 15.000 req/mês (suficiente para ~120 tickers a cada 5min) |
| Cotações US | Yahoo Finance API | API não-oficial, sem limite prático |
| Câmbio | exchangerate-api.com | Free: 1.500 req/mês |
| Charts | Recharts | Leve, React-nativo, composable |
| Styling | Tailwind CSS | Já disponível no projeto |
| Deploy | Vercel | Free tier, integrado com Astro; mesmo deploy do azimute-blog (azimute.cc) |

### Restrições de Infraestrutura

- **Custo mensal: R$ 0** — todos os serviços devem operar em free tiers
- **Supabase free tier:** 500MB database, 1GB file storage, 50.000 auth users, 500.000 Edge Function invocations/mês
- **brapi.dev free tier:** 15.000 requests/mês
- **exchangerate-api.com free tier:** 1.500 requests/mês
- **Vercel free tier:** 100GB bandwidth, 6.000 minutes build/mês

### Limites de Performance

- **Dashboard FCP:** < 3 segundos em Slow 4G
- **Cálculo de rebalanceamento:** < 500ms para 131+ ativos
- **Refresh de cotações (Edge Function):** < 10 segundos para batch completo (~7 requests brapi + 1 Yahoo + 1 câmbio)
- **Database queries:** < 200ms para qualquer query individual (portfolio_summary view)

### Segurança

- RLS obrigatório em todas as tabelas com policy `auth.uid()`
- API keys mantidas server-side via Supabase Edge Functions — nunca expostas ao client
- Preços cacheados no banco (tabela `price_cache` com TTL); client nunca chama API de preço diretamente

### Decisões Arquiteturais

- **Integração no azimute-blog** — implementado como aba `/dashboard/portfolio` dentro da área de membros existente, reutilizando auth, layout e infra do site azimute.cc
- **Single-user only** — sem multi-tenancy, roles, planos pagos, billing
- **Algoritmo de rebalanceamento em TypeScript puro** — `lib/rebalance.ts`, compartilhado entre server e client, testável unitariamente
- **Sem execução de trades** — o app calcula; o investidor executa manualmente na corretora
- **Edge Functions para cron de preços** — refresh a cada 5min durante pregão B3 (10:00-17:00 BRT, dias úteis)

### Database Schema

8 tabelas + 1 view:

| Tabela | Função |
|--------|--------|
| `asset_types` | 10 classes de ativo com target % |
| `asset_groups` | Grupos dentro de cada tipo com target % |
| `assets` | Ativos individuais (131+) com ticker, setor, quantidade, flags |
| `price_cache` | Cache de cotações com TTL |
| `questionnaires` | Questionários de scoring por tipo de ativo |
| `asset_scores` | Respostas de scoring por ativo |
| `contributions` | Histórico de aportes (Fase 3) |
| `exchange_rates` | Cache de taxas de câmbio |
| `portfolio_summary` (view) | Agrega valor por tipo de ativo com preços do cache |

---

## 6. Dependencies

| Dependencia | Tipo | Status | Responsavel | Notas |
|-------------|------|--------|-------------|-------|
| azimute-blog (azimute.cc) | Interna (projeto host) | Confirmada | Luis / @dev | Nexus Data é aba dentro da área de membros; depende de layout, auth e infra existentes |
| Supabase (Postgres + Auth + Edge Functions) | Externa | Confirmada | Criar projeto no Supabase Dashboard | Instância pode ser a mesma já usada pelo azimute-blog |
| brapi.dev API key | Externa | Confirmada | Registrar em brapi.dev (free tier) | 15.000 req/mês; batch de até 20 tickers |
| Yahoo Finance API (não-oficial) | Externa | Pendente — validação até Fase 1 Sprint 1 | Validar disponibilidade e estabilidade | Sem SLA oficial — pode quebrar. **Mitigação:** (1) fallback para input manual de preço por ativo (`price_source = 'manual'` já previsto em F-005 AC6), (2) campo `last_manual_price` + `manual_price_date` na tabela `price_cache`. **Validação pré-MVP:** testar requisição para todos os ~20 ETFs internacionais (QQQM, SCHD, AVUV, SCHY, VNQI, BNDX, IAGG, EIMI, VWO, VXUS, VEA, AVES, EWZ, etc.) e confirmar retorno de preço válido; data-alvo de validação: antes do fim do Sprint 1 da Fase 1 |
| exchangerate-api.com API key | Externa | Confirmada | Registrar em exchangerate-api.com (free tier) | 1.500 req/mês; cache de 15 minutos mitiga o limite |
| Vercel account (deploy) | Externa | Confirmada | Conta existente do azimute-blog | Free tier compartilhado com azimute-blog |
| Google Sheets (dados de migração) | Externa | Confirmada | Planilha existente; script `fetch-sheet.mjs` funcional | Necessário apenas durante migração inicial |
| PapaParse (parsing CSV) | Interna (library) | Confirmada | npm package | Formato brasileiro: R$ 1.234,56 |
| Recharts (gráficos) | Interna (library) | Confirmada | npm package | Necessário a partir de F-001 (pizza chart) |
| Astro 6 + React | Interna (framework) | Confirmada | npm packages | Mesma versão do azimute-blog |
| Tailwind CSS | Interna (framework) | Confirmada | npm package | Já configurado no azimute-blog |

---

## 7. Milestones & Phases

### Fase 1: MVP — Paridade com Planilha

- **Features:** F-001, F-002, F-003, F-004, F-005, F-006, F-007, F-008, F-009, F-010, F-011
- **Acceptance Criteria:**
  - [ ] Dado aporte de R$ 12.000 e mesmos preços, resultado de rebalanceamento é idêntico à planilha (tolerância < R$ 1/ativo)
  - [ ] Todos os 131+ ativos com cotação atualizada via API (sem `#N/A`)
  - [ ] CRUD completo: adicionar, editar, desativar e pontuar qualquer ativo em uma única tela
  - [ ] Fluxo "digitar aporte → ver lista de compras" funciona em tela de celular em ≤ 2 toques
  - [ ] Todo o portfólio atual (10 tipos, ~15 grupos, 131+ ativos, scores) migrado e verificado
  - [ ] Login protege os dados; sem login nenhum dado é acessível
  - [ ] Deploy acessível como aba `/dashboard/portfolio` na área de membros de azimute.cc
- **Prioridade:** P0 — sem isso não lança

### Fase 2: Visualizações e Análise

- **Features:** F-012, F-013, F-014, F-015
- **Acceptance Criteria:**
  - [ ] Gráficos interativos (donut por setor, barras de rebalanceamento, heatmap) renderizam corretamente com dados reais
  - [ ] Simulador what-if atualiza distribuição em tempo real ao mover slider
  - [ ] Tracker de dividendos exibe último provento, yield estimado, e renda mensal projetada para FIIs
  - [ ] Gauge de alinhamento mostra % de aderência do portfólio (0-100%)
- **Pré-requisito:** Fase 1 completa e estável
- **Prioridade:** P1

### Fase 3: Histórico e Projeções

- **Features:** F-016, F-017, F-018, F-019, F-020, F-021
- **Acceptance Criteria:**
  - [ ] Aportes registrados com data, valor e distribuição; histórico acessível em `/dashboard/contributions`
  - [ ] Evolução patrimonial visualizada em gráfico de linha com dados reais
  - [ ] Projeção calcula meses para normalizar classes overweight (ex: FIIs 65% → 15%)
  - [ ] Alertas visuais in-app disparam quando desvio ultrapassa threshold configurável
  - [ ] Exportação do portfólio em PDF e holdings em CSV funcional
  - [ ] Performance analytics exibe ROI por classe e comparação com benchmark
- **Pré-requisito:** Fase 2 completa
- **Prioridade:** P2

---

## 8. Out of Scope

| Item | Motivo | Backlog? |
|------|--------|----------|
| Execução de trades / conexão com corretoras | Nexus Data é ferramenta de cálculo, não plataforma de trading | Não |
| Planilha genérica (células, fórmulas editáveis) | Produto é específico para rebalanceamento, não é spreadsheet app | Não |
| Multi-tenancy / cadastro público / SaaS | Ferramenta pessoal, single-user | Não |
| Análise fundamentalista (P/L, EV/EBITDA, valuation) | Fora do escopo — usa apenas scoring Sim/Não | Não |
| Sugestão de ativos / IA / backtesting | Ferramenta de cálculo, não robô de investimento | Não |
| Notícias de mercado / alertas de preço / terminal Bloomberg | Ferramenta de rebalanceamento, não acompanhamento de mercado | Não |
| Compartilhamento / permissões / equipe | Single-user, sem colaboração | Não |
| App mobile nativo (iOS/Android) | Web responsiva é suficiente para o caso de uso | Não planejado |
| Integração com EHR / prontuário médico | Projetos separados (prontuario) | Não |
| Dark mode | Não mencionado no Creative | Não planejado |
| Notificações push / email / SMS | Não mencionado no Creative; alertas são visuais in-app (F-019, Fase 3) | Não |
| Multi-idioma / i18n | Single-user, interface em português | Não |

---

## Changelog

| Versao | Data | Autor | Alteracao |
|--------|------|-------|-----------|
| 1.0 | 2026-03-21 | @pm | Versão inicial |
| 2.0 | 2026-03-21 | @pm | PRD Mastery audit: adicionado G6 (override centralizado), explicitado integração com azimute-blog em F-011/milestones/deploy, adicionada seção de limites de performance, azimute-blog como dependência interna, expandido database schema, adicionado Changelog, melhorados ACs das features Fase 2/3 |
| 2.1 | 2026-03-22 | @pm | Audit 30/30: (1) removida referência contraditória a R$ 319K do changelog v2.0, (2) 10 classes de ativo listadas explicitamente no Executive Summary com targets, (3) métricas corrigidas — baselines concretas para todas (mobile: inviável; dashboard: ~8-12s Google Sheets; passos: 3 operações em 3 abas), (4) métodos de medição especificados com queries Supabase exatas (price_cache, price_fetch_log), (5) Yahoo Finance: adicionado plano de mitigação (fallback manual), lista de ETFs para validação, e data-alvo de validação, (6) adicionada métrica para G6 (cobertura de override centralizado) garantindo rastreabilidade Goal→Metric para todos os 6 Goals |
