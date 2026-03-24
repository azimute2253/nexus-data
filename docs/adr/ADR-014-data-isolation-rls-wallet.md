# ADR-014: Isolamento de Dados (RLS por user_id + wallet_id)

| Campo | Valor |
|-------|-------|
| Status | Proposed |
| Data | 2026-03-23 |
| Autor | @architect (Aria) |
| PRD | docs/PRD-v2.md — F-022 (Isolamento de Dados) |
| Relacionados | ADR-002 (Supabase/Postgres), ADR-007 (Auth/RLS), ADR-010 (Multi-Wallet Schema) |

---

## Contexto

O schema V1 usa RLS com policy `auth.uid() = user_id` em todas as 8 tabelas de dados (ADR-007). Isso isola dados entre usuários. Com multi-carteira (ADR-010), surge a questão: como isolar dados entre carteiras do mesmo usuário?

O PRD V2 define: _"RLS existente por `user_id` se mantém; queries adicionam filtro por `wallet_id` dentro do escopo do usuário autenticado"_ (F-022).

### Opções de isolamento

1. **RLS apenas por user_id** (V1) + filtro por `wallet_id` no application layer
2. **RLS por user_id + wallet_id** via JOIN com `wallets`
3. **RLS apenas por wallet_id** (user_id implícito via wallets)
4. **RLS por user_id** + Postgres policies com variável de sessão para wallet_id

---

## Decisão

Adotar **estratégia de duas camadas**: RLS por `user_id` no banco (defesa em profundidade) + filtro por `wallet_id` no application layer (data functions do nexus-data).

### Camada 1: RLS (Database) — Isolamento por `user_id`

As policies RLS existentes permanecem inalteradas:

```sql
-- Policy padrão V1 (mantida sem alteração)
CREATE POLICY "users can select own data" ON asset_types
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users can insert own data" ON asset_types
  FOR INSERT WITH CHECK (auth.uid() = user_id);
-- (idem para UPDATE, DELETE, e demais tabelas)
```

RLS garante que um usuário NUNCA veja dados de outro usuário, independente de bugs no application layer.

### Camada 2: Application Layer — Filtro por `wallet_id`

Todas as data functions em `src/lib/nexus/` adicionam `wallet_id` como parâmetro obrigatório:

```typescript
// V1: fetchAssetTypes(supabase)
// V2: fetchAssetTypes(supabase, walletId)

export async function fetchAssetTypes(supabase: SupabaseClient, walletId: string) {
  return supabase
    .from('asset_types')
    .select('*')
    .eq('wallet_id', walletId)    // ← filtro V2
    .order('sort_order');
}
```

### Por que NÃO usar RLS para wallet_id?

1. **wallet_id não está disponível no contexto RLS** — `auth.uid()` retorna o user_id do JWT, mas não existe equivalente nativo para wallet_id. Para usar wallet_id em RLS, seria necessário injetar via `SET LOCAL` ou custom claim, o que adiciona complexidade sem benefício proporcional.

2. **Risco nulo de cross-user leak** — RLS por user_id já impede que dados de um usuário sejam acessíveis por outro. O filtro por wallet_id isola carteiras do MESMO usuário — um "leak" entre carteiras próprias é inconveniente, mas não uma vulnerabilidade de segurança.

3. **Single-user na prática** — o Nexus Data tem um único usuário (o owner). Multi-carteira é uma feature de organização pessoal, não de multi-tenancy.

### Tabela de isolamento

| Tabela | RLS (user_id) | App filter (wallet_id) | Notas |
|--------|:---:|:---:|-------|
| `wallets` | auth.uid() = user_id | N/A (é a tabela base) | RLS garante que usuário só vê suas wallets |
| `asset_types` | auth.uid() = user_id | .eq('wallet_id', wid) | Dupla camada |
| `asset_groups` | auth.uid() = user_id | .eq('wallet_id', wid) | Dupla camada |
| `assets` | auth.uid() = user_id | .eq('wallet_id', wid) | Dupla camada |
| `questionnaires` | auth.uid() = user_id | .eq('wallet_id', wid) | Dupla camada |
| `asset_scores` | auth.uid() = user_id | .eq('wallet_id', wid) | Dupla camada |
| `contributions` | auth.uid() = user_id | .eq('wallet_id', wid) | Dupla camada |
| `price_cache` | auth.uid() = user_id | N/A | Global por ticker |
| `exchange_rates` | auth.uid() = user_id | N/A | Global por par |
| `price_refresh_log` | auth.uid() = user_id | N/A | Por usuário, não por wallet |
| `feature_flags` | Sem RLS | N/A | Config global |

