# ADR-016: Fluxo de Onboarding (Detecção e Redirecionamento)

| Campo | Valor |
|-------|-------|
| Status | Proposed |
| Data | 2026-03-23 |
| Autor | @architect (Aria) |
| PRD | docs/PRD-v2.md — F-025 (Fluxo de Onboarding) |
| Relacionados | ADR-001 (Embedded in azimute-blog), ADR-010 (Multi-Wallet Schema), ADR-012 (Active Wallet Persistence), ADR-013 (Tab Routing), ADR-014 (Data Isolation) |

---

## Contexto

O PRD V2 (F-025) e o Creative V2 definem que um usuário sem nenhuma carteira cadastrada deve ser redirecionado para uma tela de onboarding ao acessar o Nexus Data. O onboarding exibe uma mensagem de boas-vindas e um campo para criar a primeira carteira. Após a criação, redireciona para o Dashboard vazio.

Há quatro decisões arquiteturais não cobertas pelos ADRs existentes:

1. **Onde detectar ausência de carteiras** — server-side (Astro frontmatter), client-side (React island), ou middleware de rota?
2. **Estratégia de redirect/guard** — renderização condicional na mesma página ou redirect para rota separada (`/onboarding`)?
3. **Sequência com ADR-012 (localStorage)** — o guard de onboarding executa antes ou depois do check de `nexus_active_wallet_id` no localStorage?
4. **Estado vazio pós-criação** — como o Dashboard se comporta quando a carteira existe mas não tem dados?

### Constraints

- Nexus Data está embedded no azimute-blog (ADR-001) sob `/dashboard/portfolio`
- nexus-data é uma library npm — sem acesso a HTTP context (ADR-009)
- Auth via Supabase middleware no azimute-blog — o Astro frontmatter tem acesso ao `supabase` client autenticado
- localStorage não é acessível no server (SSR) — apenas no client (ADR-012)
- O PRD V2 (Riscos §9) sugere: _"Guard no server-side (Astro frontmatter): query `wallets WHERE user_id = auth.uid()` — se 0 rows, renderiza onboarding; não depende de client state"_

---

## Decisão

### D1: Detecção server-side no Astro frontmatter (guard primário)

O Astro page no azimute-blog executa uma query no frontmatter para verificar se o usuário tem carteiras:

```astro
---
// src/pages/dashboard/portfolio.astro (no azimute-blog)
const supabase = getSupabaseClient(Astro);
const { data: { user } } = await supabase.auth.getUser();

const { data: wallets } = await supabase
  .from('wallets')
  .select('id, name')
  .eq('user_id', user.id)
  .order('created_at');

const hasWallets = wallets && wallets.length > 0;
---

{hasWallets ? (
  <NexusApp wallets={wallets} client:load />
) : (
  <OnboardingScreen client:load />
)}
```

**Por que server-side e não client-side:**

| Critério | Server-side (frontmatter) | Client-side (useEffect) |
|----------|:---:|:---:|
| Flash of wrong content | Nenhum — renderiza correto desde o início | Sim — mostra skeleton/loading, depois muda |
| Latência perceptível | 1 query (~50ms) no server antes do HTML | HTML vazio → hydrate → query → render (~300ms+) |
| Dependência de client state | Nenhuma — não depende de localStorage/JS | Depende de JS habilitado |
| Segurança | Impossível burlar (server-side) | Poderia ser bypassado desabilitando JS |

**Por que não middleware de rota:**

Middleware no Astro executa antes de TODA rota, incluindo páginas que não são Nexus Data. Colocar lógica de onboarding no middleware causaria overhead desnecessário nas outras 100+ rotas do azimute-blog. O guard no frontmatter é scoped à página de portfólio.

### D2: Renderização condicional (mesma rota, sem redirect)

O onboarding é renderizado na mesma URL `/dashboard/portfolio` — não existe uma rota separada `/onboarding` ou `/dashboard/portfolio/onboarding`.

