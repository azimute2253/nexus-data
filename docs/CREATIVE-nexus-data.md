# CREATIVE — Nexus Data

> Documento de produto para o Nexus Data — ferramenta pessoal de rebalanceamento de portfólio de investimentos.
> Criado: 2026-03-21

---

## Visão

**Transformar 2.000+ fórmulas em uma planilha frágil em uma aplicação web rápida, mobile-first, que calcula exatamente onde colocar cada real do próximo aporte.**

---

## Problema

O investidor hoje gerencia ~R$ 243K (patrimônio total, incluindo ativos internacionais já convertidos) usando uma planilha Google Sheets com 6 abas e mais de 2.000 fórmulas encadeadas. Funciona — até não funcionar mais.

### Dores concretas

1. **GOOGLEFINANCE quebra sem aviso.** Cotações de 111+ ativos (91 ações, 20 FIIs, ~20 ETFs) dependem de uma função que retorna `#N/A` quando o Google decide. Quando isso acontece, toda a cascata de cálculos fica inválida, e o investidor não tem como saber se o resultado está certo ou errado.

2. **Impossível usar no celular.** A planilha tem 106 linhas × 15 colunas só na aba de Ações. No celular, a experiência é inutilizável — e é justamente quando o investidor está no app da corretora que precisa saber "o que comprar agora".

3. **Manutenção é um pesadelo.** Adicionar um ativo novo exige mexer em 3 abas diferentes (ativo na aba do tipo, questionnaire no Balanceamentos, referência na Distribuição de aporte). Uma fórmula errada em qualquer ponto corrompe silenciosamente todo o rebalanceamento.

4. **Zero histórico.** A planilha mostra o estado atual. Não existe registro de aportes passados, evolução patrimonial, ou como a alocação mudou ao longo do tempo. Toda decisão é baseada em um snapshot momentâneo.

5. **FIIs massivamente overweight.** 65% do portfólio está em FIIs contra um target de 15%. A planilha calcula corretamente que FIIs devem receber R$ 0 de aporte, mas não mostra projeção de quantos meses levará para normalizar — o investidor não tem visibilidade do longo prazo.

6. **Sem override centralizado.** O flag "Vou aportar?" (Sim/Não) existe apenas na aba de FIIs. Para ações e ETFs, excluir um ativo do rebalanceamento exige movê-lo para "Grupo 0" — uma gambiarra que polui a organização dos dados.

---

## Solução

Nexus Data é uma nova aba dentro da área de membros do site azimute.cc (azimute-blog), que replica 100% da lógica de rebalanceamento da planilha, mas com:

- **Cotações de APIs reais** (brapi.dev para B3, Yahoo Finance para US) em vez de GOOGLEFINANCE
- **Interface responsiva** otimizada para o fluxo "abrir no celular → digitar valor do aporte → ver lista de compras"
- **CRUD completo** para ativos, grupos, tipos e questionnaires — tudo em um só lugar
- **Histórico de aportes** e evolução patrimonial persistidos no banco de dados
- **Algoritmo de cascata de 3 níveis** (L1 tipo → L2 grupo → L3 ativo) idêntico ao da planilha, implementado em TypeScript testável

---

## Usuário-Alvo

**Quem:** Luis — médico, investidor individual com portfólio diversificado.

**Perfil:**
- Único usuário (ferramenta pessoal, não SaaS)
- Gerencia 10 classes de ativos, 131+ posições individuais
- Faz aportes mensais de ~R$ 12.000
- Quer saber **exatamente** o que comprar a cada aporte, sem pensar
- Usa o celular durante pregão e nos horários livres
- Budget: zero (free tiers apenas)

**Quando usa:**
- **Dia do aporte mensal:** Abre o app → digita o valor → recebe a lista "compre X cotas de Y" → executa na corretora
- **Durante o mês:** Consulta rapidamente a alocação atual e o desvio de cada classe
- **Ao adicionar/remover ativo:** Edita o portfólio, re-pontua via questionário, e o sistema recalcula automaticamente

---

## Funcionalidades Core (MVP)

### 1. Dashboard Central — Visão do Portfólio

