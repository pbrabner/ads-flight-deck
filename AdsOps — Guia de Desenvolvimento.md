# AdsOps — Guia de Desenvolvimento

Oct 20, 2026 · @Draco

## Visão geral

O AdsOps é o painel interno de tráfego pago da agência: puxa diariamente Meta Ads e Google Ads de cada cliente para um Postgres próprio, mostra dashboards por cliente (com login do próprio cliente) e serve de base para validação de leads, agentes de otimização e relatórios. Repositório: `D:\Projetos Pessoais\adsops` (git, branch `main`, sem remote).

**Para quem.** A equipe da agência (papel `admin`, vê tudo e opera o sistema) e os clientes (papel `client`, cada um enxerga só a própria conta). Hoje são 1 a 5 clientes, na maioria provedores de internet, com conversão por lead (formulário ou WhatsApp).

**O que o bloco 1 entrega (pronto).**

- Schema Postgres com RLS por cliente, migrations 0001–0003 aplicadas no projeto Supabase `adsops` (região sa-east-1).
- Conectores Meta (Graph v25) e Google Ads (REST v23) com `fetch` puro: campanhas, conjuntos e anúncios + métricas diárias.
- Sync diário via cron da Vercel, backfill de 90 dias ao cadastrar conta, log em `sync_runs`.
- Login por e-mail/senha, console `/admin` (clientes, conexões, contas, usuários), fallback OAuth para contas que o cliente mantém.
- Dashboard `/c/[slug]` com KPIs e variação vs. período anterior, dois gráficos diários, tabela de campanhas e drill-down até anúncio.
- 24 testes unitários, teste SQL de isolamento (RLS), revisão independente com os 8 achados importantes corrigidos.

**Fora do bloco 1.** Validação de leads e CRM (bloco 2), agentes e qualquer escrita nas plataformas (bloco 3), análise de criativos (4), relatórios automáticos (5), TikTok e LinkedIn (6), convite de usuários, billing, multi-organização, tempo real, breakdowns por placement/idade/geo.

**Pendente para operar de verdade.** Credenciais que só o André tem (chave service\_role do Supabase, token de system user da Meta, developer token e OAuth client do Google, `CRON_SECRET`) e o primeiro sync contra contas reais; detalhes em *Variáveis de ambiente* e *Testes e verificação*.

## Arquitetura e stack

Um único deploy Next.js na Vercel fala com um Postgres do Supabase; o cron puxa das APIs de anúncio com a chave de serviço, as páginas leem com a sessão do usuário e a RLS decide o que cada um vê.

&#91;embedded content: arquitetura · browser, Vercel, APIs de anúncio e Supabase\]

Só o cron e os server actions usam a chave de serviço (e portanto veem tokens); as páginas leem com a sessão do usuário e a RLS filtra por cliente. Os callbacks OAuth trocam o code por tokens nas APIs e gravam em `connections`.

| Camada | Escolha | Por quê |
| --- | --- | --- |
| Framework | Next.js 16.4, App Router, TypeScript, `cacheComponents: false` | Server Components leem direto do Supabase; toda página é por usuário, nada a cachear |
| Banco + Auth | Supabase (Postgres 17, Auth e-mail/senha, RLS) | Multi-cliente leve com `client_id` em tudo; sem serviço de auth próprio |
| Hosting + cron | Vercel (`vercel.json`: `0 7 * * *` UTC = 04:00 BRT) | Um cron diário basta; `maxDuration = 300` nas rotas que sincronizam |
| UI | shadcn/ui (base-ui) + Tailwind 4 + Recharts via `components/ui/chart` | Componentes copiados para o repo, sem lib de dashboard |
| APIs de anúncio | `fetch` puro: Meta Graph v25, Google Ads REST v23 (GAQL) | Sem SDK para manter; os mesmos módulos serão reusados pelos agentes (bloco 3) |
| Validação | zod nos server actions | Fronteira de confiança dos formulários |
| Datas | date-fns; fuso único `America/Sao_Paulo` em `lib/period.ts` | O servidor roda em UTC; as contas reportam em BRT |
| Testes | `node --test` via `tsx` (sem jest/vitest) | Um comando, zero config |

**Estrutura de pastas (o que importa).**

- `supabase/migrations/` — schema, RLS e funções; `supabase/tests/rls.sql` — teste de isolamento; `supabase/seed.sql` — seed de desenvolvimento.
- `src/lib/connectors/` — `types.ts` (contrato), `meta.ts`, `google.ts` e seus testes. Único lugar que fala com as APIs.
- `src/lib/sync.ts` — janelas, upsert de entidades e métricas, `sync_runs`. `src/app/api/cron/sync/route.ts` — entrada do cron.
- `src/lib/supabase/` — `server.ts` (cliente da sessão, RLS vale) e `admin.ts` (service role, só servidor). `src/lib/auth.ts` — `requireSession()` / `requireAdmin()`. `src/proxy.ts` — middleware do Next 16 que refresca a sessão e redireciona.
- `src/lib/period.ts`, `queries.ts`, `format.ts` — período, RPCs de agregação, formatação pt-BR.
- `src/app/login`, `src/app/admin`, `src/app/c/[slug]` (+ `campaign/[id]`, `adset/[id]`, `drilldown.tsx`), `src/app/api/oauth/{google,meta}/{start,callback}`.
- `src/components/` — `kpi-cards`, `daily-chart`, `metrics-table`, `period-select` e `ui/` do shadcn.
- `docs/research/market-research.md` — pesquisa de mercado que fundamentou o escopo.