### Novas policies para `wallets`

```sql
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can select own wallets" ON wallets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users can insert own wallets" ON wallets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users can update own wallets" ON wallets
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users can delete own wallets" ON wallets
  FOR DELETE USING (auth.uid() = user_id);
```

### Validação de wallet ownership

Antes de qualquer operação com `wallet_id`, o application layer deve validar que a wallet pertence ao usuário:

```typescript
// Centralizado em uma utility function
export async function validateWalletOwnership(
  supabase: SupabaseClient, walletId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('wallets')
    .select('id')
    .eq('id', walletId)
    .single();
  return !!data; // RLS já filtra por auth.uid()
}
```

---

## Consequências

### Positivas

- Defense-in-depth: RLS impede leak cross-user, app filter impede leak cross-wallet
- Policies RLS V1 não são modificadas — zero risco de regressão em segurança existente
- Performance: filtro `wallet_id` no application layer usa índice (ADR-010)
- Simplicidade: sem injeção de variáveis de sessão, sem custom claims no JWT

### Negativas

- Isolamento cross-wallet depende do application layer (não é enforced no DB)
  - **Aceitável:** cross-wallet leak é entre dados do mesmo usuário, não uma vulnerabilidade de segurança
- Cada data function precisa receber `wallet_id` como parâmetro — mais boilerplate
  - **Mitigado:** TypeScript enforça em compile-time (parâmetro obrigatório)
- Se um dev esquecer `.eq('wallet_id', wid)`, dados de todas as carteiras serão retornados (para o mesmo user)
  - **Mitigado:** code review, e o resultado seria dados misturados para o próprio dono (inconveniente, não inseguro)

---

## Alternativas Consideradas

### A1: RLS por wallet_id via `SET LOCAL`

```sql
-- No início de cada request:
SET LOCAL app.current_wallet_id = 'uuid-here';

-- RLS policy:
CREATE POLICY "wallet isolation" ON assets
  USING (wallet_id = current_setting('app.current_wallet_id')::uuid);
```

**Prós:** Enforcement no DB, impossível esquecer o filtro.
**Contras:**
- Requer `SET LOCAL` em cada request (nexus-data é library, não controla connections)
- Supabase client não expõe facilmente a execução de `SET LOCAL` antes de queries
- Complexidade operacional: se o `SET LOCAL` falhar ou for esquecido, RLS bloqueia tudo
- Overkill para single-user

**Rejeitada:** Complexidade alta sem benefício de segurança proporcional.

### A2: RLS com JOIN na tabela wallets

```sql
CREATE POLICY "wallet-aware select" ON assets
  USING (EXISTS (
    SELECT 1 FROM wallets WHERE wallets.id = assets.wallet_id AND wallets.user_id = auth.uid()
  ));
```

**Prós:** Enforcement no DB, elegante.
**Contras:**
- Subquery em cada operação RLS (performance penalty em tabelas grandes)
- Substituiria as policies V1 existentes (risco de regressão)
- Ainda não isola cross-wallet (apenas cross-user via wallets.user_id)
- Redundante com a policy existente `auth.uid() = user_id`

**Rejeitada:** Performance overhead sem benefício adicional sobre a abordagem atual.

### A3: Remover user_id das tabelas, usar apenas wallet_id

Remover a coluna `user_id` de todas as tabelas (já que wallet → user é transitivo). RLS via JOIN com wallets.

**Prós:** Elimina redundância (user_id + wallet_id).
**Contras:**
- Quebra todas as policies RLS V1 existentes
- Requer reescrita de todas as queries
- Remove a defesa em profundidade (se wallet table tiver bug, não há fallback)
- Migration muito mais invasiva (remover coluna NOT NULL com FK)

**Rejeitada:** Risco desproporcional; user_id como coluna redundante é um custo de storage trivial (~16 bytes por row).

**Escolhida: RLS por user_id (mantido) + filtro application-layer por wallet_id** — abordagem pragmática que mantém a segurança existente e adiciona isolamento lógico sem complexidade.
