# CREATIVE V2 — Nexus Data

> Revisão baseada na análise do estado atual (2026-03-23) e visão refinada do produto.
> V1 criado: 2026-03-21 | V2 criado: 2026-03-23

---

## O que mudou da V1

| Dimensão | V1 | V2 |
|---|---|---|
| Usuários | Single-user implícito | Multi-carteira por usuário explícito |
| Onboarding | Não havia | Fluxo de criação da primeira carteira |
| Navegação | `/dashboard/portfolio` | Menu "Nexus Data" → tabs internas |
| Nome no menu | "Portfolio" (herdado do blog) | **"Nexus Data"** |
| Peso por ativo | Apenas questionário | Manual (nota livre) **ou** questionário (switch) |
| Tabs | Overview / Detalhes / Rebalancear | **Dashboard / Aportes / Ativos** |
| Escopo | Ferramenta pessoal | Arquitetura pronta para múltiplos usuários (isolamento real) |

---

## Visão

**Uma aplicação web dentro da área de membros do azimute.cc onde o investidor chega, digita o valor do aporte, e recebe exatamente o que comprar — sem planilha, sem fórmula quebrada, sem `#N/A`.**

---

## Problema (mantido da V1, com adição)

Todos os problemas da V1 persistem (planilha frágil, GOOGLEFINANCE quebrando, impossível no celular, sem histórico).

**Novo problema identificado na V2:** o app atual no site mostra "Portfolio" no menu e tem uma tela de cadastro de ativo não-funcional (500 em `/api/asset-types` por bug de RLS). O usuário que acessa hoje não consegue cadastrar nada.

---

## Arquitetura de Dados — Novo Modelo

### Hierarquia completa

```
Usuário
 └── Carteira (N carteiras por usuário)
      └── Classes de Ativo (asset_types)
           └── Grupos (asset_groups)
                └── Ativos (assets)
                     ├── Peso via Nota Manual  ──┐ switch exclusivo
                     └── Peso via Questionário ──┘
```

### Tabela nova: `wallets`

```sql
CREATE TABLE wallets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Todas as tabelas existentes (`asset_types`, `asset_groups`, `assets`, `questionnaires`, `contributions`) ganham coluna `wallet_id UUID REFERENCES wallets(id)`.

RLS existente (por `user_id`) se mantém. Queries filtram por `wallet_id` dentro do escopo do usuário.

---

## Navegação e UX

### Menu lateral (azimute.cc)

- "Portfolio" → renomear para **"Nexus Data"**
- URL base: `/nexus` (ou manter `/dashboard` — decisão técnica)

### Fluxo de entrada

```
Usuário clica "Nexus Data" no menu
       ↓
Tem carteira cadastrada?
   NÃO → Tela de Onboarding
   SIM → Dashboard da carteira ativa
