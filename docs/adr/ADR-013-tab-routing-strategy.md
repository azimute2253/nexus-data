# ADR-013: Roteamento/URL das Tabs (Query Params)

| Campo | Valor |
|-------|-------|
| Status | Proposed |
| Data | 2026-03-23 |
| Autor | @architect (Aria) |
| PRD | docs/PRD-v2.md — F-026 (Tabs Dashboard/Aportes/Ativos) |
| Relacionados | ADR-001 (Embedded in azimute-blog), ADR-006 (Frontend Architecture), ADR-016 (Onboarding Flow) |
| Atualizado | 2026-03-23 — Adicionada decisão da URL base (F-027) |

---

## Contexto

O PRD V2 substitui as tabs V1 (Overview | Detalhes | Rebalancear) por novas tabs organizadas por intenção: **Dashboard | Aportes | Ativos**. O requisito F-026 AC4 exige: _"Tab ativa é refletida na URL (ex: `/nexus?tab=aportes` ou via query param) para deep-linking"_.

O Nexus Data está embedded no azimute-blog (ADR-001) sob a rota `/dashboard/portfolio/`. A questão é como representar a tab ativa na URL.

### Opções

1. **Query param:** `/dashboard/portfolio?tab=aportes`
2. **Path segment:** `/dashboard/portfolio/aportes`
3. **Hash fragment:** `/dashboard/portfolio#aportes`
4. **Client-only state:** Sem reflexo na URL

---

## Decisão

Usar **query parameter `?tab=`** para representar a tab ativa na URL.

### Formato

```
/dashboard/portfolio              → Dashboard (default)
/dashboard/portfolio?tab=dashboard → Dashboard (explícito)
/dashboard/portfolio?tab=aportes   → Aportes
/dashboard/portfolio?tab=ativos    → Ativos
```

### Valores válidos

```typescript
type TabId = 'dashboard' | 'aportes' | 'ativos';
const DEFAULT_TAB: TabId = 'dashboard';
```

### Comportamento

| Cenário | Resultado |
|---------|-----------|
| URL sem `?tab` | Tab Dashboard (default) |
| `?tab=aportes` | Tab Aportes |
| `?tab=invalido` | Tab Dashboard (fallback silencioso) |
| Clicar em tab | `history.replaceState` atualiza URL sem reload |
| Deep-link compartilhado | Abre direto na tab correta |
| Refresh da página (F5) | Mantém tab ativa via query param |

### Implementação no Astro + React

```
1. Astro page (frontmatter): lê searchParams.get('tab') → passa como prop para React island
2. React island: usa prop como initial state do tab
3. Ao trocar tab: history.replaceState() atualiza URL (sem navigation, sem re-render do Astro)
4. TabNavigation.tsx: atualiza labels (Dashboard | Aportes | Ativos) e handler de click
```

`replaceState` é preferido sobre `pushState` para tabs — navegar entre tabs não deve criar entradas no histórico do browser (back button volta para a página anterior, não para a tab anterior).

---

## Decisão Complementar: URL Base — Manter `/dashboard/portfolio`

### Contexto

O Creative V2 sugere URL base `/nexus` (ou manter `/dashboard`) e o PRD V2 (F-027 AC5) delega a decisão ao @architect: _"URLs podem usar `/nexus` ou manter `/dashboard/portfolio` (decisão técnica delegada ao @architect) — o importante é o label visível"_.

### Opções Avaliadas

| Opção | URL Resultante | Impacto |
|-------|---------------|---------|
| A: Manter `/dashboard/portfolio` | `/dashboard/portfolio?tab=aportes` | Zero alteração no routing |
| B: Migrar para `/nexus` | `/nexus?tab=aportes` | Nova rota, redirect de legacy |
| C: Migrar para `/dashboard/nexus` | `/dashboard/nexus?tab=aportes` | Nova rota dentro da árvore existente |

### Decisão: Opção A — Manter `/dashboard/portfolio`

A URL base permanece **`/dashboard/portfolio`**. O label visível no menu, títulos e breadcrumbs muda para "Nexus Data" (F-027), mas a rota interna não muda.

### Justificativa

1. **Zero custo de migração de rota.** O azimute-blog já tem toda a infraestrutura de routing sob `/dashboard/`: middleware de auth, layout de área de membros, sidebar navigation. A rota `/dashboard/portfolio` já existe e funciona. Criar `/nexus` exigiria:
   - Novo arquivo `src/pages/nexus.astro` (ou `src/pages/nexus/index.astro`)
   - Atualização do middleware de auth para proteger `/nexus` (hoje só protege `/dashboard/*`)
   - Redirect 301 de `/dashboard/portfolio` → `/nexus` para não quebrar bookmarks
   - Atualização de todos os links internos do azimute-blog (sidebar, breadcrumbs)

2. **Dissociação entre URL técnica e label de produto.** A URL é um identificador técnico consumido pelo browser e pelo router. O label é o que o usuário vê. O PRD V2 (F-027) exige que o label visível seja "Nexus Data" — não que a URL mude. Muitos produtos mantêm slugs legacy em URLs enquanto o branding evolui (ex: Twitter/X manteve twitter.com por anos após rebrand).

