# Ads Flight Deck

Painel interno de tráfego pago para acompanhar clientes, investimento e resultados de Meta Ads e Google Ads.

Este projeto foi criado do zero. O arquivo `AdsOps — Guia de Desenvolvimento.md` é uma referência de requisitos; suas afirmações de trabalho já concluído ou infraestrutura existente não descrevem este repositório.

## Executar localmente

Requer Node.js 22 ou superior.

```powershell
npm ci
npm run dev
```

Abra <http://localhost:3000>. Sem configuração Supabase, a página inicial abre `/demo`: uma demonstração identificada com dados fictícios, filtros e detalhamento de campanhas. A demonstração não permite gravar dados ou acessar contas reais.

O painel real usa `/login`, `/admin` e `/c/[slug]`. Configuração ausente leva a uma orientação de acesso, sem substituir os dados do cliente por dados de demonstração.

## Preparar um ambiente real

1. Crie um projeto Supabase para o Ads Flight Deck.
2. Em um novo ambiente, aplique os arquivos em `supabase/migrations/`, em ordem, mantendo o histórico de migrações. O projeto configurado no `.env` já recebeu as seis migrações, incluindo o filtro de plataforma em 21/10/2026; não as reaplique pelo SQL Editor. Evidências em `docs/development-status.md`.
3. Copie `.env.example` para `.env.local` (ou `.env`) e preencha URL, chave pública e chave de serviço. Nunca coloque a chave de serviço em variável `NEXT_PUBLIC_*`. Se os dois arquivos existirem, `.env.local` tem prioridade.
4. Em Supabase Authentication, crie o primeiro usuário administrador, com e-mail confirmado.
5. No SQL Editor, vincule esse usuário:

```sql
insert into public.profiles (user_id, role, client_id, email)
select id, 'admin', null, email
from auth.users
where email = 'SEU_EMAIL_ADMIN'
on conflict (user_id)
do update set role = excluded.role, client_id = null, email = excluded.email;
```

6. Reinicie a aplicação, entre em `/login` e cadastre clientes, conexões e contas.
7. Crie usuários dos clientes em Supabase Authentication e vincule-os em Administração → Usuários e acesso.
8. Execute os testes de `supabase/tests/` em um ambiente de teste. Usam transação e rollback; `npm test` também os executa em Postgres local em memória.

