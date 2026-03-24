# ADR-015: Peso Dual (weight_mode + Resolução XOR no L3)

| Campo | Valor |
|-------|-------|
| Status | Proposed |
| Data | 2026-03-23 |
| Autor | @architect (Aria) |
| PRD | docs/PRD-v2.md — F-028 (Sistema de Peso Dual por Ativo) |
| Relacionados | ADR-004 (Rebalancing Algorithm), ADR-010 (Multi-Wallet Schema) |

---

## Contexto

O PRD V1 define que o peso de cada ativo dentro do grupo (L3) é determinado exclusivamente pelo score do questionário (`asset_scores.total_score`). O PRD V2 introduz peso dual (F-028): cada ativo pode usar **nota manual** (número livre de -10 a +11) OU **questionário**. Os modos são mutuamente exclusivos (XOR).

### Algoritmo atual (V1)

```
distributeL3 → recebe L3AssetInput[] → usa asset.score → normalizeScores → % por ativo
```

`L3AssetInput.score` é um `number` que vem de `asset_scores.total_score` (inteiro, pode ser negativo). O `normalizeScores` já suporta negativos (shift do mínimo a zero).

### Questão arquitetural

Onde resolver o XOR entre manual e questionário?

1. **No data layer** (ao construir `L3AssetInput`) — o campo `score` já chega com o valor correto
2. **No algoritmo L3** (dentro de `distributeL3`) — o algoritmo recebe ambos os valores e decide
3. **No banco** (computed column ou trigger) — o DB resolve e expõe um campo unificado

---

## Decisão

Resolver o XOR **no data layer** (ao construir `L3AssetInput`), mantendo o algoritmo L3 inalterado.

### Schema: duas colunas novas em `assets`

```sql
ALTER TABLE assets ADD COLUMN weight_mode TEXT NOT NULL DEFAULT 'questionnaire'
  CHECK (weight_mode IN ('manual', 'questionnaire'));

ALTER TABLE assets ADD COLUMN manual_weight NUMERIC DEFAULT 0
  CHECK (manual_weight >= -10 AND manual_weight <= 11);
```

### Resolução no data layer

A função que monta os `L3AssetInput[]` para o algoritmo resolve o XOR:

```typescript
// Em src/lib/dashboard/data.ts (ou equivalente)
function buildL3Input(asset: Asset, assetScore: AssetScore | null): L3AssetInput {
  const score = asset.weight_mode === 'manual'
    ? asset.manual_weight    // nota manual do ativo
    : assetScore?.total_score ?? 0;  // score do questionário

  return {
    asset_id: asset.id,
    ticker: asset.ticker,
    group_id: asset.group_id,
    score,  // ← valor unificado, algoritmo L3 não sabe a origem
    price_brl: ...,
    is_active: asset.is_active,
    manual_override: asset.manual_override,
    whole_shares: asset.whole_shares,
  };
}
```

### Por que o L3 NÃO precisa mudar

1. `distributeL3` recebe `L3AssetInput[]` com um campo `score: number` — é agnóstico à origem do score
2. `normalizeScores` já suporta negativos (shift) — funciona com a escala -10 a +11
3. A normalização distribui proporcionalmente — funciona com ativos mistos (alguns manual, outros questionário)
4. A interface `L3AssetInput` não precisa de campos novos

O ADR-004 define que o algoritmo é puro e determinístico. Mover a lógica de resolução do peso para FORA do algoritmo preserva essa pureza.

### Escalas e compatibilidade

| Modo | Escala | Exemplos |
|------|--------|----------|
| Questionário | total_score (inteiro, tipicamente -10 a +11) | VALE3: 7, XPLG11: -10, WEGE3: 5 |
| Manual | manual_weight (numeric, -10 a +11) | Mesma escala: 7, -10, 5 |

A escala é a mesma da planilha original, garantindo que ambos os modos produzam distribuições comparáveis após normalização. Se um grupo tem ativos mistos:

```
Grupo X:
  VALE3: manual_weight = 8
  WEGE3: questionnaire total_score = 6
  ITUB4: manual_weight = -2

normalizeScores([8, 6, -2]) → shift +2 → [10, 8, 0] → [55.6%, 44.4%, 0%]
```

### Constraint XOR no banco

O `CHECK (weight_mode IN ('manual', 'questionnaire'))` garante que apenas um modo é válido por vez. Não é necessário constraint adicional porque:

- Se `weight_mode = 'questionnaire'`: o valor de `manual_weight` é ignorado pelo data layer (pode ter qualquer valor)
- Se `weight_mode = 'manual'`: o `asset_scores.total_score` é ignorado pelo data layer (permanece inalterado no DB)

Isso significa que ao trocar de modo, os dados do modo anterior são preservados — o usuário pode voltar sem perder scores.

### Migration backward-compatible

```sql
-- Migration 019 (ver ADR-011, passo 5)
ALTER TABLE assets ADD COLUMN weight_mode TEXT NOT NULL DEFAULT 'questionnaire'
  CHECK (weight_mode IN ('manual', 'questionnaire'));
ALTER TABLE assets ADD COLUMN manual_weight NUMERIC DEFAULT 0
  CHECK (manual_weight >= -10 AND manual_weight <= 11);
```

