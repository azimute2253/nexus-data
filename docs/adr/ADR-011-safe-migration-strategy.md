# ADR-011: Estratégia de Migration Segura (Backward-Compatible)

| Campo | Valor |
|-------|-------|
| Status | Proposed |
| Data | 2026-03-23 |
| Autor | @architect (Aria) |
| PRD | docs/PRD-v2.md — F-022 (Migration Strategy) |
| Relacionados | ADR-010 (Multi-Wallet Schema), ADR-002 (Supabase/Postgres), ADR-008 (Data Migration) |

---

## Contexto

A introdução de multi-carteira (ADR-010) requer adicionar `wallet_id` a 6 tabelas que já contêm dados de produção (~131 assets, 10 asset_types, ~30 asset_groups, questionnaires, scores, contributions). A migration deve:

1. Preservar 100% dos dados existentes (zero data loss)
2. Ser backward-compatible durante o rollout (V1 code pode coexistir brevemente)
3. Ser executável em Supabase free tier (sem downtime prolongado)
4. Ser revertível em caso de falha

O schema atual tem 14 migrations (001-014). A sequência V2 continua a partir de 015.

---

## Decisão

Adotar estratégia de **migration em 5 passos atômicos**, cada um como arquivo SQL separado em `supabase/migrations/`. Cada passo é independentemente revertível e o sistema permanece funcional entre passos.

### Passo 1 — `015_create_wallets_table.sql`

```
Criar tabela wallets com RLS.
Estado após: wallets existe mas está vazia. Tabelas existentes inalteradas.
Rollback: DROP TABLE wallets;
```

### Passo 2 — `016_add_wallet_id_nullable.sql`

```
ALTER TABLE asset_types ADD COLUMN wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE;
ALTER TABLE asset_groups ADD COLUMN wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE;
ALTER TABLE assets ADD COLUMN wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE;
ALTER TABLE questionnaires ADD COLUMN wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE;
ALTER TABLE asset_scores ADD COLUMN wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE;
ALTER TABLE contributions ADD COLUMN wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE;

wallet_id é NULLABLE neste passo — backward-compatible com código V1.
Estado após: colunas existem mas são NULL. Código V1 funciona normalmente.
Rollback: ALTER TABLE ... DROP COLUMN wallet_id; (para cada tabela)
```

### Passo 3 — `017_backfill_wallets.sql`

```
Para cada user_id distinto nas tabelas existentes:
1. INSERT INTO wallets (user_id, name) VALUES (uid, 'Minha Carteira');
2. UPDATE asset_types SET wallet_id = (SELECT id FROM wallets WHERE user_id = asset_types.user_id LIMIT 1) WHERE wallet_id IS NULL;
3. Repetir para asset_groups, assets, questionnaires, asset_scores, contributions.

Estado após: wallet_id populado em todos os registros. Nenhum NULL restante.
Rollback: DELETE FROM wallets; UPDATE ... SET wallet_id = NULL;
```

### Passo 4 — `018_enforce_wallet_id_not_null.sql`

```
ALTER TABLE asset_types ALTER COLUMN wallet_id SET NOT NULL;
(repetir para todas as 6 tabelas)

DROP CONSTRAINT assets_ticker_user_unique;
ADD CONSTRAINT assets_ticker_wallet_unique UNIQUE (ticker, wallet_id);

DROP CONSTRAINT asset_groups_name_type_user_unique;
ADD CONSTRAINT asset_groups_name_type_wallet_unique UNIQUE (type_id, name, wallet_id);

CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_asset_types_wallet_id ON asset_types(wallet_id);
(etc.)

Estado após: schema completo V2. wallet_id é NOT NULL em todas as tabelas.
Rollback: reverter constraints, tornar nullable novamente.
```

### Passo 5 — `019_add_weight_mode_columns.sql`

```
ALTER TABLE assets ADD COLUMN weight_mode TEXT NOT NULL DEFAULT 'questionnaire'
  CHECK (weight_mode IN ('manual', 'questionnaire'));
ALTER TABLE assets ADD COLUMN manual_weight NUMERIC DEFAULT 0
  CHECK (manual_weight >= -10 AND manual_weight <= 11);

Estado após: peso dual disponível. Todos os ativos existentes ficam com weight_mode='questionnaire'.
Rollback: ALTER TABLE assets DROP COLUMN weight_mode, DROP COLUMN manual_weight;
```

### Princípios da estratégia

1. **Nullable first, NOT NULL after backfill** — evita erros de constraint durante a transição
2. **Cada migration é um arquivo separado** — falha em um passo não contamina os anteriores
3. **Backfill idempotente** — pode ser re-executado sem duplicar wallets (usar `INSERT ... ON CONFLICT DO NOTHING` ou guard com `WHERE NOT EXISTS`)
4. **View recriada no passo 4** — `portfolio_summary` precisa de `CREATE OR REPLACE` com `wallet_id`
5. **RLS policies atualizadas no passo 4** — novas policies incluem `wallet_id` (ver ADR-014)

---

## Consequências

### Positivas

- Zero downtime: cada passo leva < 1 segundo em ~200 rows
- Backward-compatible: entre passos 2 e 3, código V1 funciona (wallet_id é NULL mas não é usado)
- Revertível: cada passo tem rollback claro
- Dados preservados: backfill não modifica dados existentes, apenas adiciona wallet_id
- Testável: pode ser executado em staging com dump de produção antes de aplicar em prod

### Negativas

- 5 arquivos de migration em vez de 1 — mais verboso
- Janela entre passo 2 e 4 onde wallet_id é nullable (constraint relaxada temporariamente)
- View `portfolio_summary` fica inconsistente entre passos 3 e 4 (recriada no 4)

### Riscos

- **Backfill falha no meio** — dados ficam parcialmente atualizados
  - Mitigação: envolver backfill em transação (`BEGIN; ... COMMIT;`)
- **user_id com dados em múltiplas tabelas mas sem wallet** — edge case se algum user_id não tiver registros em todas as tabelas
  - Mitigação: criar wallet baseado em UNION de DISTINCT user_id de TODAS as tabelas

---

## Alternativas Consideradas

### A1: Migration única (big bang)

Um único arquivo SQL com todas as alterações. Rejeitada: impossível reverter parcialmente, risco de timeout em Supabase free tier (embora o dataset seja pequeno), e dificulta debugging se algo falhar.

### A2: Dual-write (código V1 e V2 coexistem)

Manter código V1 e V2 em paralelo, com feature flag controlando qual path é usado. Rejeitada: complexidade de manter dois data layers, risco de inconsistência entre eles, e desnecessária para um produto single-user.

### A3: Export/Import (dump → transform → reimport)

Exportar todos os dados, transformar offline, dropar tabelas, recriar com novo schema, reimportar. Rejeitada: risco de data loss durante o processo, downtime obrigatório, e desnecessária quando ALTER TABLE + backfill resolve.

### A4: Migrations online com pg_repack ou similar

Ferramentas de migration sem downtime. Rejeitada: indisponível no Supabase free tier, e overkill para ~200 rows.

**Escolhida: 5 passos atômicos com nullable-first** — abordagem mais segura para o contexto (dataset pequeno, single-user, Supabase free tier).
