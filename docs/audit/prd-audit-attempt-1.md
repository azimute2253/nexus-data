# PRD Audit Report — Attempt 1

**Date:** 2026-03-21
**Score:** 55/100
**Verdict:** critical

---

## Executive Summary

O PRD apresenta estrutura sólida e rastreabilidade excelente ao Creative Brief, mas sofre de 9 issues críticos que totalizam -45 pontos de deduction. As forças incluem: metadata completo, feature mapping 100% rastreável ao Creative, métricas mensuráveis bem definidas, e ACs concretos e testáveis. As fraquezas críticas incluem: valores contraditórios de patrimônio (R$ 243K vs R$ 319K em changelog), métricas com métodos de medição vagos ou ausentes, dependências sem plano de mitigação para riscos conhecidos, milestone do MVP lista features que não existem, e total de 10 classes omitidas mas referenciadas.

---

## Checklist Results

### ✅ Items Passed (do NOT modify these in retry)

- **FM-1:** Toda feature mencionada no Creative aparece no PRD — PASSED
- **FM-2:** Nenhuma feature foi inventada (tudo rastreável ao Creative) — PASSED
- **FM-3:** Cada feature tem ID único (F-001, F-002, ...) — PASSED
- **FM-4:** Cada feature tem prioridade clara (P0/P1/P2) — PASSED
- **FM-5:** Cada feature referencia a seção do Creative de onde veio — PASSED
- **ES-1:** Seção "Out of Scope" existe e lista items excluídos — PASSED
- **ES-2:** Cada item fora de escopo tem motivo explícito — PASSED
- **ES-3:** Items fora de escopo indicam se vão para backlog (e quando) — PASSED
- **ES-4:** Não há "nice to haves" disfarçados como features — estão no Out of Scope — PASSED
- **CL-1:** Executive Summary é compreensível sem conhecimento prévio do Creative — PASSED
- **CL-2:** Linguagem declarativa ("o sistema deve") em vez de aspiracional ("deveria poder") — PASSED
- **CL-3:** Acceptance Criteria são testáveis (QA consegue escrever teste a partir deles) — PASSED
- **CL-4:** Sem jargão desnecessário ou siglas não definidas — PASSED
- **CO-1:** Metadata completa (autor, creative source, status, versão, datas) — PASSED
- **CO-3:** Todas as 8 seções obrigatórias presentes — PASSED
- **CO-4:** Goals conectados a Objectives conectados a Features (rastreabilidade) — PASSED

### ❌ Items Failed (MUST fix in retry)

- **ME-2:** Cada métrica tem valor baseline (atual ou "a coletar com método X") — FAILED — Deduction: -5 points — Reason: 4 métricas sem baseline definido
- **ME-4:** Cada métrica tem método de medição definido (ferramenta/processo) — FAILED — Deduction: -5 points — Reason: 2 métricas com método vago ou sem detalhamento
- **DE-2:** Cada dependência tem status (Confirmada / Pendente / Em Risco) — FAILED — Deduction: -5 points — Reason: Yahoo Finance marcada "Pendente" sem data esperada
- **DE-4:** Dependências "Em Risco" ou "Pendente" tem plano de mitigação ou data esperada — FAILED — Deduction: -5 points — Reason: Yahoo Finance sem plano de mitigação
- **MI-1:** Cada milestone lista as features incluídas (por ID) — FAILED — Deduction: -10 points — Reason: Milestone MVP lista F-010 que não existe
- **MI-3:** MVP está claramente definido (quais features, quais critérios) — FAILED — Deduction: -5 points — Reason: Contradição entre features listadas (11) e milestone (10 IDs)
- **CO-2:** Technical Constraints definidos (stack, infra, segurança, performance) — FAILED — Deduction: -5 points — Reason: Limites de performance definidos mas faltam constraints de armazenamento