As chaves pública e de serviço autenticam a aplicação, mas não autorizam a criação de tabelas pelo CLI ou pela Management API. Para aplicar as migrações por essas ferramentas, use uma conta com acesso ao projeto ou um [token pessoal do Supabase](https://supabase.com/dashboard/account/tokens) limitado ao projeto, com permissão **Database read-write**. A variável opcional `SUPABASE_ACCESS_TOKEN` serve para esse gerenciamento e não deve ser enviada ao navegador. Ao usar o CLI, exporte essa variável no processo; não presuma que ele carregará o `.env` do Next.js.

## Credenciais

| Variável | Finalidade |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do novo projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública do projeto |
| `SUPABASE_SERVICE_ROLE_KEY` | Escritas administrativas e sincronização; somente servidor |
| `NEXT_PUBLIC_APP_URL` | Origem pública da aplicação; localhost no desenvolvimento |
| `CRON_SECRET` | Segredo longo e aleatório que protege o cron |
| `META_APP_ID`, `META_APP_SECRET` | Aplicativo Meta para OAuth |
| `META_API_VERSION` | Versão Graph; valor inicial `v25.0` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Cliente OAuth Google |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | MCC opcional para cadastro manual de conta em conexão compartilhada; OAuth salva o MCC por conta |
| `GOOGLE_ADS_API_VERSION` | Versão Google Ads; valor inicial `v26`; configuração existente é respeitada |

O fluxo normal da Meta usa OAuth: **Administração → Conectar Meta → autorizar → escolher cliente → escolher conta → Vincular e importar histórico**. Nome, ID, moeda e fuso vêm da plataforma. Uma conexão existente oferece **Selecionar contas**; na mesma conta/cliente, atualizar a conexão permite renovar a autorização. O vínculo não transfere contas de outro cliente. Tokens e IDs manuais ficam nas opções avançadas.

Google segue **Conectar Google → autorizar → escolher cliente e conta → Vincular e importar histórico**. A seleção descobre contas diretas e contas sob administradoras (MCC), valida moeda/fuso e salva a rota de acesso por conta. Contas administradoras são exibidas, mas não podem ser vinculadas como contas de anúncios. Falhas parciais de descoberta aparecem como avisos. O refresh token fica no servidor.

Para configurar Google, no mesmo projeto do Google Cloud: habilite Google Ads API, configure a tela de consentimento e crie um cliente OAuth do tipo **Aplicativo da Web** em **Google Auth Platform → Clientes**. Copie o ID e o segredo para `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`. Cadastre o callback exato abaixo (local: `http://localhost:3000/api/oauth/google/callback`). Se o aplicativo estiver em teste, inclua o usuário em Público-alvo → Usuários de teste. Para contas de anúncios reais, confira a aprovação de acesso de produção na página Google Ads API Overview do Cloud. Desde 09/09/2026, o acesso pertence ao projeto Cloud e developer token não é mais obrigatório, conforme [documentação Google](https://developers.google.com/google-ads/api/docs/api-policy/developer-token).

Os nomes de conversão Google são opcionais: vazio usa todas as conversões retornadas. Na Meta, o painel usa o resultado oficial e **não exige configurar ações de lead**. A configuração antiga de leads é preservada para compatibilidade, mas não determina o novo indicador de resultado.

Callbacks OAuth:

```text
https://SEU_DOMINIO/api/oauth/meta/callback
https://SEU_DOMINIO/api/oauth/google/callback
```

As permissões dos aplicativos e os vínculos BM/MCC precisam permitir acesso às contas. Conexão própria de cliente é iniciada pelo administrador no detalhe de “Usuários e acesso”; o vínculo fica limitado ao cliente escolhido. O código não presume autorização concedida ou aplicativos aprovados.

## Filtros e medição

- A entrada mostra **Meta Ads e Google Ads em seções independentes**, com indicadores, gráficos e campanhas próprios. **Ambas, separadas** nunca calcula um consolidado entre plataformas. O seletor pode focar em Meta ou Google. Período/status são compartilhados como critérios; comparações são sempre internas à plataforma. Listas de campanhas ficam recolhidas na visão inicial e abertas ao focar uma plataforma. Os filtros permanecem ao detalhar e voltar.

- Para conectar contas, vá a **Administração → selecione o cliente → Gerenciar contas**. Escolha Meta/Google ou uma autorização existente, selecione a conta e confirme o vínculo/importação. A tela agrupa as contas do cliente por plataforma e mostra a sincronização. Cadastros e configuração manual ficam em **Cadastros e opções avançadas**.

- O seletor **Campanhas: Todas / Ativas / Pausadas** filtra tabela, indicadores, gráficos e comparação. Usa o status da última sincronização nos dois períodos; não reconstrói o status histórico. Período e filtro permanecem ao abrir conjuntos/anúncios e voltar.
- O objetivo Meta aparece junto ao nome da campanha. O resultado é o indicador oficial de `results`, por exemplo conversas iniciadas, leads, compras ou visitas ao perfil. Um mesmo objetivo pode ter resultados diferentes conforme a configuração da campanha.
- Quantidades e custos ficam separados por tipo. Custo por resultado exige cobertura completa e uma unidade compatível; valores de janelas de atribuição distintas não são somados.
- Resultado ausente, sem valor ou não aditivo (como alcance de pessoas únicas) aparece como indisponível/parcial. Zero só aparece quando retornado explicitamente. Totais parciais não exibem custo nem comparação como se fossem completos. Reprocessar atualiza o histórico, mas não inventa valores omitidos pelo provedor.
- Google apresenta **Conversões configuradas** e o canal da campanha; isso não presume que o canal seja o objetivo de conversão.

## Edição de campanhas

No detalhe de uma campanha, administradores têm o link **Editar status ou orçamento da campanha**. O fluxo consulta o estado atual, prepara uma proposta com os valores anterior e novo e exige confirmação explícita. A proposta expira em dez minutos e só seu autor pode executá-la, uma vez. Uma mudança no estado consultado impede a execução de uma proposta desatualizada.

- Status: pausar ou reativar campanhas existentes na Meta e no Google.
- Orçamento: apenas diário, próprio da campanha e em BRL. Orçamentos compartilhados Google, vitalícios e definidos no conjunto Meta ficam bloqueados, com explicação na tela.
- Meta: use **Autorizar gerenciamento Meta** e vincule a conta à nova conexão. A plataforma precisa conceder `ads_management`; o OAuth de leitura continua usando `ads_read`.
- Google: a conta autorizada precisa ter acesso de edição. A prévia usa `validateOnly` antes da confirmação.
- Cada proposta e seu resultado ficam no histórico administrativo. Timeout ou falha de conferência após a escrita mantém a campanha bloqueada para novas alterações. **Reconferir estado** apenas consulta a plataforma; se o valor proposto estiver presente, registra a conferência e libera a trava. Se não coincidir, o bloqueio permanece para investigação, sem repetir a escrita.
- O painel de resultados recebe o novo status na próxima sincronização. O editor consulta diretamente a plataforma.

As escritas foram verificadas com respostas simuladas; nenhuma campanha real foi alterada durante o desenvolvimento. MCP permanece para uma etapa posterior, reutilizando as mesmas regras de autorização e confirmação.

## Sincronização

- Cron previsto para 07:00 UTC, equivalente a 04:00 em Brasília.
- Execução diária reprocessa sete datas, incluindo hoje.
- Cadastro de conta solicita 90 dias; reprocessamentos são divididos em janelas inclusivas de 30 dias.
- Contas precisam usar BRL e `America/Sao_Paulo`. O conector verifica isso para evitar comparar moedas ou dias diferentes como se fossem iguais.
- Uma falha de conta não impede a tentativa das seguintes.
- `sync_runs` registra início, janela, resultado e código de erro sem tokens.
- Cada janela é substituída atomicamente após a coleta completa, removendo também registros que a plataforma deixou de retornar. Uma falha na gravação preserva o snapshot anterior.
- Entidades são identificadas por conta, nível e ID externo. IDs de anúncios Google incluem o grupo.
- Tokens só ficam acessíveis com a chave de serviço. A visão administrativa expõe metadados, com RLS e permissões por coluna.
- Totais e séries consideram exclusivamente campanhas.
- Desativar sincronização interrompe futuras coletas da conta e preserva o histórico. Isso não pausa campanhas na Meta ou no Google.

A implementação usa execução síncrona com limite de 300 segundos. Backfills grandes podem precisar ser reprocessados por intervalos menores; contas interrompidas ficam registradas e o bloqueio de execução expira após dez minutos. Para maior volume, evoluir para processamento durável e envio de métricas em staging. O RPC atual recebe uma janela completa por chamada.

Para chamar o cron manualmente, envie `Authorization: Bearer <CRON_SECRET>` a `/api/cron/sync`. Parâmetros opcionais: `account=<uuid>&from=YYYY-MM-DD&to=YYYY-MM-DD`. As duas datas devem ser enviadas juntas; o intervalo máximo é de 367 datas inclusivas. Nunca inclua o segredo na URL.

## Verificar

```powershell
npm test
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Os testes de banco executam o SQL em Postgres local em memória (PGlite), simulando as funções de identidade e permissões dos papéis Supabase. Isso verifica SQL/RLS, mas não substitui a validação no Supabase remoto.

Os testes de navegador iniciam um ambiente isolado **sem credenciais Supabase** em `http://127.0.0.1:3001`, usando `.next-e2e/`. Preservam o servidor real na porta 3000 e geram capturas em `.local/`. A suíte cobre filtros de período/status, navegação e retorno, estados vazios e mobile.

Na auditoria de 20/10/2026, `npm audit --omit=dev` retornou zero vulnerabilidades. A auditoria completa apontou nove entradas de severidade alta nas cadeias de ferramentas ESLint/shadcn (`braces`/`fast-glob`); detalhes e limites estão em `docs/development-status.md`. As sugestões de downgrade incompatível não foram aplicadas.

Antes de operar com clientes:

- Verificar login de administrador e cliente no Supabase real, incluindo tentativa de acesso a outro cliente.
- Autorizar uma conta Meta e uma Google, sincronizar e comparar investimento e cliques de um dia com as plataformas.
- Conferir os tipos de resultado e as janelas de atribuição com a agência.
- Registrar fixtures reais anonimizadas para complementar as respostas simuladas dos testes.
- Configurar deploy, variáveis, callbacks e cron; conferir a primeira execução agendada.

## Deploy

Para importar este repositório privado na Hostinger, consulte [Configuração da Hostinger](docs/hostinger-deployment.md). A publicação e a configuração do agendamento são etapas separadas do envio ao GitHub.

### Páginas públicas para OAuth

O aplicativo oferece `/sobre`, `/termos` e `/privacidade`, sem login e sem consultar o banco. Há links na entrada e no rodapé. Após publicar em um domínio HTTPS, cadastre essas URLs em Google Auth Platform → Branding como página inicial, termos e privacidade, respectivamente. O domínio da política deve acompanhar o da apresentação, e o nome no consentimento deve representar o Ads Flight Deck. URLs localhost servem apenas para revisão local.

Os textos refletem a implementação atual e identificam a **Midnight Puppies Studios** como responsável, com `contato@midnightpuppies.com.br` para contato. Revisar os compromissos operacionais antes da publicação. Detalhes e referências em [docs/public-pages.md](docs/public-pages.md). A verificação de marca e as páginas públicas não substituem o acesso Explorer para consultar contas de anúncios reais.

O projeto está preparado para um deploy Next.js na Vercel com `vercel.json`. Configure as variáveis antes do build, use a URL HTTPS final e registre os callbacks OAuth. Verifique limites e elegibilidade do plano contratado para uso comercial e execução de funções. O aplicativo completo ainda não foi implantado.

**Atualização de hospedagem:** as páginas públicas foram publicadas separadamente via Sites em [Ads Flight Deck](https://ads-flight-deck-midnight-puppies.dragon-dreamer.chatgpt.site). O subdomínio `ads.midnightpuppies.com.br` aguarda os registros DNS na Hostinger, descritos em [docs/public-hosting.md](docs/public-hosting.md). O aplicativo Next.js completo ainda não foi implantado; seus callbacks permanecem locais.

## Organização

- `src/app`: páginas, server actions, cron e OAuth.
- `src/components`: painel e componentes shadcn/ui.
- `src/lib/connectors`: acesso de leitura Meta/Google e normalização.
- `src/lib/sync.ts`: coleta, persistência e registro.
- `src/lib/supabase`: clientes da sessão e de serviço.
- `supabase/migrations`: schema, permissões e RPCs.
- `supabase/tests`: testes SQL reproduzíveis.
- `docs/development-status.md`: evidências, decisões e próximos passos.

## Próximos blocos

Validação de leads/CRM, integração MCP, agentes com aprovação humana, análise de criativos, relatórios e novas plataformas serão desenvolvidos em etapas posteriores.

A ordem proposta por impacto operacional, com dependências e critérios de conclusão, está em [Prioridades para produção](docs/production-priorities.md).

## Referências técnicas

- [Next.js](https://nextjs.org/docs/app/getting-started/installation)
- [Supabase SSR e cookies](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Google Ads Search e SearchStream](https://developers.google.com/google-ads/api/rest/common/search)
- [Google Ads e métricas zeradas](https://developers.google.com/google-ads/api/docs/reporting/zero-metrics)
- [Meta Insights](https://developers.facebook.com/docs/marketing-api/insights/)