- Valor total do portfólio consolidado em BRL (doméstico + internacional convertido)
- Tabela das 10 classes de ativos com: target %, atual %, valor atual, status (overweight/underweight)
- Gráfico de pizza: alocação atual vs. target
- Indicador visual de desvio: FIIs 65% vs 15% target → barra vermelha

### 2. Calculadora de Rebalanceamento

- Campo de input: valor do aporte (default R$ 12.000)
- Botão "Calcular" → executa o algoritmo de cascata L1→L2→L3
- Resultado hierárquico:
  - **L1:** Distribuição por tipo de ativo (ex: Ações BR recebe R$ 4.428, FIIs recebe R$ 0)
  - **L2:** Dentro de cada tipo, distribuição por grupo (ex: Grupo 1 = 60%, Grupo 2 = 20%)
  - **L3:** Lista de compras por ativo individual (ex: "VALE3 — compre 2 cotas — R$ 154,26")
- Cálculo de unidades inteiras (FLOOR) para ações/FIIs, fracionário para ETFs internacionais

### 3. CRUD de Portfólio

- **Tipos de ativo** (10): criar, editar target %, reordenar
- **Grupos** (dentro de cada tipo): criar, editar target % do grupo, definir método de scoring
- **Ativos individuais** (131+): adicionar ticker, setor, quantidade, grupo, fonte de preço (brapi/yahoo/manual/crypto)
- **Flags por ativo:**
  - `is_active` (equivalente ao Grupo 0 atual — exclui do rebalanceamento sem deletar)
  - `manual_override` (equivalente ao "Vou aportar? Não" — exclui temporariamente)

### 4. Sistema de Scoring por Questionário

- Editor de questionário: lista de perguntas Sim/Não com peso +1/-1
- Questionários diferentes para FIIs, Ações, ETFs (como já funciona na planilha)
- Modal de scoring: seleciona ativo → responde perguntas → score calculado automaticamente
- Score normalizado dentro do grupo → % ideal por ativo
- Suporte a scores negativos (como XPLG11 com -10 na planilha atual)

### 5. Cotações em Tempo Real

- **B3 (ações + FIIs):** brapi.dev — batch de até 20 tickers por request
- **US (ETFs):** Yahoo Finance API
- **Câmbio:** exchangerate-api.com (USD/BRL, BTC/BRL)
- **Cache:** 5 minutos durante pregão, 1 hora fora do pregão
- Botão "Atualizar preços" para refresh manual
- Fallback visual quando API falha (mostra último preço + timestamp)

### 6. Autenticação

- Login via Supabase Auth (email/senha)
- Single-user, mas com RLS no banco para segurança
- Sessão persistente (não precisa logar toda vez)

### 7. Responsividade Mobile

- Layout card-based no celular (colapsa tabelas)
- Fluxo otimizado: tela principal → digita aporte → vê lista de compras em 2 toques
- Valor total e top holdings visíveis sem scroll
- Navegação por tabs: Overview | Detalhes | Rebalancear

---

## Funcionalidades Futuras

### Fase 2 — Visualizações e Análise

- Gráficos interativos: donut por setor (FIIs), barras horizontais de rebalanceamento, heatmap de alocação
- Simulador what-if: slider de contribuição com atualização em tempo real
- Tracker de dividendos: último provento por FII, yield estimado, renda mensal projetada
- Gauge de alinhamento: % de aderência do portfólio aos targets (0-100%)

### Fase 3 — Histórico e Projeções

- Registro persistente de cada aporte (data, valor, distribuição aplicada)
- Gráfico de evolução patrimonial ao longo do tempo
- Projeção: "em quantos meses FIIs volta ao target de 15% com aporte de R$ 12K/mês?"
- Alertas: notificação quando desvio de alocação ultrapassa threshold configurável
- Exportação: PDF do portfólio, CSV dos holdings
- Performance analytics: ROI por classe de ativo, rendimento vs. benchmark

---

## Restrições Técnicas

### Stack Definida