**Fluxo de dados.** Cron → `syncAll` (service role) → conector da plataforma → `entities` + `metrics_daily` (uma linha por entidade e dia, nos três níveis) → funções SQL `metrics_timeseries` / `metrics_by_period` → Server Components com o cliente da sessão. Totais e séries usam só o nível campanha para não triplicar.

## Ambiente local

Com Node 20+ e as variáveis preenchidas, `npm install` e `npm run dev` sobem o app em `http://localhost:3000`; sem a chave service\_role o painel abre, mas sync e formulários do admin não gravam.

1. Pré-requisitos: Node 20 ou superior (desenvolvido com 26.9), npm 11, git. Nenhum Docker: o banco é o projeto Supabase remoto `adsops`.
2. `npm install` na raiz do repo.
3. Copie `.env.example` para `.env.local` e preencha (tabela na próxima seção). `NEXT_PUBLIC_SUPABASE_URL` e a chave pública já estão em `.env.local`; `.env*` é ignorado pelo git.
4. `npm run dev` (Turbopack). Primeiro acesso: `/login`.
5. Para ver dados sem tokens reais, rode `supabase/seed.sql` no SQL editor do Supabase: cria `admin@adsops.local` e `cliente@adsops.local` (senha no arquivo) e o cliente **Provedor Demo** (`/c/demo`) com 14 dias de métricas falsas. Já foi aplicado no projeto atual.
6. `npm test` roda os 24 testes (parsers dos conectores, período, janelas de sync, redirecionamento de login). `npx tsc --noEmit -p .` e `npx eslint src` devem ficar limpos antes de qualquer commit.
7. Teste de isolamento: cole `supabase/tests/rls.sql` no SQL editor e execute; termina com `RLS OK` e faz rollback.

Comandos úteis:

```bash
npm run dev          # app em localhost:3000
npm test             # suite unitária
npx tsc --noEmit -p . && npx eslint src   # tipos + lint
npm run build        # mesma compilação da Vercel
```

O arquivo `.claude/launch.json` (config `adsops-dev`) permite abrir o servidor de desenvolvimento pelo painel do Claude; é opcional.

## Variáveis de ambiente e credenciais

Todas vivem em `.env.local` (local) e nas Environment Variables do projeto Vercel (produção); nunca passam pelo chat nem pelo repositório.

| Variável | Onde obter | Usada em |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API (`https://oheutjwantubechgphjh.supabase.co`) | todo acesso ao banco |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem, chave *publishable* (`sb_publishable_…`) | cliente da sessão e `proxy.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | idem, `service_role` (secret) | `lib/supabase/admin.ts`: cron, server actions do admin, callbacks OAuth. Nunca no browser |
| `CRON_SECRET` | qualquer string longa gerada por você | a Vercel envia `Authorization: Bearer <valor>` ao cron; a rota recusa sem ele |
| `META_APP_ID`, `META_APP_SECRET` | developers.facebook.com → app tipo Business com produto Marketing API | só o fallback OAuth da Meta e a troca por token de 60 dias |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud → APIs & Services → Credentials → OAuth client (Web); redirect `<APP_URL>/api/oauth/google/callback` | OAuth do Google e refresh do access token em cada sync |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads → conta MCC → Ferramentas → API Center (nível Explorer: 2.880 operações/dia, suficiente) | header `developer-token` em toda chamada GAQL |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | ID da MCC, com ou sem hífens | header `login-customer-id`, enviado só para conexões da agência |
| `NEXT_PUBLIC_APP_URL` | URL pública do deploy (`http://localhost:3000` em dev) | redirects dos callbacks OAuth |

**Tokens das plataformas não são variáveis de ambiente.** Eles ficam na tabela `connections`, uma linha por conexão: o token de system user da Meta e o refresh token da MCC do Google são colados em `/admin` → Conexões (ou criados pelo fluxo OAuth). Assim um cliente que mantém a própria conta vira apenas outra linha, com `owner_client_id` preenchido.

**Escopos mínimos.** Meta: `ads_read` (bloco 3 vai pedir `ads_management`). Google: `https://www.googleapis.com/auth/adwords` com `access_type=offline` e `prompt=consent` para receber refresh token.

**Caminho preferido para contas de clientes.** Partner access na Business Manager da agência e vínculo à MCC: sem OAuth, sem App Review, um token só. O OAuth da Meta para usuários sem papel no app exige App Review de `ads_read`; use-o apenas se o cliente recusar o partner access.

## Banco de dados

Sete tabelas, RLS em todas, e duas funções SQL de agregação que o dashboard chama por RPC; o schema vive em `supabase/migrations/` e é aplicado no projeto `adsops` (id `oheutjwantubechgphjh`).

| Tabela | Conteúdo | Chave / unicidade | Quem lê (RLS) |
| --- | --- | --- | --- |
| `clients` | nome, `slug` (usado na URL `/c/[slug]`) | `slug` único | admin: todos; cliente: o próprio |
| `profiles` | `user_id` (auth.users), `role` admin/client, `client_id`, `email` | 1 por usuário | cada um a própria linha; admin: todas (0003) |
| `connections` | `platform`, `label`, `access_token`, `refresh_token`, `expires_at`, `owner_client_id` (null = agência) | — | **ninguém via API**: sem policy, só service role |
| `connections_public` (view) | mesmas colunas sem tokens | — | admin (`where is_admin()`) |
| `ad_accounts` | `client_id`, `connection_id`, `platform`, `external_id`, `currency`, `timezone`, `active`, `lead_actions text[]` | `(platform, external_id)` | admin; cliente dono |
| `entities` | campanha, conjunto e anúncio numa tabela: `level`, `external_id`, `parent_id`, `name`, `status`, `objective`, `raw jsonb` | `(platform, level, external_id)` | via `ad_accounts.client_id` |
| `metrics_daily` | `entity_id`, `date`, impressions, clicks, spend, reach, conversions, conversion\_value, leads, `raw` | `(entity_id, date)` | via entidade → conta → cliente |
| `sync_runs` | conta, início/fim, `status` running/ok/error, `rows`, `error` | serial | admin |

