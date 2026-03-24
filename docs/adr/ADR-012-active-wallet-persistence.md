# ADR-012: Persistência de Carteira Ativa (localStorage)

| Campo | Valor |
|-------|-------|
| Status | Proposed |
| Data | 2026-03-23 |
| Autor | @architect (Aria) |
| PRD | docs/PRD-v2.md — F-023 (Seletor de Carteiras) |
| Relacionados | ADR-010 (Multi-Wallet Schema), ADR-006 (Frontend Architecture), ADR-009 (Auth Client) |

---

## Contexto

Com multi-carteira (ADR-010), o sistema precisa "lembrar" qual carteira está ativa quando o usuário navega entre páginas ou retorna em sessões futuras. O PRD V2 (F-023, AC3) especifica: _"Carteira ativa é persistida em `localStorage` para manter seleção entre sessões"_.

As opções são:

1. **localStorage** (client-side) — simples, especificado no PRD
2. **Server-side** (coluna `active_wallet_id` em tabela de user preferences) — mais robusto, cross-device
3. **Cookie** — server-side readable, mas overhead de round-trip
4. **URL state** — stateless, mas perde contexto entre navegações

### Constraints do Nexus Data

- Single-user (apenas o owner usa o sistema)
- Embedded no azimute-blog (Astro islands, não SPA)
- nexus-data é uma library (sem acesso a HTTP context — ADR-009)
- Astro pages fazem server-side data fetching no frontmatter

---

## Decisão

Usar **`localStorage`** para persistir o `wallet_id` da carteira ativa, com **guard server-side** como fallback.

### Implementação

```
Chave: nexus_active_wallet_id
Valor: UUID string (ex: "a1b2c3d4-...")
Escopo: por browser/dispositivo
```

### Fluxo de resolução da carteira ativa

```
1. Client lê localStorage("nexus_active_wallet_id")
2. Se existe e é válido (UUID da carteira do usuário) → usar
3. Se não existe OU UUID inválido/de outro usuário:
   a. Query: SELECT id FROM wallets WHERE user_id = auth.uid() ORDER BY created_at LIMIT 1
   b. Se retorna resultado → usar essa wallet, salvar no localStorage
   c. Se 0 rows → redirecionar para onboarding (F-025)
4. Ao trocar carteira no seletor → atualizar localStorage
5. Ao criar nova carteira → atualizar localStorage com a nova
6. Ao deletar a carteira ativa → limpar localStorage, resolver novamente (step 3)
```

### Guard server-side (Astro frontmatter)

O server não lê localStorage (inacessível no SSR). O guard funciona assim:

```
1. Astro frontmatter: query wallets WHERE user_id = auth.uid()
2. Se 0 wallets → renderizar onboarding
3. Se ≥ 1 wallet → renderizar app normalmente (client resolve qual é a ativa)
4. Passar lista de wallets como prop para o React island
```

O guard server-side NÃO decide qual carteira é a ativa — apenas verifica se o usuário TEM carteiras. A resolução da carteira ativa é responsabilidade do client.

### Invalidação

| Evento | Ação |
|--------|------|
| Carteira deletada | Limpar localStorage, fallback para primeira carteira |
| Logout | Não limpar (localStorage persiste; na próxima sessão, UUID será revalidado) |
| Outro usuário no mesmo browser | UUID será inválido para o novo user → fallback automático |

---

## Consequências

### Positivas

- Zero latência para resolver carteira ativa (localStorage é síncrono)
- Sem coluna adicional no banco (nenhuma migration extra)
- Alinhado com o PRD V2 (F-023 AC3 especifica localStorage)
- nexus-data (library) não precisa de acesso HTTP — mantém ADR-009
- Funciona offline (localStorage persiste mesmo sem conexão)

### Negativas

- Não sincroniza entre dispositivos (mobile e desktop podem ter carteiras ativas diferentes)
  - **Aceitável:** single-user, uso primário em um dispositivo
- localStorage pode ser limpo pelo browser (modo privado, limpeza de cache)
  - **Mitigado:** fallback para primeira carteira via query
- Server-side rendering não sabe qual carteira é a ativa (FOUC possível)
  - **Mitigado:** renderizar skeleton/loading enquanto client resolve; dados são fetched client-side via React island

---

## Alternativas Consideradas

### A1: Coluna `active_wallet_id` na tabela de user preferences

```sql
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  active_wallet_id UUID REFERENCES wallets(id)
);
```

**Prós:** Cross-device, server-readable.
**Contras:** Requer migration extra, query adicional em cada page load, nexus-data precisaria de write access a uma tabela de preferences, e overkill para single-user.

**Rejeitada:** Complexidade desproporcional ao benefício para um sistema single-user.

### A2: Cookie (`nexus_wallet_id`)

**Prós:** Readable no server (Astro frontmatter), persiste entre sessões.
**Contras:** nexus-data é library sem acesso a HTTP context (ADR-009), cookie management é responsabilidade do azimute-blog, e adiciona coupling desnecessário.

**Rejeitada:** Viola a boundary da ADR-009 — nexus-data não deve gerenciar cookies.

### A3: URL state (query param `?wallet=UUID`)

**Prós:** Stateless, bookmarkable, server-readable.
**Contras:** Poluição da URL, exige passar wallet_id em todos os links internos, perde o estado ao navegar para páginas fora do Nexus Data e voltar.

**Rejeitada:** Péssima UX — requer manutenção do param em todas as navegações.

### A4: sessionStorage

**Prós:** Scoped por tab.
**Contras:** Não persiste entre sessões (contradiz F-023 AC3 "manter seleção entre sessões"), e se o usuário abre nova tab, perde a seleção.

**Rejeitada:** Não atende ao requisito de persistência entre sessões.

**Escolhida: localStorage com guard server-side** — mais simples, alinhada ao PRD, e adequada para o contexto single-user do Nexus Data.