### ISSUE-1: Valor de Patrimônio Contraditório — Deduction: -10
**Location:** PRD metadata/changelog vs. PRD §1, §2, §6
**Problem:** Changelog linha 458 diz "corrigido valor patrimônio (R$ 319K → R$ 243K)", mas PRD usa R$ 243K no Executive Summary (§1), Goals (§2), Creative (linha 16), e tabela Success Metrics (§6). Não há R$ 319K em nenhum lugar do PRD — a correção não é visível.
**Impact:** Changelog contradiz o próprio documento — indica que houve um valor errado (R$ 319K) mas esse valor nunca aparece no PRD v2.0.
**Recommendation:** Remover a linha de changelog sobre patrimônio ou documentar onde estava o valor errado (provavelmente versão 1.0 que não está anexada). Se a correção é de v1.0 → v2.0, manter o changelog mas clarificar que se refere à versão anterior.

### ISSUE-2: Métrica "Taxa de falha de cotação" sem baseline — Deduction: -5
**Location:** PRD §4 (Success Metrics) — linha 309
**Problem:** Métrica "Taxa de falha de cotação" lista baseline como "~5-10% (GOOGLEFINANCE `#N/A` aleatório)", mas GOOGLEFINANCE não será usado no novo sistema — baseline deveria ser 0% ou "N/A (app novo)" para medir a taxa de falha das NOVAS APIs (brapi, Yahoo).
**Impact:** Baseline mede a ferramenta antiga, não serve como comparação válida para o novo sistema.
**Recommendation:** Alterar baseline para: "0% (sistema novo — coleta baseline pós-deploy durante 30 dias)" ou "N/A — coletar em produção durante os primeiros 30 dias".

### ISSUE-3: Métrica "Passos para adicionar ativo" sem baseline quantitativo — Deduction: -5
**Location:** PRD §4 (Success Metrics) — linha 308
**Problem:** Baseline diz "3 abas na planilha (~12 passos manuais)", mas o "~12 passos" é uma estimativa vaga. Para métrica rigorosa, deveria contar exatamente quantos passos são necessários na planilha.
**Impact:** Comparação target "≤ 5 campos" com baseline "~12 passos" usa unidades diferentes (campos vs passos).
**Recommendation:** Baseline: "12 passos (3 abas: Distribuição + aba do tipo + Balanceamentos, com 4 campos/aba)" e target: "≤ 5 passos (1 tela com 4 campos + scoring modal)".

### ISSUE-4: Métrica "Tempo de carga do dashboard" sem baseline — Deduction: -5
**Location:** PRD §4 (Success Metrics) — linha 307
**Problem:** Baseline diz "N/A (app novo)", mas para medir melhoria, deveria comparar com o tempo de carregamento da planilha Google Sheets atual.
**Impact:** Métrica não demonstra melhoria — apenas define um alvo absoluto sem comparação.
**Recommendation:** Baseline: "Google Sheets: ~5-8s FCP no celular 4G (carga inicial + scroll até aba Ações)" ou manter N/A se a métrica é apenas para garantia de performance, não comparação.

### ISSUE-5: Métrica "Tempo do fluxo de aporte (mobile)" sem baseline — Deduction: -5
**Location:** PRD §4 (Success Metrics) — linha 306
**Problem:** Baseline diz "N/A (planilha inutilizável no celular)", mas a métrica deveria quantificar a dor atual mesmo que seja "inutilizável" — ex: quantos passos/toques/swipes necessários na planilha mobile hoje.
**Impact:** Sem baseline, não demonstra melhoria mensurável — apenas afirma que a planilha é ruim sem dados concretos.
**Recommendation:** Baseline: "Planilha: ~15 toques (zoom, scroll horizontal/vertical, localização da célula de aporte, scroll até resultado)" ou manter N/A se medição na planilha for impraticável.

### ISSUE-6: Método de medição "Monitorar: contagem de ativos" vago — Deduction: -5
**Location:** PRD §4 (Success Metrics) — linha 305
**Problem:** Método "Monitorar: contagem de ativos com preço válido (não-nulo, atualizado nas últimas 24h) / total de ativos" não especifica ferramenta ou processo — onde será monitorado? Dashboard interno? Query SQL manual? Logging?
**Impact:** QA não sabe como executar a medição.
**Recommendation:** Especificar: "Dashboard admin: query SQL `SELECT COUNT(*) FROM price_cache WHERE updated_at > NOW() - INTERVAL '24h' / SELECT COUNT(*) FROM assets WHERE is_active = true`" ou "Log server-side agregado diariamente via Edge Function de monitoramento".