```

### Tela de Onboarding (primeira vez)

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

Após criar: redireciona para o Dashboard vazio (sem dados ainda).

### Seletor de carteiras (se usuário tiver > 1)

- Dropdown no topo da área interna ou no header do app
- Botão "Nova carteira" acessível a qualquer momento

### Tabs internas do app

```
[ Dashboard ]  [ Aportes ]  [ Ativos ]
```

---

## Página: Dashboard

**Objetivo:** visão instantânea do portfólio.

**Conteúdo:**
- Valor total consolidado em BRL (ativos domésticos + internacionais convertidos)
- Tabela das classes de ativo: nome, target %, atual %, valor atual, desvio (overweight/underweight)
- Gráfico de alocação: atual vs. target
- Indicadores visuais de desvio (vermelho = overweight, verde = alinhado, azul = underweight)
- Botão "Atualizar preços" (refresh manual das cotações)
- Timestamp do último refresh

---

## Página: Aportes

**Objetivo:** calcular exatamente o que comprar no próximo aporte.

**Conteúdo:**
- Campo de input: valor do aporte (default: último valor usado)
- Botão "Calcular"
- Resultado hierárquico (L1 → L2 → L3):
  - **Nível 1 (Classe):** "Ações BR recebe R$ 4.428 / FIIs recebe R$ 0"
  - **Nível 2 (Grupo):** "Grupo 1 (60%) = R$ 2.657 / Grupo 2 (20%) = R$ 886"
  - **Nível 3 (Ativo):** "VALE3 — 2 cotas — R$ 154,26 / WEGE3 — 1 cota — R$ 46,10"
- Lógica: FLOOR para ações/FIIs (cotas inteiras), fracionário para ETFs
- Histórico de aportes: lista dos últimos aportes com data, valor e snapshot da distribuição

---

## Página: Ativos

**Objetivo:** configurar a carteira — hierarquia completa e pesos.

### Estrutura visual

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

### Cadastro de Classe de Ativo

- Nome (ex: "Ações BR", "FIIs", "Renda Fixa")
- Target % (percentual alvo do portfólio total)
- Ordem de exibição

### Cadastro de Grupo

- Nome (ex: "Grupo 1 — Blue Chips")
- Target % dentro da classe
- Método de scoring padrão: Questionário | Manual

### Cadastro/Edição de Ativo

- Ticker (ex: VALE3, MXRF11, VTI)
- Nome (opcional)
- Setor (opcional)
- Quantidade atual
- Fonte de preço: brapi / yahoo / manual / crypto / exchange
- Flags: `is_active` (incluir no rebalanceamento), `manual_override` (excluir temporariamente)
- Cotas inteiras: Sim/Não (FLOOR vs. fracionário)

### Sistema de Peso por Ativo — NOVO

Ao clicar em um ativo, o usuário vê o painel de peso:

```
┌──────────────────────────────────────────┐
│ VALE3 — Peso atual: 7                    │
│                                          │
│  Modo de cálculo:                        │
│  [●] Nota manual   [ ] Questionário      │
│                                          │
│  Nota manual: [___7___] (-100 a 100)     │
│                                          │
│  [Salvar]                                │
└──────────────────────────────────────────┘
```

Ao alternar o switch para "Questionário":

```
┌──────────────────────────────────────────┐
│ VALE3 — Peso atual: 7 (questionário)     │
│                                          │
│  Modo de cálculo:                        │
│  [ ] Nota manual   [●] Questionário      │
│                                          │
│  Perguntas (responda Sim ou Não):        │
│  1. Empresa tem dividend yield > 5%?  [Sim] │
│  2. P/L abaixo da média do setor?     [Sim] │
│  3. Alta dependência de commodities?  [Não] │
│  ...                                    │
│                                          │
│  Score calculado: 7                     │
│  [Salvar]                                │
└──────────────────────────────────────────┘
```

**Regra:** os dois modos são mutuamente exclusivos. O campo `weight_mode` (enum: `manual` | `questionnaire`) determina qual valor o algoritmo L3 usa.

---

## Algoritmo de Rebalanceamento (mantido da V1)

Cascata L1 → L2 → L3:
- **L1:** distribui o aporte entre as classes (por desvio do target)
- **L2:** dentro de cada classe, distribui entre grupos (por target % do grupo)
- **L3:** dentro de cada grupo, distribui entre ativos (por score normalizado)

Score normalizado dentro do grupo: `score_ativo / sum(scores_ativos_ativos_no_grupo)`

Ativos com `is_active = false` ou `manual_override = true` recebem R$ 0 e são ignorados no denominador.

---

## Motor de Preços (mantido da V1)

| Fonte | Ativos | Free Tier |
|---|---|---|
| brapi.dev | Ações B3 + FIIs | 15.000 req/mês |
| Yahoo Finance | ETFs internacionais | Sem limite |
| exchangerate-api.com | USD/BRL, BTC/BRL | 1.500 req/mês |

Cache em `price_cache` com TTL de 5 min (pregão) / 1h (fora).

---

## Stack (mantida da V1)

| Camada | Tecnologia |
|---|---|
| Frontend | Astro 6 + React (islands) |
| Backend/DB | Supabase (Postgres + RLS) |
| Auth | Supabase Auth (email/senha) |
| Deploy | Vercel (junto ao azimute-blog) |

---

## Bugs conhecidos a corrigir antes do MVP

1. **`/api/asset-types` → HTTP 500** — RLS policy viola `INSERT` onde deveria ser `SELECT`. A Edge Function está executando operação errada.
2. **"Portfolio" no menu** → renomear para "Nexus Data"
3. **Sem tabela `wallets`** → schema incompleto para multi-carteira

---

## Critérios de Sucesso (V2)

1. **Onboarding funcional:** usuário sem carteira é guiado para criar a primeira antes de acessar o app
2. **Multi-carteira:** usuário pode criar N carteiras e alternar entre elas
3. **Hierarquia completa:** consegue cadastrar classe → grupo → ativo em um fluxo natural
4. **Peso dual:** switch manual/questionário funciona e o algoritmo usa o modo correto
5. **Rebalanceamento:** dado valor de aporte, gera distribuição L1→L2→L3 correta
6. **Paridade com planilha:** mesmo aporte + mesmos preços = mesma distribuição (tolerância < R$ 1)
7. **Cotações funcionando:** preços de todos os ativos atualizados sem intervenção manual
8. **Mobile usável:** "digitar aporte → ver lista de compras" funciona em tela de celular
9. **"Nexus Data" no menu:** sem referência a "Portfolio" visível ao usuário

---

## Não-Objetivos (mantidos da V1)

- Não é corretora nem executa trades
- Não é planilha genérica
- Não é SaaS com billing
- Não sugere ativos nem faz fundamentalismo
- Não tem alertas de preço em tempo real
- Não é plataforma colaborativa (mesmo com multi-carteira, cada usuário gerencia apenas as próprias)
