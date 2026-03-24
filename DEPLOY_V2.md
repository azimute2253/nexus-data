# Deploy V2 — Nexus Data (Layers 0-1)

**Stories:** 10.1, 11.1, 11.2  
**Data:** 2026-03-24  
**Status:** Pronto para produção

---

## ✅ O que foi implementado

| Story | Descrição | Status |
|-------|-----------|--------|
| 10.1 | Fix `/api/asset-types` HTTP 500 | ✅ Testado (12/12) |
| 11.1 | Create `wallets` table + RLS | ✅ Testado (19/19) |
| 11.2 | Add `wallet_id` FK to 6 tables | ✅ Testado (49/49) |

**Cobertura total:** 773/773 testes passando

---

## 📋 Checklist de Deploy

### 1. Backup (OBRIGATÓRIO)

No Supabase Dashboard:
- Database → Settings → Backups → Create backup
- Anote o timestamp do backup

### 2. Executar Migração

**Opção A: Supabase SQL Editor (recomendado)**

1. Abra o Supabase Dashboard → SQL Editor
2. Cole todo o conteúdo de `supabase/migrations/DEPLOY_V2_LAYER_0-1.sql`
3. Clique em "Run"
4. Aguarde mensagem de sucesso

**Opção B: Supabase CLI**

```bash
cd ~/Projects/nexus-data
supabase db push
```

### 3. Validação Pós-Migração

No SQL Editor, execute:

```sql
-- ✅ Verifica se wallets existe
SELECT COUNT(*) as total_wallets FROM wallets;

-- ✅ Verifica se wallet_id foi populado (deve retornar 0 em todas)
SELECT COUNT(*) FROM asset_types WHERE wallet_id IS NULL;
SELECT COUNT(*) FROM asset_groups WHERE wallet_id IS NULL;
SELECT COUNT(*) FROM assets WHERE wallet_id IS NULL;
SELECT COUNT(*) FROM questionnaires WHERE wallet_id IS NULL;
SELECT COUNT(*) FROM asset_scores WHERE wallet_id IS NULL;
SELECT COUNT(*) FROM contributions WHERE wallet_id IS NULL;

-- ✅ Lista wallets criadas
SELECT user_id, name, created_at FROM wallets ORDER BY created_at;
```

**Resultado esperado:**
- `total_wallets` > 0 (se já houver usuários com dados)
- Todas as contagens de `NULL` devem ser **0**
- Cada usuário com dados tem uma wallet "Minha Carteira"

### 4. Deploy do Código (se aplicável)

**Se o blog está consumindo o pacote nexus-data:**

```bash
cd ~/Projects/azimute-blog
npm update nexus-data  # ou reinstalar
vercel --prod
```

**Se o código está inline no blog:**
- Copie `src/lib/nexus/types.ts` atualizado
- Copie `supabase/functions/asset-types/index.ts` atualizado

### 5. Teste Manual em Produção

1. Acesse `/dashboard/portfolio` (ou rota do Nexus)
2. ✅ `/api/asset-types` não deve retornar 500
3. ✅ Lista de tipos deve carregar
4. ✅ Cadastro de ativos deve funcionar

---

## 🔄 Rollback (se necessário)

**Se algo der errado:**

1. Restaure o backup no Supabase Dashboard
2. OU execute este SQL:

```sql
BEGIN;

-- Remove constraints
ALTER TABLE asset_types DROP CONSTRAINT IF EXISTS asset_types_user_wallet_name_unique;
ALTER TABLE asset_groups DROP CONSTRAINT IF EXISTS asset_groups_type_wallet_name_unique;
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_ticker_user_wallet_unique;
ALTER TABLE asset_scores DROP CONSTRAINT IF EXISTS asset_scores_asset_questionnaire_wallet_unique;

-- Drop wallet_id columns
ALTER TABLE asset_types DROP COLUMN IF EXISTS wallet_id;
ALTER TABLE asset_groups DROP COLUMN IF EXISTS wallet_id;
ALTER TABLE assets DROP COLUMN IF EXISTS wallet_id;
ALTER TABLE questionnaires DROP COLUMN IF EXISTS wallet_id;
ALTER TABLE asset_scores DROP COLUMN IF EXISTS wallet_id;
ALTER TABLE contributions DROP COLUMN IF EXISTS wallet_id;

-- Drop wallets table
DROP TABLE IF EXISTS wallets CASCADE;

COMMIT;
```

---

## 🚨 Problemas Conhecidos

**Nenhum.** Todas as validações passaram.

---

## 📊 O que testar após deploy

### ✅ Funcionando agora:
- `/api/asset-types` GET (200 em vez de 500)
- Tabela `wallets` existe
- Todos os dados têm `wallet_id` associado

### ❌ Ainda NÃO funciona (Layers 2-5):
- Seletor de wallets no UI (precisa 12.1)
- CRUD de wallets (precisa 11.3)
- Tabs Dashboard/Aportes/Ativos (precisa 13.1)
- Dual weight UI (precisa 14.2)

---

## 📞 Suporte

Se encontrar problemas:
1. Verifique logs do Supabase (Dashboard → Logs)
2. Execute queries de validação acima
3. Se necessário, faça rollback e reporte

---

**Última atualização:** 2026-03-24 11:03 GMT-4