**Funções.** `current_client_id()` e `is_admin()` são `security definer` com `search_path = public` e leem `profiles` pelo `auth.uid()`; todas as policies se apóiam nelas. `metrics_by_period(p_client, p_from, p_to, p_level, p_parent)` devolve uma linha por entidade com somas e CTR/CPC/CPL já calculados (NULL quando o denominador é zero), ordenada por spend; `metrics_timeseries(p_client, p_from, p_to)` devolve a série diária. As duas são `security invoker`: a RLS do usuário vale dentro delas, por isso o dashboard pode chamá-las com o cliente da sessão.

**Regra que não pode quebrar.** `metrics_daily` guarda os três níveis. Qualquer total ou série deve filtrar `level = 'campaign'` (como `metrics_timeseries` faz), senão soma três vezes. Um índice por nível (`entities(ad_account_id, level)`) e um por data (`metrics_daily(date)`) sustentam as consultas.

**`lead_actions`.** Por conta: na Meta, os `action_type` que contam como lead (ex.: `lead`, `onsite_conversion.messaging_conversation_started_7d` para WhatsApp); no Google, nomes de *conversion actions*. Vazio no Google significa “todas as conversões”. É configuração, não código.

**Migrations.** `0001_init` (schema, RLS, funções), `0002_connections_public_view`, `0003_profiles_admin` (policy de admin + coluna `email`). Para criar uma nova: escreva `supabase/migrations/000N_nome.sql`, aplique no projeto (SQL editor do Supabase ou o MCP `apply_migration`, que registra o nome), rode `rls.sql` de novo e commite. Não há CLI do Supabase configurada nem banco local; o projeto remoto é a fonte da verdade, e o arquivo no repo deve espelhá-lo byte a byte.

**Tokens em texto puro.** Decisão registrada (comentário `ponytail:` na 0001): `connections` guarda tokens em colunas comuns, protegidas apenas por não ter policy. Migrar para Supabase Vault se o sistema virar multi-organização.

## Conectores de plataforma

Cada plataforma é um módulo em `src/lib/connectors/` que implementa um único método, `sync(acct, token, from, to)`, e devolve entidades + métricas diárias já normalizadas; a lógica de parsing é pura e testada com fixtures, a de rede é fina e sem SDK.

**Contrato (`types.ts`).**

- `Entity { level, externalId, parentExternalId?, name, status, objective?, raw }` — `level` é `campaign | adset | ad`; o pai de um adset é a campanha, o de um ad é o adset.
- `DailyMetric { level, externalId, date, impressions, clicks, spend, reach?, conversions, conversionValue, leads, raw }` — números já convertidos (as APIs devolvem strings), `date` em `YYYY-MM-DD`.
- `Token { accessToken, refreshToken?, loginCustomerId? }` e `AccountRef { externalId, leadActions }`.
- `Connector.sync(acct, token, from, to): Promise<{ entities, metrics }>` — janela inclusiva.

**Meta (`meta.ts`, Graph v25).**

- Entidades: `GET /act_{id}/campaigns|adsets|ads?fields=…&limit=500`, seguindo `paging.next`. O `external_id` é guardado sem o prefixo `act_`; o módulo aceita com ou sem.
- Métricas: `GET /act_{id}/insights` uma vez por nível (`level=campaign|adset|ad`), `time_increment=1`, `time_range={since,until}`. `insightsFields(level)` pede só os ids do nível para cima: a API rejeita `ad_id` em `level=campaign`.
- Normalização: `leads` = soma dos `actions[]` cujo `action_type` está em `lead_actions`; `conversions` = soma dos tipos que começam com `lead`, `onsite_conversion.` ou `offsite_conversion.`; `conversionValue` vem de `action_values`. Os `actions` crus ficam em `raw`.
- Erros: 429 ou códigos 4/17/80004 (rate limit) → espera 60 s e tenta uma vez; código 190 → `MetaError('token_invalid')`, que o sync grava em `sync_runs.error` e segue para a próxima conta.
- `exchangeLongLivedToken()` troca o token curto do OAuth por um de 60 dias (usado só pelo callback).

**Google Ads (`google.ts`, REST v23).**

- `refreshAccessToken(refreshToken)` em `oauth2.googleapis.com/token` a cada sync; `invalid_grant` vira `token_invalid`.
- `googleHeaders(token)` monta `Authorization`, `developer-token` e, só quando `loginCustomerId` está presente, `login-customer-id` (sem hífens). O sync só passa o id da MCC para conexões da agência (`owner_client_id` nulo); o token OAuth de um cliente não é membro da MCC e falharia com `USER_PERMISSION_DENIED`.
- Por nível (`campaign`, `ad_group`, `ad_group_ad`) rodam duas GAQL via `googleAds:searchStream`: uma listagem sem segmentos (mantém nome e status frescos mesmo sem atividade) e uma com `segments.date` + métricas. Quando `lead_actions` não está vazio, uma terceira segmenta por `segments.conversion_action_name` e `applyLeadActions()` recalcula `leads`.
- `normalizeGoogle(level, rows)` extrai entidade e métrica da mesma linha (camelCase do REST); linhas sem `segments` geram só entidade. `spend = round(cost_micros / 10 000) / 100`. `objective` recebe `advertising_channel_type` (SEARCH, PERFORMANCE\_MAX, DEMAND\_GEN…). Performance Max não tem nível de anúncio: fica só na campanha, sem erro.
- Entidades `REMOVED` são excluídas no `WHERE`.

