# PRD V2 — Nexus Data: Multi-Carteira, Onboarding e Nova Navegação

## Metadata

| Campo | Valor |
|-------|-------|
| Autor | @pm (Morgan) |
| Creative Source | `docs/CREATIVE-nexus-data-v2.md` |
| PRD Base | `docs/PRD.md` (V2.1) |
| Status | Draft |
| Versão | 1.0 |
| Última atualização | 2026-03-23 |
| Projeto host | azimute-blog (azimute.cc) |

---

## 1. Executive Summary

Este PRD cobre **exclusivamente o delta da V2** do Nexus Data — funcionalidades novas que não existiam no PRD V1 (docs/PRD.md). O PRD V1 permanece como referência para todas as features já definidas e implementadas (algoritmo L1→L2→L3, motor de preços, scoring por questionário, dashboard, CRUD de portfólio, migração de dados, auth, responsividade).

### O que muda na V2

| Dimensão | V1 (PRD.md) | V2 (este documento) |
|----------|-------------|---------------------|
| Escopo de dados | Single-user implícito (`user_id` direto nas tabelas) | **Multi-carteira**: tabela `wallets` como pivot entre usuário e dados |
| Onboarding | Inexistente — assume dados pré-migrados | **Fluxo de primeira carteira** para novos usuários |
| Navegação | Tabs Overview / Detalhes / Rebalancear | **Tabs Dashboard / Aportes / Ativos** |
| Nome no menu | "Portfolio" | **"Nexus Data"** |
| Peso por ativo | Apenas questionário (F-006 do PRD V1) | **Dual: manual (nota livre) OU questionário** (switch exclusivo) |
| Isolamento de dados | RLS por `user_id` apenas | RLS por `user_id` + filtro por `wallet_id` |

### O que NÃO muda

Todos os módulos já definidos no PRD V1 permanecem válidos — algoritmo de rebalanceamento, motor de preços, CRUD de tipos/grupos/ativos, scoring por questionário, auth, responsividade mobile-first, migração de dados. Este documento **não repete** essas definições.

---

## 2. Goals & Objectives

| Goal | Objective | Metric |
|------|-----------|--------|
| G7: Multi-carteira | O7: Usuário pode criar N carteiras independentes e alternar entre elas | 100% dos dados (tipos, grupos, ativos, scores, aportes) isolados por `wallet_id`; switching entre carteiras < 500ms |
| G8: Onboarding funcional | O8: Usuário sem carteira é guiado a criar a primeira antes de acessar qualquer funcionalidade | 100% dos novos usuários passam pelo onboarding; 0 erros de "tela vazia" sem dados |
| G9: Navegação intuitiva | O9: Tabs Dashboard/Aportes/Ativos organizam funcionalidades por intenção do usuário | Fluxo "digitar aporte → ver lista de compras" permanece ≤ 2 toques (tab Aportes → calcular) |
| G10: Peso dual | O10: Cada ativo pode usar nota manual OU questionário para determinar peso no L3 | 100% dos ativos suportam ambos os modos; switch é exclusivo (XOR) |
| G11: Identidade do produto | O11: Referências a "Portfolio" substituídas por "Nexus Data" em toda a interface | 0 ocorrências de "Portfolio" visíveis ao usuário final |

---

## 3. Features

### Módulo 11-B — Bug Fix Pré-Requisito

#### F-021B: Corrigir `/api/asset-types` (HTTP 500)