| Camada | Tecnologia | Motivo |
|--------|-----------|--------|
| Frontend | Astro 6 + React (islands) | Mesmo stack do azimute-blog; integração direta como aba do dashboard |
| Backend/DB | Supabase (Postgres + RLS) | Auth já integrado no azimute-blog; mesma instância |
| Cotações BR | brapi.dev | Free: 15.000 req/mês (suficiente para ~120 tickers a cada 5min) |
| Cotações US | Yahoo Finance | API não-oficial, sem limite prático |
| Câmbio | exchangerate-api.com | Free: 1.500 req/mês |
| Charts | Recharts | Leve, React-nativo, composable |
| Styling | Tailwind CSS | Já disponível no projeto |
| Deploy | Vercel | Mesmo deploy do azimute-blog (azimute.cc) |

### Decisões de Arquitetura

- **Integração no azimute-blog** — implementado como aba `/dashboard/portfolio` dentro da área de membros existente em azimute.cc, usando a mesma auth, layout, e infra do site
- **Custo mensal: R$ 0** — tudo em free tiers (Supabase já existente, brapi, Vercel já existente)
- **Single-user only** — sem multi-tenancy, sem roles, sem planos pagos
- **RLS obrigatório** — mesmo sendo single-user, todas as tabelas têm policy `auth.uid()`
- **API keys server-side** — chaves de API nunca expostas ao client; Edge Functions fazem chamadas externas
- **Algoritmo em TypeScript puro** — `lib/rebalance.ts` compartilhado entre server e client, testável unitariamente
- **Preços cacheados em banco** — tabela `price_cache` com TTL; client nunca chama API de preço diretamente
- **Sem execução de trades** — o app apenas calcula; o investidor executa manualmente na corretora

### Migração da Planilha

- Importação inicial via CSV (script já existe: `scripts/fetch-sheet.mjs`)
- Mapeamento das 6 abas para o schema relacional:
  - Distribuição de aporte → `asset_types` (10 registros)
  - FII → `asset_groups` + `assets` (1 grupo, 20 FIIs)
  - Ações → `asset_groups` + `assets` (4 grupos, 91 ações)
  - RI, RV e RF → `asset_groups` + `assets` (3 grupos)
  - Exterior → `asset_groups` + `assets` (5 grupos, ~20 ETFs)
  - Balanceamentos → `questionnaires` + `asset_scores`
- Após migração completa, a planilha deixa de ser fonte de verdade

---

## Critérios de Sucesso

O MVP está pronto quando:

1. **Paridade funcional com a planilha:** dado o mesmo aporte (R$ 12.000) e os mesmos preços, o Nexus Data gera exatamente a mesma distribuição que a planilha gera hoje (tolerância: < R$ 1 por ativo)
2. **Cotações funcionando:** preços de todos os 131+ ativos atualizados sem intervenção manual, sem `#N/A`
3. **CRUD completo:** é possível adicionar, editar, desativar e pontuar qualquer ativo sem mexer em código ou planilha
4. **Mobile usável:** o fluxo "digitar aporte → ver lista de compras" funciona confortavelmente em tela de celular
5. **Dados migrados:** todo o portfólio atual (10 tipos, 131+ ativos, scores, grupos) importado e verificado
6. **Auth funcionando:** login protege os dados; sem login não se acessa nada
7. **Deploy em produção:** acessível como aba da área de membros em azimute.cc, integrado ao layout existente

---

## Não-Objetivos

O Nexus Data **NÃO é:**

- **Uma corretora ou app de trading** — não executa ordens, não se conecta a brokers, não movimenta dinheiro
- **Uma planilha genérica** — não é Google Sheets/Excel killer; é uma ferramenta de rebalanceamento específica
- **SaaS multi-usuário** — não terá cadastro público, planos, billing, onboarding, admin panel
- **Ferramenta de análise fundamentalista** — não calcula P/L, EV/EBITDA, ou faz valuation; usa apenas o sistema de scoring Sim/Não
- **Robô de investimento** — não sugere ativos, não tem inteligência artificial, não faz backtesting
- **App de acompanhamento de mercado** — não mostra notícias, não tem alertas de preço, não é um terminal Bloomberg
- **Plataforma colaborativa** — é single-user; sem compartilhamento, sem permissões, sem equipe

---

## Experiência do Usuário

### Fluxo Principal — Dia do Aporte