**Cobertura de modelos de campanha.** Meta: todos os objetivos (inclusive Advantage+) passam pelos mesmos endpoints. Google: todos os `advertising_channel_type` vêm pela mesma GAQL. Não há código por tipo de campanha; o tipo é um campo.

**Fixtures.** Os JSONs em `meta.test.ts` e `google.test.ts` foram escritos a partir da documentação, não capturados. No primeiro sync real, capture uma resposta de cada endpoint, anonimize ids e substitua as fixtures; se um nome de campo divergir, o teste é o lugar de registrar.

**Adicionar uma plataforma (bloco 6).**

1. Acrescente o valor ao enum `platform` (migration) e ao tipo `Platform` em `types.ts`.
2. Crie `src/lib/connectors/<nome>.ts` exportando um `Connector` e funções `normalize*` puras; escreva o teste de normalização antes do código.
3. Registre no `syncAccount` (`acct.platform === "meta" ? meta : google` vira um mapa) e no `PLATFORM` de `metrics-table.tsx`.
4. Documente escopos, aprovação e limites na seção de variáveis. LinkedIn: escrita limitada a 5 contas no tier de desenvolvimento; TikTok: app review com vídeo antes de qualquer conta real.

## Sync e cron

O cron chama `GET /api/cron/sync` às 04:00 BRT; `syncAll` percorre as contas ativas em sequência, re-puxa os últimos 7 dias de cada uma e grava uma linha em `sync_runs` por conta e janela, de modo que uma conta com token inválido não derruba as outras.

**Entrada (`src/app/api/cron/sync/route.ts`).** Exige `Authorization: Bearer <CRON_SECRET>` (a Vercel envia automaticamente); sem o header responde 401. `export const maxDuration = 300`. Parâmetros opcionais: `?account=<uuid>` (uma conta), `&from=YYYY-MM-DD&to=YYYY-MM-DD` (reprocessamento ou backfill). Responde `{ ok, summary: [{ account, platform, rows | error }] }`.

**Janelas (`src/lib/sync.ts`).** `defaultWindow()` = hoje−7 até hoje no fuso `America/Sao_Paulo` (absorve atraso de atribuição de conversões). `chunkRange(from, to, 30)` divide qualquer intervalo em janelas de até 30 dias; o backfill de 90 dias ao cadastrar uma conta roda 4 janelas (`createAccountAction`).

**Passos de `syncAccount(db, acct, from, to)`.**

1. Abre `sync_runs` com `status = running`.
2. Lê a `connections` da conta com o cliente service role (único lugar que vê tokens) e monta o `Token`; `loginCustomerId` só para conexão da agência.
3. Chama `connector.sync()`.
4. `upsertEntities`: por nível (campanha → conjunto → anúncio) faz upsert em `entities` com `onConflict: platform,level,external_id` e resolve `parent_id` pelo mapa do nível anterior. Métricas que apontam para entidades ausentes da listagem (apagadas/arquivadas) ganham um **placeholder insert-only** (`ignoreDuplicates: true`, nome = id, status `UNKNOWN`) e depois um `select` para recuperar os ids; assim um sync posterior nunca apaga nome, status ou pai de uma linha real.
5. Upsert de `metrics_daily` em lotes de 500 com `onConflict: entity_id,date`.
6. Fecha `sync_runs` com `ok`, `rows` e, se a conexão tem `expires_at` a menos de 10 dias **e não tem refresh token** (caso Meta OAuth), um aviso em `error`. Em exceção: `status = error` e a mensagem, e a exceção sobe para `syncAll` registrar no resumo.