- **Prioridade:** P0 — bloqueante para todas as features de V1 e V2
- **Origem no Creative V2:** Seção "Bugs conhecidos a corrigir antes do MVP"
- **Descrição:** A rota `/api/asset-types` retorna HTTP 500 com `{"error":"new row violates row-level security policy for table \"asset_types\""}`. O endpoint está executando um `INSERT` onde deveria executar um `SELECT`. O RLS bloqueia corretamente o INSERT indevido. Corrigir a lógica da Edge Function para que `GET /api/asset-types` realize apenas SELECT e retorne os tipos de ativo do usuário autenticado.
- **Acceptance Criteria:**
  - [ ] AC1: `GET /api/asset-types` retorna HTTP 200 com lista de asset_types do usuário autenticado
  - [ ] AC2: A rota não realiza nenhum INSERT durante operação de leitura
  - [ ] AC3: Se o usuário não tiver asset_types cadastrados, retorna `[]` (lista vazia) com HTTP 200
  - [ ] AC4: O select de "Tipo de Ativo" no formulário de cadastro de ativo carrega as opções corretamente
  - [ ] AC5: Botão "Cadastrar Ativo" é habilitado quando todos os campos obrigatórios estão preenchidos

---

### Módulo 12 — Multi-Carteira (Wallets)

#### F-022: Tabela `wallets` e Isolamento de Dados

- **Prioridade:** P0
- **Origem no Creative V2:** Seção "Arquitetura de Dados — Novo Modelo"
- **Descrição:** Nova tabela `wallets` como entidade pivot entre o usuário e seus dados de portfólio. Todas as tabelas existentes (`asset_types`, `asset_groups`, `assets`, `questionnaires`, `asset_scores`, `contributions`) ganham coluna `wallet_id UUID REFERENCES wallets(id)`. RLS existente por `user_id` se mantém; queries adicionam filtro por `wallet_id` dentro do escopo do usuário autenticado.
- **Schema:**
  ```sql
  CREATE TABLE wallets (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id),
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ```
- **Migration Strategy:** Criar `wallets`, inserir carteira default para cada `user_id` existente, adicionar `wallet_id` às tabelas existentes com FK, backfill `wallet_id` com a carteira default, tornar `wallet_id NOT NULL`.
- **Acceptance Criteria:**
  - [ ] AC1: Tabela `wallets` criada com RLS policy `auth.uid() = user_id`
  - [ ] AC2: Coluna `wallet_id` adicionada a `asset_types`, `asset_groups`, `assets`, `questionnaires`, `asset_scores`, `contributions`
  - [ ] AC3: Migration backfill cria carteira default e popula `wallet_id` para todos os registros existentes sem perda de dados
  - [ ] AC4: Todas as queries do data layer (`lib/dashboard/data.ts`) filtram por `wallet_id` além de `user_id`
  - [ ] AC5: `price_cache` e `exchange_rates` NÃO recebem `wallet_id` (preços são globais, compartilhados entre carteiras)
  - [ ] AC6: Constraint UNIQUE atualizada onde necessário (ex: `assets.ticker` unique por `(ticker, wallet_id)` em vez de `(ticker, user_id)`)

#### F-023: Seletor de Carteiras

- **Prioridade:** P0
- **Origem no Creative V2:** Seção "Seletor de carteiras"
- **Descrição:** Dropdown no header do app que permite ao usuário alternar entre suas carteiras. Exibe o nome da carteira ativa. Se o usuário tem apenas 1 carteira, exibe o nome sem dropdown. Botão "Nova carteira" acessível a qualquer momento via seletor.
- **Acceptance Criteria:**
  - [ ] AC1: Dropdown lista todas as carteiras do usuário autenticado, ordenadas por `created_at`
  - [ ] AC2: Ao selecionar outra carteira, todos os dados da página (Dashboard, Aportes, Ativos) recarregam com dados da carteira selecionada
  - [ ] AC3: Carteira ativa é persistida em `localStorage` para manter seleção entre sessões
  - [ ] AC4: Se o usuário tem apenas 1 carteira, exibe nome como texto estático (sem dropdown)
  - [ ] AC5: Botão "Nova carteira" abre modal com campo de nome e botão "Criar"
  - [ ] AC6: Switching entre carteiras executa em < 500ms (latência percebida)

#### F-024: Criação e Gestão de Carteiras