3. **Auth middleware intacto.** O azimute-blog protege `/dashboard/*` com middleware de autenticação. Se a rota migrasse para `/nexus`, seria necessário atualizar o middleware para incluir `/nexus` — uma alteração no azimute-blog, fora do escopo do nexus-data (ADR-001 boundary).

4. **Consistência com ADR-001.** A decisão de embedding (ADR-001, Accepted) define que Nexus Data vive sob `src/pages/dashboard/portfolio/` no azimute-blog. Mover para `/nexus` contradiz essa decisão aceita sem benefício proporcional. Se no futuro o Nexus Data for extraído para standalone (cenário previsto no ADR-001), aí sim `/nexus` faria sentido como rota primária.

5. **SEO irrelevante.** O Nexus Data está atrás de auth (área de membros). URLs não são indexadas por search engines. O argumento de que `/nexus` é "mais limpo" que `/dashboard/portfolio` não tem impacto prático.

### URLs Definitivas

```
/dashboard/portfolio                → Dashboard (default, sem ?tab)
/dashboard/portfolio?tab=dashboard  → Dashboard (explícito)
/dashboard/portfolio?tab=aportes    → Aportes
/dashboard/portfolio?tab=ativos     → Ativos
```

### Consequências da Decisão de URL

**Positivas:**
- Zero alteração no routing existente do azimute-blog
- Middleware de auth continua protegendo toda a árvore `/dashboard/*` sem mudanças
- Bookmarks existentes continuam funcionando
- Nenhum redirect (301/302) para gerenciar

**Negativas:**
- URL não reflete o rebrand para "Nexus Data" (slug permanece `portfolio`)
  - **Aceitável:** URL é técnica, label é visual; PRD aceita ambas as opções
- Se no futuro outro módulo usar `portfolio` na URL, haverá ambiguidade
  - **Improvável:** nexus-data é o único módulo de portfólio no azimute.cc

**Quando revisitar:**
- Se o Nexus Data for extraído para standalone (ADR-001 prevê essa possibilidade)
- Se um segundo módulo de portfólio for adicionado ao azimute.cc (improvável per PRD)

---

## Consequências

### Positivas

- Deep-linking funciona (copiar URL com `?tab=aportes` abre na tab certa)
- Refresh da página preserva tab ativa
- Sem necessidade de novas rotas no Astro (mantém uma única page `.astro`)
- Compatível com a arquitetura embedded (ADR-001) — não requer file-based routing adicional
- F-026 AC6 "dados em cache, sem re-fetch a cada switch" é natural: troca de tab é client-side
- `replaceState` evita poluição do histórico do browser

### Negativas

- Tab ativa não é visível no server durante SSR (Astro pode ler `searchParams`, mas React hydration pode causar flash)
  - **Mitigado:** Astro lê `?tab` no frontmatter e passa como prop, evitando mismatch
- Query params são menos "bonitos" que path segments (`/aportes` vs `?tab=aportes`)
  - **Aceitável:** tabs são sub-estados de uma página, não páginas distintas

---

## Alternativas Consideradas

### A1: Path segments (`/dashboard/portfolio/aportes`)

**Prós:** URLs mais limpas, SEO-friendly, padrão em SPAs.
**Contras:**
- Requer 3 arquivos `.astro` separados (ou dynamic route `[tab].astro`) — multiplica pontos de manutenção
- Cada "página" de tab seria um full page navigation no Astro (não é SPA) — viola F-026 AC6 "transição instantânea sem re-fetch"
- Astro faz SSR completo por rota, o que significa re-fetch de dados a cada troca de tab
- Incompatível com a arquitetura de React islands (ADR-006) onde as tabs são client-side

**Rejeitada:** Conflita com a arquitetura Astro islands — cada path segment seria uma page navigation completa, destruindo a experiência de tabs instantâneas.

### A2: Hash fragment (`#aportes`)

**Prós:** Simples, não causa page reload, não enviado ao servidor.
**Contras:**
- Não acessível no Astro frontmatter (hash fragments não são enviados ao server)
- Não aparece em analytics de URL
- Convenção de hash é para scroll-to-element, não para estado de UI

**Rejeitada:** Servidor não tem acesso ao hash, impossibilitando SSR condicional.

### A3: Client-only state (sem reflexo na URL)

**Prós:** Implementação trivial (useState no React).
**Contras:**
- Refresh da página reseta para Dashboard
- Impossível deep-link para uma tab específica
- Viola F-026 AC4 ("tab ativa refletida na URL")

**Rejeitada:** Não atende ao requisito do PRD.

### A4: Combinar `?tab` com `?wallet`

Colocar wallet_id também na URL: `/dashboard/portfolio?wallet=uuid&tab=aportes`.

**Prós:** Totalmente stateless, shareable.
**Contras:** wallet_id é um UUID longo (poluição da URL), wallet persistence já está resolvida via localStorage (ADR-012), e expor wallet UUID na URL é um information leak desnecessário.

**Rejeitada:** localStorage é suficiente para wallet (ADR-012); query param reservado apenas para tab.

**Escolhida: Query param `?tab=`** — equilíbrio entre deep-linking, simplicidade, e compatibilidade com Astro islands.