**Chamar manualmente.**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://<app>/api/cron/sync?account=<uuid>&from=2026-07-14&to=2026-10-12"
```

Ou, no `/admin`, o botão **Sync agora** da conta (server action `syncNowAction`, janela padrão).

**Limites a respeitar.** Vercel: 300 s por invocação; com 5 clientes × 2 plataformas sobra folga, acima de \~20 contas paralelize por conta ou dispare uma invocação por conta. Google Explorer: 2.880 operações/dia; cada sync gasta 6 a 9 chamadas por conta. Meta: 6 chamadas concorrentes por janela; em backfills de contas grandes pode bater 80004, e o retry único de 60 s cobre o caso comum.

**O que não está coberto por teste unitário.** As chamadas ao Supabase dentro de `syncAccount` (verificadas pelo e2e); `upsertEntities` tem um teste com um fake de `db.from()` que cobre o caminho dos placeholders.

## Autenticação, papéis e admin

Supabase Auth com e-mail e senha; o papel vem de `profiles` e a RLS faz o resto, de modo que nenhuma página precisa filtrar por cliente à mão.

**Sessão.** `lib/supabase/server.ts` cria o cliente por request com `@supabase/ssr` e os cookies do Next (`cookies()` é assíncrono no Next 16). `src/proxy.ts` (nome do middleware no Next 16) refresca a sessão em toda rota e aplica `loginRedirect()` de `lib/auth-redirect.ts`: anônimo fora de `/login`, `/api/cron`, `/api/oauth` → `/login`; logado em `/login` → `/`, **exceto** quando a URL traz `?error=` (senão um usuário sem perfil entraria em loop). `requireSession()` devolve `{ supabase, user, profile }` ou redireciona; `requireAdmin()` manda não-admins para `/`.

**Papéis.** `admin`: vê todos os clientes, opera `/admin`. `client`: `profiles.client_id` aponta para o seu cliente; a raiz `/` o redireciona para `/c/<slug>`; `/admin` o devolve para lá; outro slug dá 404 porque `getClientBySlug` retorna nulo sob RLS.

**Criar usuários.** Não há convite. Crie em Supabase → Authentication → Users (e-mail + senha, confirme o e-mail) e vincule em `/admin` → Usuários: `linkUserAction` localiza o usuário por e-mail via `auth.admin.listUsers` e faz upsert em `profiles` com papel, cliente e e-mail. Usuário criado por SQL precisa das colunas de token (`confirmation_token` etc.) como string vazia, não NULL (ver Troubleshooting).

**Console `/admin` (`src/app/admin/page.tsx` + `actions.ts`).** Uma página, quatro cartões, todas as leituras com o cliente da sessão (policies de admin + view `connections_public`) e todas as escritas em server actions que começam com `await requireAdmin()` e usam o service role.

| Cartão | Mostra | Action | Validação (zod) |
| --- | --- | --- | --- |
| Clientes | badges com link para `/c/<slug>` | `createClientAction` | nome; slug `^[a-z0-9-]+$` único |
| Conexões | label, plataforma, expira, dono; links “Conectar … via OAuth” | `createConnectionAction` | plataforma, label, token; Google: o valor colado vira `refresh_token` |
| Contas de anúncio | conta, cliente, último `sync_runs` (status, data, linhas, erro), botão Sync agora | `createAccountAction` (+ backfill 90 d inline), `syncNowAction` | cliente, conexão, plataforma, id (aceita `act_`/hífens), `lead_actions` separados por vírgula |
| Usuários | e-mail · papel · cliente | `linkUserAction` | e-mail válido; cliente obrigatório para papel client |

Erros de validação voltam como `?error=<mensagem>` e aparecem no topo da página. `export const maxDuration = 300` na página cobre os server actions que sincronizam (o Next honra o valor da página para actions).

**OAuth (`src/app/api/oauth/*`).** `start` exige sessão admin (`requireAdminOrResponse`, 401/403), grava um `state` aleatório em cookie httpOnly de 10 min e redireciona ao consentimento (Google: `access_type=offline&prompt=consent`, escopos adwords + email; Meta: `scope=ads_read`). `callback` valida e consome o state, troca o code por tokens e insere em `connections` (Google: access + refresh, sem `expires_at`; Meta: token longo de 60 dias com `expires_at`), depois volta a `/admin?connected=<plataforma>` ou `?error=oauth_*`. O redirect URI registrado no provedor deve ser exatamente `<NEXT_PUBLIC_APP_URL>/api/oauth/<plataforma>/callback`.

## Dashboard

As páginas de `/c/[slug]` são Server Components que leem o período da URL, chamam as duas funções SQL com o cliente da sessão e renderizam três componentes; o único estado no browser é o seletor de período.

**Rotas.**

| Rota | Mostra | Fonte |
| --- | --- | --- |
| `/c/[slug]` | 7 KPIs com variação vs. período anterior, gráfico diário de investimento, gráfico diário de leads, tabela de campanhas | `metrics_timeseries` (período e período anterior) + `metrics_by_period(level=campaign)` |
| `/c/[slug]/campaign/[id]` | conjuntos da campanha | `metrics_by_period(level=adset, p_parent=id)` |
| `/c/[slug]/adset/[id]` | anúncios do conjunto | `metrics_by_period(level=ad, p_parent=id)` |

O `layout.tsx` da pasta valida a sessão e o acesso ao cliente (404 se a RLS esconder o slug) e desenha a barra com nome do cliente, link Admin (só admin) e Sair. As duas páginas de drill-down delegam a `drilldown.tsx`, que decide o nível filho e o link “voltar”.

**Período (`lib/period.ts`).** Vive nos search params: `?range=today|7d|30d|month|last_month|custom&from=&to=`. `periodFromParams(params, nowUtc, tz)` devolve `{ range, from, to, prevFrom, prevTo }`; o período anterior tem o mesmo número de dias (para `month`, o mesmo trecho do mês anterior). Parâmetros inválidos caem em `7d`. `shiftToTz()` converte o relógio UTC do servidor para o dia civil em `America/Sao_Paulo`; `todayIn()` é o atalho. `periodQuery(period)` serializa de volta para manter o período ao navegar no drill-down. `period-select.tsx` (client) é um `<select>` nativo mais dois `<input type="date">` quando `custom`, que fazem `router.push` da nova URL.

**Queries (`lib/queries.ts`).** Wrappers finos sobre `supabase.rpc` que convertem os `numeric`/`bigint` (chegam como string) em números: `getTimeseries`, `getByPeriod`, `getClientBySlug`, `getEntity`. `totals(days)` soma a série e calcula CTR, CPC e CPL (nulos quando o denominador é zero). Nunca some `metrics_by_period` de níveis diferentes nem chame `metrics_daily` direto para totais.

**Componentes.**

- `kpi-cards.tsx`: sete cartões (Investimento, Impressões, Cliques, CTR, CPC, Leads, CPL). A variação usa `delta(cur, prev)` de `lib/format.ts`; verde/vermelho seguem a direção “melhor” de cada métrica (CPC e CPL: menor é melhor; investimento: neutro). Sem base no período anterior mostra “sem base”.
- `daily-chart.tsx` (client): dois gráficos de linha de uma série cada, nunca eixo duplo. Cores em `--chart-1` (azul `#2563eb`) e `--chart-2` (verde `#15803d` claro / `#16a34a` escuro), validadas para contraste e daltonismo nos dois temas. Tooltip e grade vêm do `components/ui/chart` do shadcn.
- `metrics-table.tsx`: colunas Nome, Plataforma (badge), Status (“Ativo” para ACTIVE/ENABLED, senão o valor cru), Investimento, Impressões, Cliques, CTR, CPC, Leads, CPL; `hrefFor` opcional torna o nome um link de drill-down. Vazio mostra “Sem dados no período.”
- `lib/format.ts`: `money` (BRL), `count`, `num`, `pct`, `delta`, todos pt-BR via `Intl`.

**Regras de UI.** Tailwind + shadcn apenas; nada de biblioteca de dashboard. Moeda sempre BRL por enquanto (`ad_accounts.currency` existe, mas a formatação ainda não o usa). Valores numéricos alinhados à direita com `tabular-nums`. Para adicionar um KPI: um item no array `KPIS` de `kpi-cards.tsx` e, se precisar de nova coluna, as duas funções SQL + `Totals`/`EntityMetrics` em `queries.ts`.

## Testes e verificação

Três camadas: 24 testes unitários sobre a lógica pura, um teste SQL de isolamento contra o banco real, e um roteiro end-to-end do qual a metade com dados de demonstração já passou e a metade com contas reais ainda espera credenciais.

**Unitários (`npm test`, `tsx --test "src/**/*.test.ts"`).**