- **Prioridade:** P0
- **Origem no Creative V2:** Seção "Seletor de carteiras" + "Tela de Onboarding"
- **Descrição:** API e UI para criar, renomear e deletar carteiras. Criação requer apenas nome. Deleção requer confirmação e remove todos os dados associados (cascade). Sem limite definido de carteiras por usuário — o Creative V2 não especifica restrição.
- **Acceptance Criteria:**
  - [ ] AC1: Criar carteira com nome (1-50 caracteres, não vazio)
  - [ ] AC2: Renomear carteira existente
  - [ ] AC3: Deletar carteira com confirmação ("Tem certeza? Todos os dados serão perdidos.")
  - [ ] AC4: Deleção em cascade remove todos os `asset_types`, `asset_groups`, `assets`, `questionnaires`, `asset_scores`, `contributions` associados
  - [ ] AC5: Sem limite de carteiras por usuário (não especificado no Creative V2)

---

### Módulo 13 — Onboarding

#### F-025: Fluxo de Onboarding (Primeira Carteira)

- **Prioridade:** P0
- **Origem no Creative V2:** Seção "Fluxo de entrada" + "Tela de Onboarding"
- **Descrição:** Quando o usuário acessa o Nexus Data e não tem nenhuma carteira cadastrada, é redirecionado para uma tela de onboarding com mensagem de boas-vindas e campo para nomear a primeira carteira. Após criar, redireciona para o Dashboard (vazio, sem dados). O fluxo deve ser amigável e sem fricção.
- **Wireframe:**
  ```
  ┌─────────────────────────────────────┐
  │ Bem-vindo ao Nexus Data             │
  │                                     │
  │ Você ainda não tem uma carteira.    │
  │ Vamos criar a primeira?             │
  │                                     │
  │  [Nome da carteira: ____________]   │
  │                                     │
  │       [Criar minha carteira]        │
  └─────────────────────────────────────┘
  ```
- **Acceptance Criteria:**
  - [ ] AC1: Ao acessar `/nexus` (ou rota equivalente) sem nenhuma carteira, exibe tela de onboarding em vez do Dashboard
  - [ ] AC2: Tela exibe mensagem de boas-vindas e campo de nome com placeholder
  - [ ] AC3: Botão "Criar minha carteira" cria a carteira no Supabase e redireciona para o Dashboard
  - [ ] AC4: Dashboard vazio exibe estado vazio amigável ("Comece adicionando suas classes de ativo na aba Ativos")
  - [ ] AC5: Em visitas subsequentes (carteira já existe), acessa direto o Dashboard sem passar pelo onboarding
  - [ ] AC6: Funciona em mobile sem scroll horizontal; campo e botão ocupam largura total da tela

---

### Módulo 14 — Nova Navegação (Tabs)

#### F-026: Tabs Dashboard / Aportes / Ativos

- **Prioridade:** P0
- **Origem no Creative V2:** Seção "Tabs internas do app"
- **Descrição:** Substituir as tabs V1 (Overview | Detalhes | Rebalancear) por três novas tabs organizadas por intenção: **Dashboard** (visão geral), **Aportes** (calcular e historar aportes), **Ativos** (configurar hierarquia e pesos). O componente `TabNavigation.tsx` existente deve ser atualizado.
- **Mapeamento V1 → V2:**
  | Tab V1 | Tab V2 | Conteúdo |
  |--------|--------|----------|
  | Overview | **Dashboard** | Valor total, tabela de alocação, gráfico, desvios, botão refresh |
  | Rebalancear | **Aportes** | Calculadora de rebalanceamento + histórico de aportes |
  | Detalhes | **Ativos** | Hierarquia classes→grupos→ativos, CRUD, pesos |