### ISSUE-7: Método de medição "Log server-side: contabilizar respostas" sem detalhamento — Deduction: -5
**Location:** PRD §4 (Success Metrics) — linha 309
**Problem:** Método "Log server-side: contabilizar respostas de erro / total de requests de preço por dia" não especifica ferramenta de logging (Supabase Logs? CloudWatch? Custom table?) ou retenção de logs.
**Impact:** QA não sabe como validar a métrica.
**Recommendation:** Especificar: "Supabase Edge Function logs agregados diariamente via view `price_request_stats` com colunas: date, total_requests, error_count, error_rate" ou ferramenta equivalente.

### ISSUE-8: Dependência Yahoo Finance sem plano de mitigação — Deduction: -5
**Location:** PRD §6 (Dependencies) — linha 382
**Problem:** Yahoo Finance marcada como "Pendente" com nota "Sem SLA oficial — pode quebrar; necessário plano de fallback (ex: input manual)", mas não define o plano de mitigação nem quando será validado.
**Impact:** Risco não mitigado — se Yahoo Finance falhar, não há solução alternativa planejada.
**Recommendation:** Adicionar plano de mitigação: "Fallback: se Yahoo Finance retornar erro por >24h, exibir modal solicitando input manual de preços dos ETFs internacionais (~20 ativos) com campo de upload CSV. Data de validação: até início da Fase 1 (primeiros 7 dias de dev)."

### ISSUE-9: Total de 10 Classes de Ativo Omitidas — Deduction: -5
**Location:** PRD §3 (Features) — F-003 linha 82
**Problem:** F-003 AC1 diz "Lista os 10 tipos de ativo com respectivos target %", mas o PRD nunca define QUAIS são as 10 classes. O Creative lista: "Ações BR, FIIs, RF (3 grupos: RI/RV/RF), Exterior (ETFs)" — mas isso não soma 10 claramente. O Creative linha 302 diz "Classes de ativo: 10" mas não lista.
**Impact:** Ambiguidade — dev não sabe quais 10 tipos criar durante implementação.
**Recommendation:** Adicionar seção ou tabela no PRD listando as 10 classes de ativo com nomes exatos (ex: Ações BR, FIIs, Renda Fixa - Pré, Renda Fixa - Pós, Renda Fixa - Inflação, Renda Variável Outros, Exterior Ações, Exterior Bonds, Exterior REITs, Criptomoedas — ou conforme estrutura real da planilha). Ou referenciar explicitamente: "Conforme planilha atual, aba 'Distribuição de aporte'".

---

## Recommendations for Retry

1. **ISSUE-1:** Clarificar changelog ou remover linha contraditória sobre patrimônio (R$ 319K não aparece no PRD).
2. **ISSUE-2:** Corrigir baseline da métrica "Taxa de falha de cotação" para medir as novas APIs, não GOOGLEFINANCE.
3. **ISSUE-3:** Quantificar baseline "~12 passos" com número exato e unidade consistente com target.
4. **ISSUE-4:** Adicionar baseline de tempo de carga da planilha ou justificar N/A como "garantia de performance".
5. **ISSUE-5:** Quantificar baseline de toques na planilha mobile ou justificar N/A.
6. **ISSUE-6:** Especificar ferramenta/processo de monitoramento da métrica "Cobertura de cotações".
7. **ISSUE-7:** Especificar ferramenta de logging da métrica "Taxa de falha de cotação".
8. **ISSUE-8:** Adicionar plano de mitigação e data de validação para Yahoo Finance (dependência "Pendente").
9. **ISSUE-9:** Listar as 10 classes de ativo explicitamente ou referenciar fonte (planilha aba X).

Do NOT modify sections that passed (✅ above).

---

## Score Breakdown

- Base score: 100
- ISSUE-1 (Changelog contraditório): -10
- ISSUE-2 (Baseline métrica incorreto): -5
- ISSUE-3 (Baseline vago): -5
- ISSUE-4 (Baseline ausente): -5
- ISSUE-5 (Baseline ausente): -5
- ISSUE-6 (Método vago): -5
- ISSUE-7 (Método vago): -5
- ISSUE-8 (Dependência sem mitigação): -5
- ISSUE-9 (Classes omitidas): -5
- **Final score: 55/100**