| Arquivo | Cobre |
| --- | --- |
| `connectors/meta.test.ts` | normalização de insights por nível, soma de leads por `lead_actions`, conversões e valores, entidades com pai, `insightsFields` |
| `connectors/google.test.ts` | linhas de campanha/ad group/ad, dedupe de entidades, linhas sem segmentos, `applyLeadActions`, `googleHeaders` com e sem MCC |
| `sync.test.ts` | `chunkRange`, `defaultWindow`, `upsertEntities` com fake de `db.from()` (placeholders insert-only) |
| `period.test.ts` | 7d, mês, mês passado, custom, fallback, `todayIn` em BRT |
| `auth-redirect.test.ts` | regras de redirecionamento do proxy, incluindo o caso `?error=` |

Regra do projeto: nenhuma lógica nova sem um teste que falhou antes (TDD); funções puras ficam exportáveis justamente para isso. Mocks só na fronteira de rede/banco.

**Isolamento (`supabase/tests/rls.sql`).** Cria dois clientes, três usuários e dados, assume `role authenticated` com `request.jwt.claims` de cada um e afirma: cliente A vê 1 cliente, 1 entidade, 1 métrica, zero `connections`, zero `connections_public`, zero `sync_runs`, só o próprio perfil, e `metrics_by_period` do cliente B vazio; admin vê tudo, menos `connections`. Termina em `select 'RLS OK'` e `rollback`. Rode após **qualquer** mudança de policy, função ou view.

**End-to-end.**

- [x] Login do admin de desenvolvimento e página `/admin` renderizam.
- [x] `/c/demo` mostra KPIs, dois gráficos e tabela com os dados do seed; drill-down campanha → conjunto → anúncio.
- [x] Login como cliente: `/admin` redireciona para `/c/demo`, outro slug responde 404, `/login?error=no_profile` não entra em loop.
- [ ] Preencher `SUPABASE_SERVICE_ROLE_KEY`, cadastrar a conexão da agência e **uma conta real Meta e uma Google** em `/admin` (o cadastro dispara o backfill de 90 dias).
- [ ] Rodar o cron manualmente para um dia específico e comparar `spend` e `clicks` com o Gerenciador de Anúncios e o Google Ads: devem bater; `leads` pode divergir pela janela de atribuição (documentar a diferença).
- [ ] Capturar as respostas reais, anonimizar e substituir as fixtures dos testes.
- [ ] Deploy na Vercel, esperar o cron das 04:00 e conferir `sync_runs` do dia em `/admin`.

**Antes de cada commit.** `npm test`, `npx tsc --noEmit -p .`, `npx eslint src`. Mudou SQL: `rls.sql`. Mudou UI: abrir no browser (o painel do Claude ou `npm run dev`) e olhar, não só compilar.

## Convenções de desenvolvimento

Menor código que funciona, provado por um teste que falhou antes, lendo o fluxo inteiro antes de mudar qualquer coisa.

**Escopo e tamanho.**

- Sem abstração para um único caso: nada de interface com uma implementação, factory para um produto, config para valor que não muda. O `Connector` existe porque há dois.
- Reuse antes de escrever: `lib/format.ts`, `lib/period.ts`, `lib/queries.ts`, componentes `ui/` do shadcn. Nenhuma dependência nova para o que cabe em poucas linhas; nenhuma SDK de plataforma.
- Nativo antes de lib: `<select>` e `<input type="date">` no seletor de período, constraint no banco em vez de checagem na aplicação, SQL para agregar.
- Corte deliberado com teto conhecido leva comentário `ponytail:` dizendo o teto e o upgrade (ex.: tokens em texto puro → Vault; backfill inline → fila; fuso único → por conta).

**TDD.** Teste primeiro, veja falhar pelo motivo certo, código mínimo, veja passar, rode a suite inteira. Lógica de parsing, datas, redirecionamento e upsert é pura e exportada para ser testável; a rede e o banco ficam em funções finas. Correção de bug começa pelo teste que reproduz o bug.

**Segurança (não simplificar).** Validação zod em todo server action; `requireAdmin()` como primeira linha de ações administrativas; service role só em `lib/supabase/admin.ts` e nunca importado por componente cliente; tokens só chegam ao servidor; `CRON_SECRET` em toda rota de cron; state em cookie httpOnly no OAuth. Qualquer nova tabela nasce com RLS habilitada e entra no `rls.sql`.