- **Acceptance Criteria:**
  - [ ] AC1: Tab "Dashboard" renderiza: valor total consolidado, tabela de alocação (AllocationTable), indicadores de desvio, botão "Atualizar preços", timestamp do último refresh
  - [ ] AC2: Tab "Aportes" renderiza: calculadora de rebalanceamento (RebalanceCalculator) com campo de input (default = último valor usado), botão "Calcular", resultado hierárquico L1→L2→L3
  - [ ] AC3: Tab "Ativos" renderiza: árvore hierárquica de classes → grupos → ativos com CRUD inline e pesos
  - [ ] AC4: Tab ativa é refletida na URL (ex: `/nexus?tab=aportes` ou via query param) para deep-linking
  - [ ] AC5: No mobile, tabs usam layout horizontal scrollável se necessário
  - [ ] AC6: Transição entre tabs é instantânea (dados em cache, sem re-fetch a cada switch)

#### F-027: Renomear "Portfolio" para "Nexus Data"

- **Prioridade:** P0
- **Origem no Creative V2:** Seção "Navegação e UX" → "Menu lateral"
- **Descrição:** Todas as referências visuais a "Portfolio" na interface devem ser substituídas por "Nexus Data". Isso inclui: item no menu lateral do azimute.cc, título da página/aba do browser, breadcrumbs, e qualquer texto visível ao usuário. Rotas internas podem manter slug técnico, mas o label exibido deve ser "Nexus Data".
- **Acceptance Criteria:**
  - [ ] AC1: Menu lateral do azimute.cc exibe "Nexus Data" em vez de "Portfolio"
  - [ ] AC2: Título da aba do browser (document.title) inclui "Nexus Data"
  - [ ] AC3: Breadcrumbs e headers de página exibem "Nexus Data"
  - [ ] AC4: 0 ocorrências de "Portfolio" visíveis ao usuário final em qualquer tela do app
  - [ ] AC5: URLs podem usar `/nexus` ou manter `/dashboard/portfolio` (decisão técnica delegada ao @architect) — o importante é o label visível

---

### Módulo 15 — Peso Dual (Manual vs. Questionário)

#### F-028: Sistema de Peso Dual por Ativo

- **Prioridade:** P0
- **Origem no Creative V2:** Seção "Sistema de Peso por Ativo — NOVO"
- **Descrição:** Cada ativo passa a ter um modo de cálculo de peso selecionável: **nota manual** (número livre na mesma escala da planilha original: -10 a +11) ou **questionário** (o sistema existente do PRD V1, F-006). Os modos são mutuamente exclusivos — um switch (radio ou toggle) determina qual valor o algoritmo L3 usa para normalizar o peso dentro do grupo.

  Nota: o sistema de questionário existente (F-006 do PRD V1) permanece inalterado. Esta feature adiciona o modo manual como alternativa e o mecanismo de switch entre os dois.

- **Schema Changes:**
  ```sql
  ALTER TABLE assets ADD COLUMN weight_mode TEXT NOT NULL DEFAULT 'questionnaire'
    CHECK (weight_mode IN ('manual', 'questionnaire'));
  ALTER TABLE assets ADD COLUMN manual_weight NUMERIC DEFAULT 0;
  CHECK (manual_weight >= -10 AND manual_weight <= 11) -- escala da planilha original
  ```
- **Acceptance Criteria:**
  - [ ] AC1: Coluna `weight_mode` adicionada à tabela `assets` com valores `'manual'` | `'questionnaire'`, default `'questionnaire'`
  - [ ] AC2: Coluna `manual_weight` adicionada à tabela `assets` com range -10 a +11 (escala da planilha original), default 0
  - [ ] AC3: UI do ativo exibe switch (radio buttons ou toggle) entre "Nota manual" e "Questionário"
  - [ ] AC4: Quando `weight_mode = 'manual'`: exibe campo numérico para nota manual; oculta questionário
  - [ ] AC5: Quando `weight_mode = 'questionnaire'`: exibe o scoring modal existente (ScoringModal.tsx); oculta campo manual
  - [ ] AC6: Algoritmo L3 (`distributeL3` em `lib/nexus/rebalance.ts`) usa `manual_weight` quando `weight_mode = 'manual'`, e `total_score` do `asset_scores` quando `weight_mode = 'questionnaire'`
  - [ ] AC7: Score normalizado dentro do grupo funciona corretamente com ativos mistos (alguns manual, outros questionário)
  - [ ] AC8: Migração preserva todos os scores existentes e define `weight_mode = 'questionnaire'` para todos os ativos atuais (backward-compatible)
  - [ ] AC9: Painel de peso do ativo exibe o peso calculado atual independentemente do modo