**Justificativa:**

- Uma rota separada exigiria um novo arquivo `.astro` no azimute-blog e lógica de redirect server-side (301/302), o que adiciona complexidade sem benefício
- O usuário nunca "navega" para o onboarding — é um estado da aplicação (sem carteiras), não uma página distinta
- Compartilhar a mesma URL simplifica deep-linking: qualquer link para o Nexus Data funciona corretamente em qualquer estado
- Consistente com ADR-013: tabs são sub-estados da mesma página, onboarding também

### D3: Guard server-side ANTES do localStorage check

A sequência de resolução é:

```
1. [SERVER] Astro frontmatter: query wallets WHERE user_id
2. [SERVER] Se 0 wallets → renderizar <OnboardingScreen>  ← PARA AQUI
3. [SERVER] Se ≥ 1 wallet → renderizar <NexusApp wallets={wallets}>
4. [CLIENT] React hydration: ler localStorage("nexus_active_wallet_id")
5. [CLIENT] Se localStorage válido e wallet existe na lista → usar como ativa
6. [CLIENT] Se localStorage inválido/ausente → usar primeira wallet da lista
```

**Relação com ADR-012:**

O ADR-012 define o fluxo de resolução da carteira ativa pressupondo que o usuário TEM carteiras. A etapa 3c do ADR-012 diz: _"Se 0 rows → redirecionar para onboarding (F-025)"_. Este ADR-016 detalha COMO essa detecção e redirecionamento acontecem.

A chave é que o localStorage check (ADR-012 step 1-2) **nunca executa se o guard server-side já detectou 0 wallets** — o component `<OnboardingScreen>` é renderizado em vez de `<NexusApp>`, portanto o código de resolução de wallet ativa sequer é carregado.

```
┌─────────────────────────────────────┐
│ Astro Frontmatter (server)          │
│                                     │
│  wallets.length === 0?              │
│    SIM → render OnboardingScreen    │──→ Não carrega NexusApp
│    NÃO → render NexusApp            │──→ ADR-012 fluxo ativa
└─────────────────────────────────────┘
```

### D4: Estado vazio pós-criação (empty state)

Após o usuário criar a primeira carteira no onboarding:

1. O `<OnboardingScreen>` executa `INSERT INTO wallets` via Supabase client
2. Salva o novo `wallet_id` no localStorage (ADR-012)
3. Faz `window.location.reload()` — o Astro frontmatter re-executa, agora encontra 1 wallet, renderiza `<NexusApp>`
4. O Dashboard abre com estado vazio (nenhum asset_type, nenhum asset)

O empty state do Dashboard exibe:

```
┌─────────────────────────────────────┐
│ Dashboard — [Nome da Carteira]      │
│                                     │
│ Sua carteira está vazia.            │
│ Comece adicionando suas classes     │
│ de ativo na aba Ativos.             │
│                                     │
│       [Ir para Ativos →]            │
└─────────────────────────────────────┘
```

**Por que `window.location.reload()` em vez de client-side state transition:**

- O guard é server-side — o componente `<OnboardingScreen>` não pode "virar" `<NexusApp>` sem que o Astro frontmatter re-execute
- Um full reload garante que a lista de wallets no frontmatter está atualizada
- A latência adicional (~200ms) é aceitável para um evento que ocorre UMA vez (criação da primeira carteira)
- Alternativa seria `<OnboardingScreen>` e `<NexusApp>` no mesmo island com state — isso anula o benefício do guard server-side e aumenta o bundle JS

---

## Consequências

### Positivas

- Zero flash de conteúdo errado — server decide o que renderizar antes de enviar HTML
- Não depende de JavaScript habilitado para a detecção — onboarding funciona mesmo com JS lento
- Sequência clara com ADR-012 — localStorage só é consultado quando wallets existem
- Uma única URL para todo o Nexus Data (`/dashboard/portfolio`) — sem rotas extras para gerenciar
- Empty state orienta o usuário para o próximo passo (tab Ativos)