**Next.js 16 (difere do que a memória sugere).** `params` e `searchParams` são Promises: `await`. Middleware chama-se `proxy.ts` e exporta `proxy`. `cookies()` é assíncrono. `cacheComponents` está desligado de propósito. Antes de usar uma API do Next, confira `node_modules/next/dist/docs/`.

**Banco.** Toda mudança de schema é uma migration numerada no repo e aplicada no projeto remoto; nunca edite tabelas pelo dashboard sem espelhar no arquivo. Funções chamadas pelo dashboard são `security invoker`; helpers de auth são `security definer` com `search_path` fixo.

**Estilo.** TypeScript estrito, imports `@/`, componentes de servidor por padrão e `"use client"` só onde há estado ou evento. Textos de UI em pt-BR; código, nomes de colunas e commits em inglês. Commits pequenos por seção funcional, mensagem no imperativo (`feat:`, `fix:`, `docs:`, `chore:`), com a linha de co-autoria do Claude quando ele participou.

**O que não fazer.** Não adicionar SDKs de plataforma, libs de dashboard/BI, ORM, fila ou cache sem necessidade medida. Não criar multi-organização, billing ou convite de usuário neste estágio. Não escrever nas plataformas (pausar, criar, alterar) antes do bloco 3 e da fila de aprovação. Não somar `metrics_daily` entre níveis.

## Deploy e operação

Um projeto Vercel ligado ao repositório, as variáveis da seção anterior em Production, e o cron de `vercel.json` passa a rodar sozinho; o banco já está no ar.

**Primeiro deploy.**

1. Publique o repo (GitHub) e importe na Vercel, ou `vercel link` + `vercel --prod` a partir da pasta.
2. Cadastre todas as variáveis de ambiente em Production (e Preview, se for usar). `NEXT_PUBLIC_APP_URL` = URL final; atualize o redirect URI do OAuth no Google Cloud e no app da Meta para essa URL.
3. Confirme em Settings → Cron Jobs que `/api/cron/sync` aparece com `0 7 * * *`. A Vercel injeta o `CRON_SECRET` no header.
4. Rode o seed **ou** crie o primeiro usuário admin em Supabase Auth e vincule por SQL (`insert into profiles (user_id, role, email) …`), já que `/admin` exige um admin existente.
5. Faça o primeiro sync real e a comparação com os painéis das plataformas (roteiro em *Testes e verificação*).

**Rotina.**

- Status diário: `/admin` → Contas mostra o último `sync_runs` por conta (status, hora, linhas, erro). `error` = `token_invalid` significa renovar o token da conexão; aviso `token expires …` aparece 10 dias antes de um token Meta OAuth vencer.
- Reprocessar um período: cron manual com `?account=&from=&to=` (upsert é idempotente; pode repetir à vontade).
- Nova conta de cliente: partner access na BM/MCC → `/admin` → Contas → Adicionar (backfill automático de 90 dias) → criar o usuário do cliente e vincular.
- Logs: `vercel logs` ou o painel de Functions; no Supabase, Logs → Auth para problemas de login e Logs → Postgres para erros de SQL.

**Seed e cleanup.** `supabase/seed.sql` é só para desenvolvimento. Antes de abrir para clientes reais, rode o bloco CLEANUP do fim do arquivo (apaga a conta e conexão demo, o cliente `demo` e os dois usuários `@adsops.local`). O projeto atual ainda contém o seed.

**Backups e dados.** O Supabase faz backup diário no plano pago; no free tier não há backup automático, mas tudo em `entities` e `metrics_daily` é reconstruível por um backfill (as APIs guardam 37 meses na Meta e ilimitado no Google). `connections` é o único dado que não se recupera: anote onde cada token foi gerado.

**Custos.** Supabase free (2 projetos ativos; `adsops` ocupa uma vaga), Vercel Hobby (cron diário e 300 s de função cabem), APIs gratuitas. Nada pago no bloco 1.

## Troubleshooting

Problemas já encontrados nesta base e o que resolveu cada um; os não listados começam por `sync_runs.error`, pelos logs de Auth do Supabase e por `vercel logs`.