---

### Módulo 16 — Conteúdo das Tabs

#### F-029: Tab Dashboard — Conteúdo Detalhado

- **Prioridade:** P0
- **Origem no Creative V2:** Seção "Página: Dashboard"
- **Descrição:** Define o conteúdo completo da tab Dashboard, consolidando e estendendo o F-001 (Dashboard Central) do PRD V1. Reutiliza componentes existentes (AllocationTable, DeviationBar, PriceRefreshButton).
- **Conteúdo:**
  - Valor total consolidado em BRL (domésticos + internacionais convertidos via câmbio)
  - Tabela de classes de ativo: nome, target %, atual %, valor atual, desvio (overweight/underweight)
  - Gráfico de alocação: atual vs. target (reutiliza AllocationChart)
  - Indicadores visuais de desvio (vermelho = overweight, verde = alinhado, azul = underweight)
  - Botão "Atualizar preços" (reutiliza PriceRefreshButton)
  - Timestamp do último refresh
- **Acceptance Criteria:**
  - [ ] AC1: Todos os dados exibidos são filtrados pela `wallet_id` da carteira ativa
  - [ ] AC2: Valor total converte ativos internacionais via câmbio USD/BRL da tabela `exchange_rates`
  - [ ] AC3: Gráfico de alocação renderiza ao menos em formato pizza (atual vs. target)
  - [ ] AC4: Estado vazio exibe mensagem orientadora ("Comece adicionando classes de ativo na aba Ativos")

#### F-030: Tab Aportes — Conteúdo Detalhado

- **Prioridade:** P0
- **Origem no Creative V2:** Seção "Página: Aportes"
- **Descrição:** Define o conteúdo completo da tab Aportes, consolidando e estendendo o F-002 (Calculadora de Rebalanceamento) do PRD V1. Adiciona o campo default como último valor usado e integra histórico de aportes (quando disponível).
- **Conteúdo:**
  - Campo de input: valor do aporte (default = último valor usado, ou R$ 12.000 se primeiro uso)
  - Botão "Calcular"
  - Resultado hierárquico L1→L2→L3 (reutiliza RebalanceCalculator)
  - Seção "Histórico de aportes": lista dos últimos aportes com data, valor, e snapshot da distribuição (dados da tabela `contributions`)
- **Acceptance Criteria:**
  - [ ] AC1: Campo de input pré-preenche com o valor do último aporte registrado na `wallet_id` ativa (ou R$ 12.000 se nenhum)
  - [ ] AC2: Resultado do cálculo usa dados da carteira ativa (`wallet_id`)
  - [ ] AC3: Histórico de aportes exibe lista cronológica reversa dos registros em `contributions` para a `wallet_id` ativa
  - [ ] AC4: Estado vazio do histórico exibe "Nenhum aporte registrado ainda"
  - [ ] AC5: Resultado L3 exibe por ativo: ticker, cotas a comprar, valor estimado, indicação do modo de peso (manual/questionário)

#### F-031: Tab Ativos — Conteúdo Detalhado