### Negativas

- Reload completo após criação da primeira carteira (em vez de transição client-side)
  - **Aceitável:** evento único por usuário; latência de ~200ms é imperceptível
- A lógica de detecção está no azimute-blog (Astro page), não no nexus-data (library)
  - **Necessário:** nexus-data é library sem acesso a HTTP context (ADR-009); o page-level guard é responsabilidade do host
- Se a query de wallets falhar (Supabase indisponível), o fallback é renderizar onboarding por engano
  - **Mitigado:** tratar erro de query explicitamente — se erro, renderizar página de erro genérica, não onboarding

---

## Alternativas Consideradas

### A1: Detecção puramente client-side (useEffect + loading spinner)

```tsx
function NexusApp() {
  const [wallets, setWallets] = useState(null);
  useEffect(() => { fetchWallets().then(setWallets); }, []);
  if (wallets === null) return <Spinner />;
  if (wallets.length === 0) return <OnboardingScreen />;
  return <Dashboard wallets={wallets} />;
}
```

**Prós:** Tudo dentro do React island, sem lógica no Astro frontmatter.
**Contras:**
- Flash: spinner → onboarding OU spinner → dashboard (300ms+ de latência visual)
- Depende de JavaScript habilitado — sem JS, nada renderiza
- Duplica a query de wallets (server já poderia ter feito)
- Contraditório com o PRD V2 §9 que recomenda guard server-side

**Rejeitada:** UX inferior (flash), e o server tem a informação disponível — não usá-la é desperdício.

### A2: Middleware de rota no Astro

```typescript
// src/middleware.ts
if (url.pathname.startsWith('/dashboard/portfolio')) {
  const wallets = await fetchWallets(supabase);
  if (wallets.length === 0) {
    return redirect('/dashboard/portfolio/onboarding');
  }
}
```

**Prós:** Intercepta antes do rendering, separação clara.
**Contras:**
- Executa em TODA request para `/dashboard/portfolio*` (incluindo assets estáticos se configurado incorretamente)
- Exige rota separada `/onboarding` (mais um arquivo `.astro` para manter)
- HTTP redirect (302) é visível na barra de endereços — confuso para o usuário
- Middleware é compartilhado com todo o azimute-blog — coupling desnecessário

**Rejeitada:** Overhead desproporcional; o guard no frontmatter resolve o mesmo problema com escopo menor.

### A3: Client-side redirect via React Router

Configurar react-router dentro do island para gerenciar sub-rotas (incluindo onboarding).

**Prós:** Controle total de routing no client.
**Contras:**
- Conflita com o routing do Astro (ADR-001, ADR-006)
- Adiciona react-router como dependência (~12 KB gzipped)
- Cria routing duplo (Astro pages + React Router) — fonte de bugs
- Overkill: o Nexus Data tem uma única página com tabs (ADR-013)

**Rejeitada:** Viola a arquitetura Astro islands (ADR-006) e adiciona complexidade sem benefício.

### A4: localStorage como detecção primária

Ler `nexus_active_wallet_id` do localStorage — se ausente, mostrar onboarding.

**Prós:** Zero query ao banco na detecção.
**Contras:**
- localStorage ausente ≠ sem carteiras (pode ter sido limpo pelo browser)
- Falso positivo: mostra onboarding para usuário que TEM carteiras mas limpou cache
- Não acessível no server (SSR) — impossível usar no frontmatter
- Contraditório com ADR-012 que define localStorage como persistência da wallet ATIVA, não como indicador de existência

**Rejeitada:** localStorage indica qual carteira é a ativa, não se carteiras existem. São preocupações diferentes.

**Escolhida: Guard server-side no frontmatter + renderização condicional** — a detecção mais confiável (query direta ao banco), sem flash de conteúdo, e alinhada com a arquitetura Astro islands do projeto.