Todos os ativos existentes ficam com `weight_mode = 'questionnaire'`, preservando o comportamento V1 sem alteração.

---

## Consequências

### Positivas

- **Algoritmo L3 inalterado** — zero risco de regressão no cálculo de rebalanceamento
- **`normalizeScores` funciona sem alteração** — mesma escala, mesmo tratamento de negativos
- **Dados preservados ao trocar modo** — scores do questionário permanecem quando o ativo muda para manual (e vice-versa)
- **Ativos mistos no grupo** — normalização funciona corretamente com scores de origens diferentes
- **Testabilidade** — a resolução do XOR é uma function unit-testável separada do algoritmo

### Negativas

- O campo `manual_weight` pode conter "lixo" quando `weight_mode = 'questionnaire'`
  - **Aceitável:** o data layer ignora, e manter o valor permite reversão sem perda
- O data layer precisa fazer JOIN com `asset_scores` para modo questionário
  - **Já faz:** essa query já existe no V1, sem overhead adicional
- A escala -10 a +11 pode parecer arbitrária para novos usuários
  - **Mitigado:** é a escala da planilha original (familiar ao owner), e a UI pode exibir labels descritivos

### Riscos

- **Normalização com um único ativo no grupo** — `normalizeScores([5])` retorna `[100]` independente do valor
  - **Comportamento correto:** ativo único recebe 100% do grupo (mesmo em V1)
- **Score zero após normalização** — se `manual_weight = -10` e é o mínimo, shift zera e ativo recebe 0%
  - **Comportamento correto:** mesma lógica do V1 para scores negativos extremos. Ativo com menor score do grupo pode receber 0%

---

## Alternativas Consideradas

### A1: Resolver XOR dentro do `distributeL3`

Adicionar `weight_mode` e `manual_weight` a `L3AssetInput` e resolver dentro do algoritmo:

```typescript
// L3AssetInput V2 (rejeitada)
interface L3AssetInput {
  ...
  score: number;
  weight_mode: 'manual' | 'questionnaire';
  manual_weight: number;
}
```

**Prós:** Tudo em um lugar.
**Contras:**
- Quebra a pureza do L3 — o algoritmo passa a ter conhecimento de domínio (modes)
- `L3AssetInput` fica acoplada ao conceito de peso dual
- Se adicionarmos um terceiro modo no futuro (ex: ML-based), o L3 precisa mudar novamente
- Viola ADR-004: "distributeL3 recebe scores normalizáveis"

**Rejeitada:** O L3 deve receber scores já resolvidos, não decidir qual score usar.

### A2: Computed column no banco

```sql
ALTER TABLE assets ADD COLUMN effective_weight NUMERIC
  GENERATED ALWAYS AS (
    CASE WHEN weight_mode = 'manual' THEN manual_weight
    ELSE (SELECT total_score FROM asset_scores WHERE asset_id = assets.id LIMIT 1)
    END
  ) STORED;
```

**Prós:** Resolução centralizada no DB, impossível esquecer.
**Contras:**
- Computed columns não suportam subqueries em Postgres (`GENERATED ALWAYS AS` não permite `SELECT`)
- Alternativa com VIEW ou trigger adiciona complexidade
- Acoplamento DB ↔ lógica de negócio (dificulta testes)

**Rejeitada:** Limitação técnica do Postgres (computed column não suporta subquery).

### A3: Enum como tipo Postgres em vez de TEXT CHECK

```sql
CREATE TYPE weight_mode_t AS ENUM ('manual', 'questionnaire');
ALTER TABLE assets ADD COLUMN weight_mode weight_mode_t NOT NULL DEFAULT 'questionnaire';
```

**Prós:** Type-safe no DB, menor storage.
**Contras:**
- Postgres enums são difíceis de modificar (`ALTER TYPE ... ADD VALUE` requer migration cuidadosa)
- `TEXT CHECK` é mais flexível para adicionar valores futuros
- Supabase client retorna TEXT de qualquer forma
- Diferença de storage é negligível (~200 rows)

**Rejeitada:** `TEXT CHECK` é mais pragmático para o contexto e mais fácil de evoluir.

### A4: Terceira coluna `effective_score` sincronizada por trigger

```sql
CREATE TRIGGER sync_effective_score
  BEFORE INSERT OR UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION compute_effective_score();
```

**Prós:** Dado sempre consistente no DB.
**Contras:**
- Trigger precisa acessar `asset_scores` (cross-table dependency)
- Se `asset_scores` atualizar, precisa de trigger reverso para re-computar
- Complexidade de manutenção de triggers bidirecionais
- Desnecessário quando o data layer resolve em uma linha de código

**Rejeitada:** Complexidade desproporcional ao benefício.

**Escolhida: Resolução no data layer** — o campo `L3AssetInput.score` é populado com o valor correto antes de entrar no algoritmo, mantendo o L3 puro e agnóstico à origem do peso.
