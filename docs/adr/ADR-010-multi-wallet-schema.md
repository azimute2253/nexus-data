# ADR-010: Schema Multi-Carteira (Wallets)

| Campo | Valor |
|-------|-------|
| Status | Proposed |
| Data | 2026-03-23 |
| Autor | @architect (Aria) |
| PRD | docs/PRD-v2.md — F-022 |
| Relacionados | ADR-002 (Supabase/Postgres), ADR-007 (Auth/RLS) |

---

## Contexto

O Nexus Data V1 assume um modelo single-wallet implícito: cada `user_id` tem exatamente um conjunto de dados (asset_types, asset_groups, assets, scores, contributions). O PRD V2 introduz multi-carteira (F-022), permitindo que um usuário crie N carteiras independentes. Isso requer uma nova entidade `wallets` como pivot entre o usuário e seus dados de portfólio, com `wallet_id` propagado para todas as tabelas de dados.

### Schema V1 atual (relevante)

- 6 tabelas com `user_id`: `asset_types`, `asset_groups`, `assets`, `questionnaires`, `asset_scores`, `contributions`
- 3 tabelas globais sem `user_id` semântico: `price_cache`, `exchange_rates`, `price_refresh_log`
- 1 tabela de config: `feature_flags` (sem RLS)
- UNIQUE constraint: `assets(ticker, user_id)` — impede ticker duplicado por usuário
- UNIQUE constraint: `asset_groups(type_id, name, user_id)` — impede grupo duplicado

---

## Decisão

Criar tabela `wallets` como entidade pivot e adicionar `wallet_id UUID` a todas as 6 tabelas de dados do usuário.

### Tabela `wallets`

```sql
CREATE TABLE wallets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Tabelas que recebem `wallet_id`

| Tabela | FK | Cascade |
|--------|----|---------|
| `asset_types` | `REFERENCES wallets(id) ON DELETE CASCADE` | Sim |
| `asset_groups` | `REFERENCES wallets(id) ON DELETE CASCADE` | Sim |
| `assets` | `REFERENCES wallets(id) ON DELETE CASCADE` | Sim |
| `questionnaires` | `REFERENCES wallets(id) ON DELETE CASCADE` | Sim |
| `asset_scores` | `REFERENCES wallets(id) ON DELETE CASCADE` | Sim |
| `contributions` | `REFERENCES wallets(id) ON DELETE CASCADE` | Sim |

### Tabelas que NÃO recebem `wallet_id`

| Tabela | Motivo |
|--------|--------|
| `price_cache` | Preços são globais — mesmo ticker compartilha preço entre carteiras |
| `exchange_rates` | Taxas de câmbio são globais |
| `price_refresh_log` | Log de refresh é por usuário, não por carteira |
| `feature_flags` | Config global do sistema |

### UNIQUE constraints atualizadas

| Tabela | V1 | V2 |
|--------|----|----|
| `assets` | `(ticker, user_id)` | `(ticker, wallet_id)` |
| `asset_groups` | `(type_id, name, user_id)` | `(type_id, name, wallet_id)` |
| `asset_scores` | `(asset_id, questionnaire_id)` | Sem alteração (asset_id já é scoped por wallet) |

### Índices compostos novos

```sql
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_asset_types_wallet_id ON asset_types(wallet_id);
CREATE INDEX idx_asset_groups_wallet_id ON asset_groups(wallet_id);
CREATE INDEX idx_assets_wallet_id ON assets(wallet_id);
```

### Impacto na view `portfolio_summary`

A view deve ser recriada com `wallet_id` como coluna de output e filtro. O JOIN com `wallets` permite que RLS funcione via `user_id` da tabela wallets.

---

## Consequências

### Positivas

- Usuários podem manter carteiras separadas (ex: "Aposentadoria", "Emergência", "Especulação")
- `ON DELETE CASCADE` garante limpeza completa ao deletar carteira
- Preços compartilhados entre carteiras evitam chamadas duplicadas de API
- Modelo é extensível para compartilhamento futuro (não no escopo V2)

### Negativas

- Todas as queries do data layer precisam adicionar filtro `wallet_id`
- Migration complexa para dados existentes (ver ADR-011)
- View `portfolio_summary` precisa ser recriada
- Aumento marginal no tamanho de storage (1 UUID por row em 6 tabelas)

### Riscos

- Esquecer o filtro `wallet_id` em alguma query causa vazamento de dados entre carteiras
  - **Mitigação:** RLS por `wallet_id` (ver ADR-014) como segunda camada de defesa

---

## Alternativas Consideradas

### A1: Namespace por prefixo no `user_id`

Usar `user_id:wallet_name` como chave composta. Rejeitada: quebra a FK com `auth.users`, impossibilita RLS nativo, e é um hack não-relacional.

### A2: Schema separation (um schema Postgres por carteira)

Criar schemas dinâmicos (`wallet_abc123.*`). Rejeitada: complexidade operacional extrema, incompatível com Supabase free tier, RLS não funciona cross-schema, e migrations ficam ingerenciáveis.

### A3: JSONB monolítico por carteira

Armazenar toda a carteira como um documento JSONB. Rejeitada: perde todas as vantagens do modelo relacional (queries, indexes, constraints, joins com price_cache), e o schema já está bem normalizado.

### A4: Tabela separada por tipo de dado por carteira

Criar `asset_types_wallet_1`, `asset_types_wallet_2`, etc. Rejeitada: antipadrão clássico (Entity-Attribute-Value dinâmico), impossibilita queries cross-wallet e migrations.

**Escolhida: Tabela pivot `wallets` + FK `wallet_id`** — abordagem relacional padrão, compatível com RLS, migrations incrementais, e o modelo existente.