- **Prioridade:** P0
- **Origem no Creative V2:** Seção "Página: Ativos"
- **Descrição:** Define o conteúdo completo da tab Ativos, consolidando os CRUDs do PRD V1 (F-003, F-004, F-005) com a visualização em árvore hierárquica e o novo sistema de peso dual (F-028). Esta tab é o ponto central de configuração da carteira.
- **Estrutura visual (árvore hierárquica):**
  ```
  Classes de Ativo
   ├── [+ Nova Classe]
   ├── Ações BR (Target: 25%)
   │    ├── [+ Novo Grupo]
   │    ├── Grupo 1 — 60%
   │    │    ├── [+ Novo Ativo]
   │    │    ├── VALE3 ──────── peso: 7 (questionário) [editar]
   │    │    ├── WEGE3 ──────── peso: 5 (manual) [editar]
   │    │    └── ...
   │    └── Grupo 2 — 20%
   │         └── ...
   ├── FIIs (Target: 15%)
   │    └── ...
   └── ...
  ```
- **Acceptance Criteria:**
  - [ ] AC1: Árvore hierárquica exibe classes → grupos → ativos com indentação visual clara
  - [ ] AC2: Cada nível permite criar, editar e remover items inline (sem navegar para outra tela)
  - [ ] AC3: Ativos exibem o peso atual com indicação do modo (manual/questionário)
  - [ ] AC4: Botão [editar] no ativo abre painel/modal de peso dual (F-028)
  - [ ] AC5: Dados filtrados pela `wallet_id` da carteira ativa
  - [ ] AC6: Cadastro de classe: nome + target % + ordem de exibição
  - [ ] AC7: Cadastro de grupo: nome + target % dentro da classe + método de scoring padrão (questionário/manual)
  - [ ] AC8: Cadastro de ativo: ticker, nome (opcional), setor (opcional), quantidade, fonte de preço, is_active, manual_override, whole_shares
  - [ ] AC9: Validação: soma dos target % das classes não precisa ser 100% (flexibilidade), mas exibe warning se diferir
  - [ ] AC10: Validação: soma dos target % dos grupos dentro de uma classe deve ser ~100% (± 1pp)

---

## 4. Success Metrics

| Métrica | Baseline | Target | Como Medir |
|---------|----------|--------|------------|
| Onboarding completion rate | N/A (novo) | 100% dos novos usuários criam carteira na primeira visita | Query: `SELECT count(*) FROM wallets WHERE created_at = (SELECT min(created_at) FROM wallets w2 WHERE w2.user_id = wallets.user_id)` — comparar com total de logins únicos |
| Switching latency entre carteiras | N/A (novo) | < 500ms (latência percebida) | Performance.measure() no client ao trocar carteira |
| Referências a "Portfolio" | Desconhecido (legacy) | 0 ocorrências visíveis ao usuário | Grep no codebase + teste visual em todas as telas |
| Cobertura do peso dual | 0% (apenas questionário) | 100% dos ativos suportam ambos os modos | Query: `SELECT count(*) FILTER (WHERE weight_mode IS NOT NULL) * 100.0 / count(*) FROM assets` |
| Isolamento de dados por carteira | N/A (sem carteiras) | 100% — dados de carteira A nunca aparecem na carteira B | Teste: criar 2 carteiras com dados distintos, alternar, verificar isolamento |

---

## 5. Technical Constraints

### Adicionais à V1

| Constraint | Detalhe |
|-----------|---------|
| Backward compatibility | Migration deve preservar 100% dos dados existentes; nenhum dado pode ser perdido ao adicionar `wallet_id` |
| `price_cache` e `exchange_rates` globais | Preços são compartilhados entre carteiras (não recebem `wallet_id`); mesmo ticker em carteiras diferentes usa o mesmo preço |
| Cascade delete | `ON DELETE CASCADE` na FK `wallet_id` de todas as tabelas filhas — deletar carteira remove tudo |
| Constraint `weight_mode` | `CHECK (weight_mode IN ('manual', 'questionnaire'))` — enum validado no DB |
| Constraint `manual_weight` | `CHECK (manual_weight >= -10 AND manual_weight <= 11)` — escala da planilha original |
| Tab state | Tab ativa persistida em URL (query param) para deep-linking e compartilhamento |

### Schema Completo V2

