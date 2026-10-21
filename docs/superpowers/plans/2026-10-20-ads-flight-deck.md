# Ads Flight Deck Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task. Track verification in `docs/development-status.md`.

**Goal:** Implementar do zero o bloco 1: autenticação, administração, coleta de anúncios e dashboards isolados por cliente.

**Architecture:** Aplicação Next.js com componentes de servidor e Supabase para autenticação e Postgres. Conectores de leitura normalizam Meta e Google; sincronização idempotente grava métricas por entidade/dia. Demonstração local usa dados fictícios explicitamente identificados e não concede acesso administrativo.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, Recharts, Supabase, Zod, testes nativos do Node via tsx.

**Spec:** `AdsOps — Guia de Desenvolvimento.md`, reinterpretado integralmente como requisitos pendentes; nome aprovado: Ads Flight Deck.

## Global Constraints

- Pasta de trabalho: `D:\Projetos Pessoais\Ads Fight Deck`; identificador `ads-flight-deck`.
- Nenhum código, banco, conta ou implantação mencionado no guia será considerado existente.
- Bloco 1 somente lê as plataformas. Leads/CRM, agentes, criativos, relatórios e novas plataformas ficam para blocos posteriores.
- Interface em pt-BR; fuso `America/Sao_Paulo`; moeda BRL na primeira versão.
- Totais usam exclusivamente campanhas; divisões sem denominador retornam ausência de valor.
- Credenciais no servidor; permissões administrativas verificadas em cada mutação; RLS em todas as tabelas.
- Versões e contratos externos precisam ser verificados antes de uso. Referências históricas do guia não fixam versões inexistentes.
- Integração real e deploy exigem configuração e validação próprias; testes simulados não provam acesso a contas reais.

## Review Focus

1. Troca de slug/UUID não permite consultar dados de outro cliente.
2. Identificadores externos repetidos em contas diferentes não colidem.
3. Datas inválidas, virada do dia em BRT e meses de tamanhos diferentes.
4. Timeout, paginação, token inválido e falha parcial não produzem sucesso fictício nem expõem tokens.
5. Demonstração nunca substitui silenciosamente dados reais ou autenticação.

## Task 1: Fundação e regras de métricas

**Files:** `package.json`, configurações Next/TS/ESLint, `src/lib/{period,metrics,format}.ts`, testes correspondentes.
**Interfaces:** `periodFromParams(params, now): Period`; `totals(rows): Totals`; `ratio(numerator, denominator): number | null`.

- [x] Criar configuração e instalar versões disponíveis, com lockfile.
- [x] Escrever testes de períodos inclusivos, datas inválidas, mês anterior, BRT e divisão por zero; executar e observar falha.
- [x] Implementar funções puras e verificar os testes.

## Task 2: Persistência, isolamento e sessão

**Files:** `supabase/migrations/*`, `supabase/tests/rls.sql`, `src/lib/supabase/{server,admin}.ts`, `src/lib/auth.ts`, `src/proxy.ts`, `/login`.
**Interfaces:** `requireSession()` retorna usuário/perfil; `requireAdmin()` restringe administração; `createServerClient()` respeita cookies/RLS.

- [x] Definir clients, profiles, connections, ad_accounts, entities, metrics_daily e sync_runs.
- [x] Escrever teste SQL com dois clientes e admin, cobrindo tabelas e RPCs.
- [x] Implementar políticas, constraints e agregações; tokens sem acesso pelos papéis públicos.
- [x] Implementar login/logout e tratamento de perfil ausente, sem loop.
- [x] Verificar tipos e preparar instruções de aplicação em projeto Supabase novo.

## Task 3: Dashboard e demonstração

**Files:** `src/app/{demo,c/[slug]}/**`, `src/components/**`, `src/lib/{queries,demo}.ts`.
**Interfaces:** dashboard recebe cliente, período, série, totais anteriores e entidades; drill-down mantém o período.

- [x] Criar identidade visual de painel operacional: navegação azul-marinho, área de trabalho clara, acento azul e dados com alinhamento tabular.
- [x] Construir sete KPIs, comparação, gráficos diários, filtros e tabela com drill-down.
- [x] Disponibilizar demonstração explicitamente fictícia sem credenciais.
- [x] Verificar no navegador em desktop e mobile, incluindo período sem dados.

## Task 4: Conectores e sincronização

**Files:** `src/lib/connectors/{types,meta,google,http}.ts`, testes, `src/lib/sync.ts`, `/api/cron/sync`.
**Interfaces:** `Connector.sync(account, token, from, to)` retorna entidades e métricas normalizadas; `syncAccount()` registra resultado; `syncAll()` isola falha por conta.

- [x] Testar normalização, MCC condicional, paginação, erros e janelas inclusivas antes da implementação.
- [x] Implementar leitura Meta/Google via fetch, com timeout e mensagens sem segredos.
- [x] Implementar upsert por conta/nível/ID e placeholders que preservam entidades existentes.
- [x] Adicionar cron autenticado, execução manual e backfill de 90 dias em janelas.
- [x] Verificar fronteiras de rede com respostas controladas; registrar a validação real como pendente.

## Task 5: Administração e OAuth

**Files:** `src/app/admin/**`, `src/app/api/oauth/[platform]/{start,callback}/route.ts`, `src/lib/validation.ts`.
**Interfaces:** actions para clientes, conexões, contas, vínculo de usuários e sync; OAuth com state consumível e sessão admin.

- [x] Testar entradas inválidas e regras de vínculo conta/conexão.
- [x] Implementar formulários e resultados visíveis, sem renderizar tokens.
- [x] Implementar OAuth com escopos mínimos, state httpOnly e validação de origem.
- [x] Garantir que cadastro/sync com erro não desapareça como sucesso.

## Task 6: Verificação e entrega

**Files:** `README.md`, `.env.example`, `vercel.json`, `docs/development-status.md`.

- [x] Executar testes unitários, TypeScript, ESLint e build.
- [x] Revisar fluxo no navegador, inclusive login sem infraestrutura e demonstração.
- [x] Solicitar revisão independente do conjunto e corrigir problemas relevantes.
- [x] Documentar configuração, evidências e bloqueios externos exatos.

## Decisões de execução

Autorização do usuário: “Ok, pode seguir”. Implementação nesta pasta, que contém somente o guia, sem reutilizar infraestrutura anterior. A execução segue diretamente após este plano. Nenhuma publicação externa é implícita nesta etapa.