| Sintoma | Causa | Solução |
| --- | --- | --- |
| Login responde “E-mail ou senha inválidos” para um usuário criado por SQL; Logs → Auth mostram `converting NULL to string is unsupported` em `confirmation_token` | GoTrue não aceita NULL nas colunas de token de `auth.users` | Inserir `''` em `confirmation_token`, `recovery_token`, `email_change`, `email_change_token_new`, `email_change_token_current`, `phone_change`, `phone_change_token`, `reauthentication_token` (o seed já faz); ou criar o usuário pelo dashboard |
| `/admin` cai com `supabaseKey is required` | `SUPABASE_SERVICE_ROLE_KEY` vazia | Preencher a variável; as leituras da página não dependem dela, mas as actions e o cron sim |
| Usuário logado vê `ERR_TOO_MANY_REDIRECTS` | Usuário em Auth sem linha em `profiles`; `/` manda para `/login?error=no_profile` e o proxy devolvia para `/` | Corrigido em `auth-redirect.ts` (`?error=` não redireciona). Vincule o usuário em `/admin` → Usuários |
| Cron responde 401 | Header `Authorization` ausente ou `CRON_SECRET` diferente entre Vercel e o código | Conferir a variável no ambiente Production; chamadas manuais precisam do mesmo Bearer |
| `sync_runs.error = token_invalid` | Meta código 190 ou Google `invalid_grant`/401: token revogado, senha trocada, app removido | Gerar novo token e atualizar `connections.access_token` (Meta) ou `refresh_token` (Google) via SQL ou nova conexão |
| Google: `USER_PERMISSION_DENIED` | `login-customer-id` da MCC enviado com token de um usuário que não é membro dela | Conexão do cliente precisa de `owner_client_id` preenchido (o sync então omite o header) |
| Google: `DEVELOPER_TOKEN_NOT_APPROVED` ou só contas de teste funcionam | Developer token ainda em nível Test | Pedir Explorer/Basic no API Center da MCC |
| Meta: erro `(#100)` em campo de insights | Campo abaixo do nível pedido (ex.: `ad_id` em `level=campaign`) | `insightsFields(level)` já filtra; se mudar a lista de campos, mantenha a regra |
| Meta: códigos 4 / 17 / 80004 | Rate limit da conta ou do app | O sync espera 60 s e repete uma vez; backfills grandes: reduzir janelas ou rodar por conta |
| Campanha pausada continua “Ativa” (Google) | Antes, entidades vinham só das linhas com métricas | Corrigido: listagem sem segmentos a cada sync. Se voltar, confira a query de listagem em `google.ts` |
| “Hoje” vazio à noite ou totais deslocados um dia | Servidor em UTC usando data civil errada | `shiftToTz()` em `period.ts` e `sync.ts`; todo cálculo de dia passa por ele |
| Totais três vezes maiores que o painel da plataforma | Soma de `metrics_daily` sem filtrar `level = 'campaign'` | Usar `metrics_timeseries`/`totals()`; nunca somar a tabela crua |
| Linha com nome igual ao id e status `UNKNOWN` no drill-down | Placeholder para entidade que a plataforma não lista mais (apagada/arquivada) mas que teve gasto | Comportamento esperado; o próximo sync que listar a entidade preenche nome e pai |
| `tsc` reclama de `params`/`searchParams` | Next 16: são Promises | `const { slug } = await params` |
| Tela em branco em dev após mudar `next.config.ts` | Turbopack recompilando | Aguardar o `✓ Compiled` no terminal e recarregar |

**Onde olhar primeiro.** `/admin` → Contas (erro por conta) → Supabase Logs → Auth / Postgres → `vercel logs --follow` → chamar o cron manualmente para uma conta e um dia e ler o JSON de resposta.

## Roadmap e pendências

Cada bloco seguinte ganha spec e plano próprios antes de código; a ordem é dados → validação → agentes → criativos → relatórios → novas plataformas, porque cada etapa consome a anterior.

| Bloco | Entrega | Depende de | Notas de design já decididas |
| --- | --- | --- | --- |
| 1 — Dados + dashboard | pronto (este documento) | credenciais para o e2e real | — |
| 2 — Validação de leads | import de leads do IXC Provedor (API, André tem token) e planilhas; match lead ↔ campanha por UTM/gclid/fbclid/data; heurísticas de tráfego inválido sobre métricas (CTR alto + 0 lead, picos de clique, placement/hora/geo anômalos); score de qualidade por campanha | bloco 1 com histórico real | Sem script nas landing pages (André não as controla): o sinal é o cruzamento com o CRM, não fingerprint. Breakdowns por placement/idade/geo entram aqui como fonte |
| 3 — Agentes | análise diária por campanha com `@anthropic-ai/sdk` (Claude Opus 5.5), recomendações com justificativa, fila de aprovação, execução (pausar, orçamento, ativar) via API, auditoria e rollback | bloco 2 | Humano aprova com 1 clique; nenhuma ação automática no início. Meta: token com `ads_management`; MCP oficial da Meta pode servir ao agente. Google: Explorer basta para pausar/ajustar |
| 4 — Criativos e copy | avaliação de criativos (visão) e textos cruzada com performance; sugestão de testes A/B | bloco 3 | Motion cobra US$ 750+/mês por isso; uma passada de visão LLM sobre `raw` dos anúncios é barata |
| 5 — Relatórios | semanal/mensal em PDF ou link, envio por e-mail/WhatsApp | bloco 1 | Reusar `metrics_by_period` e `metrics_timeseries`; nada de BI engine |
| 6 — TikTok e LinkedIn | conectores de leitura | contas ativas | LinkedIn: escrita limitada a 5 contas no tier Dev; TikTok: app review com vídeo; ambos sem MCP oficial útil hoje |

**Pendências de operação (bloqueiam o e2e real).**

- [ ] `SUPABASE_SERVICE_ROLE_KEY` em `.env.local` e na Vercel
- [ ] Token de system user da Meta (BM da agência, `ads_read`)
- [ ] Developer token Google Ads (API Center da MCC) + OAuth client + ID da MCC
- [ ] `CRON_SECRET`, deploy na Vercel, `NEXT_PUBLIC_APP_URL` e redirect URIs
- [ ] Uma conta real Meta e uma Google cadastradas; comparação de um dia com os painéis
- [ ] Fixtures substituídas por capturas reais anonimizadas
- [ ] CLEANUP do seed antes de clientes reais

**Minors deferidos da revisão (não bloqueiam).** `money(null)` mostra `R$ 0,00` em CPC/CPL sem base (a tabela mostra –); drill-down sem KPIs e gráficos, só tabela; 6 chamadas Meta concorrentes por janela em backfills grandes; `appUrl()` cai em localhost se `NEXT_PUBLIC_APP_URL` faltar; `<html lang="en">`; proxy chama `getUser()` em rotas públicas; sessão e cliente consultados duas vezes por render (layout + página); Meta usa `status` e não `effective_status`; corpo 5xx não-JSON vira `SyntaxError` em `sync_runs.error`.

**Decisões registradas que valem para os próximos blocos.** Sem SDKs de plataforma; sem multi-organização ou billing; fuso único BRT; tokens em `connections` (Vault só se virar SaaS); placeholders insert-only para entidades órfãs; totais sempre no nível campanha; tudo em `main`, commits por seção funcional.