Tabelas V1 (sem alteração de estrutura, apenas adição de `wallet_id`):
- `asset_types` — +`wallet_id`
- `asset_groups` — +`wallet_id`
- `assets` — +`wallet_id`, +`weight_mode`, +`manual_weight`
- `questionnaires` — +`wallet_id`
- `asset_scores` — +`wallet_id`
- `contributions` — +`wallet_id`
- `price_cache` — sem alteração
- `exchange_rates` — sem alteração
- `price_refresh_log` — sem alteração
- `feature_flags` — sem alteração

Tabela nova:
- `wallets` — `id`, `user_id`, `name`, `created_at`

---

## 6. Dependencies

### Novas Dependências (V2-specific)

| Dependência | Tipo | Status | Notas |
|-------------|------|--------|-------|
| Supabase migration tooling | Interna | Confirmada | Migration incremental via `supabase/migrations/` existente |
| azimute-blog menu config | Interna (projeto host) | Pendente | Requer alteração no menu lateral do azimute.cc para renomear "Portfolio" → "Nexus Data" |
| `localStorage` API | Browser | Confirmada | Para persistir `wallet_id` ativa entre sessões |
| Componentes existentes | Interna | Confirmada | AllocationTable, DeviationBar, PriceRefreshButton, RebalanceCalculator, ScoringModal, TabNavigation — reutilizados |

### Dependências V1 Mantidas

Todas as dependências listadas no PRD V1 (Seção 6) permanecem válidas e não são repetidas aqui.

---

## 7. Milestones & Phases

### Fase 1-V2: Multi-Carteira + Onboarding + Navegação

- **Features:** F-022, F-023, F-024, F-025, F-026, F-027, F-028, F-029, F-030, F-031
- **Pré-requisito:** Bugs críticos do V1 corrigidos (RLS em `/api/asset-types`, CRUD UIs básicos funcionando)
- **Acceptance Criteria (fase):**
  - [ ] Migration V2 executada: tabela `wallets` criada, `wallet_id` adicionada a todas as tabelas relevantes, dados existentes preservados com carteira default
  - [ ] Onboarding: novo usuário vê tela de boas-vindas e cria primeira carteira sem erros
  - [ ] Multi-carteira: criar segunda carteira, adicionar dados, alternar entre carteiras sem vazamento de dados
  - [ ] Tabs Dashboard/Aportes/Ativos funcionam com dados da carteira ativa
  - [ ] Peso dual: criar ativo com nota manual = 8, criar outro com questionário score = 6, calcular rebalanceamento — distribuição respeita os pesos corretamente
  - [ ] "Nexus Data" exibido em todas as referências visuais; 0 menções a "Portfolio"
  - [ ] Mobile: todas as tabs e onboarding funcionam em tela de celular sem scroll horizontal
- **Prioridade:** P0

### Relação com Fases V1

| Fase V1 | Status | Relação com V2 |
|---------|--------|----------------|
| Fase 1 (MVP — Paridade) | ~70% implementada | V2 pode iniciar em paralelo para schema e onboarding; CRUD UIs do V1 devem estar prontos antes das tabs V2 |
| Fase 2 (Visualizações) | Não iniciada | Independente do V2; pode ser feita antes ou depois |
| Fase 3 (Histórico e Projeções) | Não iniciada | `contributions` ganha `wallet_id` na migration V2; implementação de F-016 a F-021 é independente |

---

## 8. Out of Scope

| Item | Motivo |
|------|--------|
| Compartilhamento de carteiras entre usuários | Cada usuário gerencia apenas as próprias (multi-carteira ≠ multi-tenant) |
| Importação/exportação de carteiras | Não mencionado no Creative V2; pode ser backlog futuro |
| Templates de carteira pré-configurados | Não mencionado; onboarding cria carteira vazia |
| Merge de carteiras | Complexidade desproporcional ao valor; pode ser backlog futuro |
| Refatoração da rota base (`/dashboard/portfolio` → `/nexus`) | Decisão técnica delegada ao @architect; PRD define apenas que o label visível deve ser "Nexus Data" |
| Todos os itens de Out of Scope do PRD V1 | Permanecem excluídos |