```
1. Login (sessão persistente, raramente necessário)
2. Dashboard → vê valor total (~R$ 243K), alocação atual, desvios
3. Digita "12000" no campo de aporte
4. Clica "Calcular"
5. Vê distribuição hierárquica:
   - Ações BR: R$ 4.428 → [expandir]
     - Grupo 1 (60%): R$ 2.657
       - VALE3: 2 cotas (R$ 154)
       - WEGE3: 1 cota (R$ 46)
       - ...
     - Grupo 2 (20%): R$ 886
       - ...
   - FIIs: R$ 0 (overweight)
   - Renda Fixa: R$ 1.145 → [expandir]
   - ...
6. Abre app da corretora → executa as compras
7. Volta ao Nexus Data → atualiza quantidades (ou aguarda próximo refresh de preços)
```

### Fluxo Secundário — Adicionar Novo Ativo

```
1. Navega para tipo de ativo (ex: Ações BR)
2. Seleciona grupo (ex: Grupo 1 — 60%)
3. Clica "+ Adicionar Ativo"
4. Preenche: ticker (MGLU3), setor (Varejo), quantidade (0), fonte (brapi)
5. Clica "Pontuar" → abre modal do questionário
6. Responde 11 perguntas Sim/Não → score calculado (ex: 5)
7. Ativo aparece na lista com ideal % recalculado
8. Próximo rebalanceamento já inclui o novo ativo
```

### Fluxo Terciário — Consulta Rápida (Mobile)

```
1. Abre no celular
2. Vê: valor total, top 5 desvios (FIIs +50%, Ações BR -18%, ...)
3. Tab "FIIs" → lista de 20 FIIs com setor, valor, último dividendo
4. Fecha
```

### Navegação

```
/dashboard/portfolio              → Dashboard central (L1)
/dashboard/assets/[type]          → Tipo de ativo com grupos (L2)
/dashboard/assets/[type]/[group]  → Grupo com ativos individuais (L3)
/dashboard/questionnaires         → Lista de questionários
/dashboard/questionnaires/[id]    → Editor de questionário
/dashboard/contributions          → Histórico de aportes (Fase 3)
```

---

## Dados e Integrações

### Fontes de Preço

| Fonte | Ativos | Free Tier | TTL Cache |
|-------|--------|-----------|-----------|
| brapi.dev | 91 ações B3 + 20 FIIs | 15.000 req/mês | 5min (pregão) / 1h (fora) |
| Yahoo Finance | ~20 ETFs internacionais | Sem limite prático | 5min (pregão) / 1h (fora) |
| exchangerate-api.com | USD/BRL, BTC/BRL, BTC/USD | 1.500 req/mês | 15 minutos |

### Migração do Google Sheets

- **Origem:** planilha `1HG6pQdx-P85vd8EVg7bDzI2X-yW4bAF1HQVbXIaes0g` (6 abas)
- **Script existente:** `scripts/fetch-sheet.mjs` — exporta CSV público → JSON
- **Processo de migração:**
  1. Exportar dados atuais via CSV
  2. Parsear com PapaParse (formato brasileiro: R$ 1.234,56)
  3. Mapear para schema relacional no Supabase
  4. Validar: comparar resultado de rebalanceamento Nexus Data vs planilha
  5. Marcar planilha como deprecated

### Supabase

- **Database:** Postgres com RLS (8 tabelas: `asset_types`, `asset_groups`, `assets`, `price_cache`, `questionnaires`, `asset_scores`, `contributions`, `exchange_rates`)
- **Auth:** Email/senha, single-user
- **Edge Functions:** Cron de refresh de preços (a cada 5min durante pregão)
- **Views:** `portfolio_summary` — agrega valor por tipo de ativo com preços do cache

### Dados do Portfólio Atual (para migração)

| Dimensão | Quantidade |
|----------|-----------|
| Classes de ativo | 10 |
| Grupos | ~15 (4 em Ações, 1 em FIIs, 3 em RI/RV/RF, 5 em Exterior, etc.) |
| Ativos individuais | 131+ (91 ações, 20 FIIs, ~20 ETFs) |
| Valor total (BRL, inclui internacional) | ~R$ 243.783 |
| Maior desvio | FIIs: 65% atual vs 15% target (+50pp) |
| Aporte mensal típico | R$ 12.000 |