---

## 9. Risks & Mitigations

| Risco | Impacto | Probabilidade | Mitigação |
|-------|---------|---------------|-----------|
| Migration corrompe dados existentes | Alto | Baixa | Migration em 3 passos atômicos (criar wallets → adicionar FK nullable → backfill → tornar NOT NULL); teste em staging com dump de produção |
| Performance degradada com filtro duplo (user_id + wallet_id) | Médio | Baixa | Index composto em `(user_id, wallet_id)` nas tabelas com mais dados (`assets`, `asset_scores`); `wallet_id` é UUID, busca por PK é O(1) |
| Conflito entre peso manual e questionário no L3 | Alto | Média | Constraint `weight_mode` no DB garante exclusividade; `distributeL3` normaliza scores de ambos os modos na mesma escala antes de calcular percentuais |
| Onboarding não disparado (edge case: cookies/localStorage corrompidos) | Médio | Baixa | Guard no server-side (Astro frontmatter): query `wallets WHERE user_id = auth.uid()` — se 0 rows, renderiza onboarding; não depende de client state |

---

## 10. Implementation Notes

### Migration Order (sugestão para @dev e @data-engineer)

1. **Migration N+1:** Criar tabela `wallets` com RLS
2. **Migration N+2:** Adicionar `wallet_id` (nullable) a todas as tabelas + FK + cascade
3. **Migration N+3:** Backfill — criar carteira default "Minha Carteira" para cada `user_id` distinto; popular `wallet_id`
4. **Migration N+4:** Tornar `wallet_id NOT NULL`; atualizar UNIQUE constraints
5. **Migration N+5:** Adicionar `weight_mode` e `manual_weight` à tabela `assets`

### Component Reuse

| Componente Existente | Uso na V2 |
|---------------------|-----------|
| `AllocationTable.tsx` | Tab Dashboard — sem alteração (recebe dados filtrados por wallet) |
| `DeviationBar.tsx` | Tab Dashboard — sem alteração |
| `PriceRefreshButton.tsx` | Tab Dashboard — sem alteração |
| `RebalanceCalculator.tsx` | Tab Aportes — atualizar para usar `wallet_id` no fetch de dados |
| `ScoringModal.tsx` | Tab Ativos → painel de peso → modo questionário — sem alteração |
| `TabNavigation.tsx` | Atualizar labels: Dashboard / Aportes / Ativos |
| `Dashboard.tsx` | Refatorar para ser conteúdo da tab Dashboard |
| `AssetTable.tsx` | Tab Ativos — base para árvore hierárquica, pode precisar refatoração significativa |

### Algorithm Update (`lib/nexus/rebalance.ts`)

`distributeL3` precisa ser atualizado para suportar peso dual:

```typescript
// Pseudo-código da mudança em distributeL3
for (const asset of activeAssets) {
  const weight = asset.weight_mode === 'manual'
    ? asset.manual_weight
    : getQuestionnaireScore(asset.id); // total_score de asset_scores
  rawScores.push({ ticker: asset.ticker, score: weight });
}
const normalized = normalizeScores(rawScores);
```

A função `normalizeScores` existente já suporta scores negativos (shift ao mínimo zero), então funciona sem alteração para ambos os modos.

---

## Changelog

| Versão | Data | Autor | Alteração |
|--------|------|-------|-----------|
| 1.0 | 2026-03-23 | @pm (Morgan) | Versão inicial — delta V2: multi-carteira, onboarding, tabs Dashboard/Aportes/Ativos, peso dual, renomear para "Nexus Data" |
| 1.1 | 2026-03-23 | Azimute | Revisão de alinhamento com Creative V2: adicionado F-021B (bug /api/asset-types), removido limite de 10 carteiras (não especificado no Creative), faixa do peso manual marcada como pendente de definição |
