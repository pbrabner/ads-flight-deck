# Ads Flight Deck — estado do desenvolvimento

## Atualização dos dados no dashboard — 21/10/2026

Cada seção de plataforma agora mostra a situação das contas vinculadas, incluindo sincronização desativada, falha, execução em andamento/interrompida, ausência de coleta e status indisponível. O detalhamento mostra horário em Brasília e janela da coleta bem-sucedida com data final mais recente. Reprocessar um período antigo não substitui essa referência. O administrador tem acesso direto à gestão do cliente; o cliente recebe apenas informações operacionais resumidas.

Coleta recente significa conclusão há até 36 horas com janela alcançando pelo menos ontem; é um indicador operacional, não uma garantia de cobertura de todo o período selecionado ou anterior. Falhas posteriores não apagam a referência de sucesso. Execuções que ultrapassam dez minutos aparecem como não concluídas. A demonstração permanece explicitamente fictícia e não inventa sincronizações reais.

Nenhuma migração necessária. As contas são resolvidas pela sessão/RLS e por cliente/plataforma antes da leitura de seus registros operacionais no servidor. A função recusa acesso de clientes a outro cliente e devolve um resumo sem tokens ou erros brutos. Falhas na consulta do histórico não impedem a exibição das métricas, mas são identificadas como status indisponível.

Validação: 83 testes de lógica/SQL, cinco testes de navegador, tipagem, lint e build de produção aprovados. Smoke com dados reais confirmou duas plataformas, três contas e dois horários de coleta; desktop e celular sem transbordamento. Não houve sincronização, escrita em anúncios ou mudança de permissões durante a validação. A conciliação completa com os relatórios dos provedores continua pendente.

## Remoção de conexões sem uso — 21/10/2026

Administradores podem remover conexões em “Gerenciar conexões salvas” ou na seção avançada de conexões. A exclusão exige confirmação explícita, remove apenas o registro e as credenciais locais e não revoga permissões no provedor. Conexões com contas vinculadas, mesmo com sincronização desativada, são bloqueadas pela chave estrangeira existente. A tela lista os vínculos de todos os clientes e orienta reconectar as mesmas contas por uma autorização válida, preservando contas, campanhas e histórico. Nenhuma migração foi necessária.

Validação: 77 testes aprovados, incluindo confirmação obrigatória, proteção SQL contra exclusão em uso, restrição às operações do servidor e preservação das métricas após transferência do vínculo. Tipagem e lint passaram. Navegador validado em desktop e celular com dois estados bloqueados e três disponíveis para remoção; nenhuma conexão real foi excluída.

## Extensão da experiência para novas plataformas — 21/10/2026

Catálogo central de apresentação adotado pelo dashboard, tabelas, filtros e conexão por cliente. Cada relatório carrega uma única plataforma, incluindo a série anterior. TikTok e LinkedIn têm configurações de apresentação, mas permanecem indisponíveis até a implementação de seus conectores, OAuth e suporte no banco. O roteiro de habilitação e os critérios de isolamento estão em `docs/platform-experience.md`.

Validação desta extensão: 76 testes de lógica/SQL e cinco testes de navegador aprovados, typecheck e lint sem erros. Nenhuma alteração remota ou ativação de integração foi feita.

## Base

Em 20/10/2026, a pasta continha apenas o guia de referência. Todos os itens do guia são requisitos a construir. Nome aprovado: **Ads Flight Deck**.

## Execução

Plano: `docs/superpowers/plans/2026-10-20-ads-flight-deck.md`.

- Fundação: implementada com Next.js 16.4.2, React 19.3.1 e TypeScript.
- Banco e sessão: migrações aplicadas no Supabase remoto, RLS e RPCs verificados; primeiro administrador criado e login, acesso à administração e logout validados no navegador.
- Dashboard: implementado, com demonstração independente, sete indicadores, gráficos, períodos e drill-down.
- Conectores e sincronização: Meta validada com conta real e histórico de 90 dias; Google exercitado com respostas simuladas, validação real pendente.
- Administração e OAuth: Meta com seleção de contas autorizadas e reconexão; Supabase real validado. OAuth Google implementado, validação real pendente.
- Verificação local: concluída. Revisão independente encontrou dois problemas, corrigidos e cobertos por regressões.

## Evidências da primeira entrega em 20/10/2026

| Verificação | Resultado |
| --- | --- |
| `npm test` | 27 testes aprovados |
| SQL em Postgres PGlite | Migrações, isolamento entre clientes, tokens, RPCs e substituição atômica aprovados |
| `npm run typecheck` | Sem erros |
| `npm run lint` | Sem erros ou avisos |
| `npm run build` | Build de produção concluído |
| `npm run test:e2e` | 3 cenários aprovados em Chromium |
| Navegador | Filtro, campanha → conjunto → anúncio, login não configurado, período sem dados, mobile sem overflow |
| Capturas | `.local/dashboard-desktop.png`, `.local/dashboard-mobile.png`, `.local/login-mobile.png`; inspecionadas as duas primeiras |
| `npm audit --omit=dev` | Zero vulnerabilidades conhecidas |

Os testes SQL incluem os antigos grants automáticos de Supabase para impedir que a migração dependa de privilégios restritos do ambiente de teste.

## Revisão independente

1. Reprocessamento podia manter linhas antigas quando a plataforma deixava de retorná-las. Corrigido com `replace_account_metrics`, RPC transacional limitado à conta/janela. Teste verifica remoção, escopo, rejeição de linhas de outra conta, preservação do snapshot em falha e privilégio apenas de serviço.
2. Histórico Google descartava metadados de entidades removidas. Corrigido unindo entidades do relatório e da listagem, com prioridade da listagem. Teste executa o conector com rede simulada e verifica os pais.

Ambas as regressões falharam antes das correções e passaram depois, com a suíte completa verde.

## Dependências externas

Supabase remoto configurado em 20/10/2026 no projeto `uigcezffozycjhfaazzm`, indicado pelo `.env` do usuário. As credenciais foram lidas sem registrar valores secretos.

- Migrações aplicadas via Management API: `20261020174149_initial_schema`, `20261020174159_atomic_metric_refresh` e `20261020174313_restrict_rls_event_trigger`.
- Nomes dos arquivos locais alinhados às versões geradas pelo histórico remoto.
- Sete tabelas da aplicação com RLS habilitado.
- `supabase/tests/rls.sql`: `RLS OK` no Postgres remoto.
- `supabase/tests/sync.sql`: `SYNC OK` no Postgres remoto.
- Testes executados com rollback; confirmado zero registros nas sete tabelas e em `auth.users` após os testes.
- Security Advisors: nenhum alerta após restringir o acesso direto à função de evento `public.rls_auto_enable()`, instalada pelo Supabase. O gatilho e a execução pelo proprietário foram preservados.
- PostgREST remoto: chave de serviço consulta as sete tabelas; acesso anônimo a clientes bloqueado (`42501`); RPC `metrics_timeseries` retorna série vazia corretamente.
- Suíte local após alinhar as migrações: 27 testes aprovados.
- Primeiro administrador criado com o e-mail indicado pelo usuário, confirmado no Auth e vinculado a `profiles` com papel `admin` e sem cliente. Senha inicial entregue em arquivo dentro de `.local/`, ignorado pelo Git; nenhum e-mail enviado.
- Autenticação real validada via SDK e pelo formulário da aplicação: entrada em `/admin` e saída para `/login`. O servidor de desenvolvimento foi reiniciado com acesso de rede ao Supabase.

Naquela etapa ainda não havia validação de login de cliente, concessão OAuth real ou contas reais. A atualização abaixo registra a validação Meta posterior. Login de cliente, Google real, deploy e execução agendada continuam pendentes.

## Atualização — OAuth Meta, status e resultados

Plano executado: `docs/superpowers/plans/2026-10-20-oauth-campaign-results.md`.

- Meta: callback OAuth abre seleção de cliente/conta. Conexões existentes oferecem seleção. A gravação revalida autorização, moeda/fuso e proprietário; permite reconectar a mesma conta/cliente e bloqueia transferência entre clientes. Cadastro importa 90 dias, sem exigir token ou ID manual nem nomes de ações de lead.
- Filtro Todas/Ativas/Pausadas aplicado aos relatórios atuais e anteriores, preservado nos períodos, detalhes e retorno. Status é o da última sincronização.
- `results` oficial da Meta é armazenado e agregado por indicador. Objetivo é exibido na tabela, sem deduzir resultados pelo nome da campanha. Google mantém conversões configuradas e canal identificados.
- Migração `20261020193131_campaign_results` aplicada remotamente. Novas funções `report_entities`/`report_series` usam invoker/RLS; RPC de substituição continua restrito ao serviço.
- Histórico da conta correta: 1.406 linhas reprocessadas em três janelas, com sucesso. Metadados de 79 campanhas disponíveis. Três indicadores encontrados: conversas iniciadas, cliques no link e visitas ao perfil. Foram normalizadas 18 linhas adicionais de visitas ao perfil usando o raw já importado.
- Smoke autenticado: 14 contas retornadas no seletor Meta; incompatíveis identificadas; sem credenciais no HTML inspecionado. Na consulta de 30 dias/ativas, 5 campanhas, 3 conversas e 67 visitas ao perfil em grupos separados. Desktop/mobile inspecionados e sem overflow.
- Casos reais de `indicator` sem `values` permanecem indisponíveis. Isso gera cobertura parcial e suprime custos agregados/comparações que poderiam parecer completos. Alcance e métricas únicas não são somados entre dias. O painel não promete equivalência a relatórios da Meta com outra atribuição.
- A conta antiga cadastrada com ID incorreto foi preservada. Há controle administrativo para desativar sua sincronização, sem apagar histórico nem modificar anúncios.
- Revisão independente dos novos fluxos não confirmou achados P1/P2. Relatório local em `.local/feature-review.md`.

| Verificação final | Resultado |
| --- | --- |
| `npm test` | 41 testes aprovados; inclui normalização, seleção, filtros, RPCs e RLS |
| `npm run typecheck` e `npm run lint` | Sem erros |
| `npm run build` | Build concluído, incluindo novo seletor administrativo |
| `npm run test:e2e` | 3 cenários aprovados em servidor isolado na porta 3001 |
| Fluxo real | Login admin, listagem Meta e painel autenticado validados |
| Supabase Advisors | Apenas aviso `auth_leaked_password_protection`; nenhuma configuração Auth alterada nesta tarefa |

Capturas: `.local/oauth-selector-desktop.png`, `.local/oauth-selector-mobile.png`, `.local/real-results-desktop.png`, `.local/real-results-mobile.png`. A concessão OAuth já existente foi reutilizada no smoke; nenhuma nova conta foi vinculada só para teste. Renovação real de consentimento e aprovação de app dependem da Meta. Google ainda requer ID no cadastro avançado e não ganhou descoberta automática de contas nesta etapa.

## Atualização — Google OAuth e edição administrativa

Plano: `docs/superpowers/plans/2026-10-20-google-and-campaign-editing.md`.

- Google ganhou seleção de contas diretas e via MCC após OAuth, validação do vínculo no servidor e `login_customer_id` por conta. A descoberta tem limites de profundidade/consultas e informa resultados parciais. Conexões não transferem contas entre clientes. Developer token deixou de ser exigido, seguindo a migração oficial do Google para acesso pelo projeto Cloud em 09/09/2026.
- Administradores podem abrir o editor no detalhe de campanha, consultar status/orçamento e preparar uma proposta para pausar/reativar ou ajustar orçamento diário próprio. Valores em reais são convertidos exatamente para centavos Meta ou micros Google. Orçamentos compartilhados, vitalícios e de conjunto não são editados nesta versão.
- Confirmação explícita por proposta, autor e prazo de dez minutos; estado reconsultado antes da aplicação; claim atômico e uma execução pendente por campanha. Histórico preserva proposta imutável e resultado. Resposta incerta ou falha de leitura após escrita aceita mantém a trava; reconferir consulta o estado sem repetir a operação. Pendências permanecem visíveis mesmo fora dos 30 registros recentes.
- OAuth Meta oferece autorização adicional de gerenciamento. A conexão real atual tem leitura e o editor corretamente apresentou o pedido de autorização, com os controles de escrita desabilitados.
- Migração `20261020201258_campaign_management` aplicada no Supabase configurado: coluna MCC, tabela de propostas, RLS, grants restritos e função de claim. RLS remoto confirmado; Advisors retornou apenas o aviso preexistente `auth_leaked_password_protection`.
- Revisão independente encontrou e confirmou a correção de dois pontos: leitura após escrita não pode indicar falha definitiva; operação incerta não pode desaparecer pelo limite de histórico. Sem achados pendentes no escopo revisado.

| Verificação | Resultado |
| --- | --- |
| `npm test` | 71 testes aprovados, incluindo unidades monetárias, permissões, descoberta, propostas, SQL e RLS |
| `npm run typecheck` / `npm run lint` | Sem erros |
| `npm run build` | Concluído, incluindo seletor Google e editor de campanha |
| `npm run test:e2e` | 3 testes do painel em ambiente isolado aprovados |
| Meta real | Login admin e leitura de campanha no editor; desktop/mobile sem overflow |
| Google real | Credenciais preenchidas; início OAuth retorna 307 para accounts.google.com, callback localhost correto, offline e state presentes; nenhuma conexão Google autorizada ainda |
| Escritas em anúncios | Apenas testes simulados; nenhuma campanha real alterada |

Capturas: `.local/campaign-editor-desktop.png` e `.local/campaign-editor-mobile.png`. Logs de build e E2E em `.local/build-management.log` e `.local/e2e-management.log`. O teste SQL verifica claims sequenciais, replay, expiração, isolamento e restrições; não simula transações concorrentes entre sessões. A proteção de concorrência usa bloqueio de linha e índice único parcial no banco.

Pendente: concluir consentimento Google pelo botão **Conectar Google**, validar descoberta/sincronização de uma conta real, conceder gerenciamento Meta se desejado e validar uma alteração real escolhida e confirmada pelo administrador. MCP ainda não foi implementado. Uma resposta incerta cujo estado atual não coincida com a proposta permanece bloqueada para investigação.

## Limites conhecidos

### Análise independente e conexão por cliente — 21/10/2026

Direção aprovada pelo usuário em `docs/platform-experience.md`. O dashboard deixou de apresentar somas e taxas combinadas entre Meta e Google. A entrada carrega dois snapshots via filtro de plataforma existente, cada qual com séries atuais/anteriores, KPIs, gráficos e campanhas próprios. As listas são recolhidas na visão de ambas; comparação interna e semântica de resultados permanecem explícitas. Gradientes dos gráficos usam IDs únicos para permitir múltiplos gráficos do mesmo tipo.

Administração começa pela escolha de cliente, com contas e autorizações disponíveis separadas por plataforma. OAuth novo recebe o proprietário selecionado; autorizações compartilhadas existentes continuam reutilizáveis. Seleção oferece revisão de nome, ID e cliente antes de confirmar a importação. Retornos de vínculo e ações de sincronização preservam o cliente. Nenhuma nova migração ou alteração de campanhas foi necessária.

Validação: 74 testes de lógica/SQL, cinco testes E2E, tipos, lint e build aprovados. Smoke autenticado confirmou Meta (79 campanhas), Google (52), conexões do cliente e as duas seleções com confirmação contextual. Inspeção em 1440/390 px sem overflow, sem confirmar novos vínculos ou alterar anúncios. Capturas `.local/analysis-redesign-*`, `.local/connections-redesign-*` e `.local/selector-*`. Scripts de leitura e logs em `.local/`; nenhuma credencial registrada nas saídas.

### Filtro de plataforma — 21/10/2026

Usuário confirmou a conexão Google concluída. Implementado seletor Todas as plataformas / Meta Ads / Google Ads no painel real e na demonstração. Preserva plataforma, status e período no detalhamento e retorno. As RPCs `report_entities` e `report_series` recebem `p_platform` opcional, filtrando antes das agregações; mantêm `security invoker`, RLS e acesso restrito a authenticated/service_role.

Migração `20261021035451_report_platform_filter.sql` aplicada no projeto configurado após autorização explícita do usuário. O arquivo inicialmente criado como `20261021034917` foi renomeado para coincidir com a versão registrada pela Management API. Não altera registros de campanhas ou anúncios. A visão consolidada omite o argumento opcional para também ser compatível durante a implantação.

Verificação: 74 testes de lógica/SQL aprovados, quatro testes de navegador aprovados (incluindo plataforma + status + período + navegação, mobile e parâmetros inválidos), typecheck, lint e build concluídos. Leituras reais validaram 18 combinações de plataforma/status/período: séries e tabelas conciliadas, consolidado igual à soma das plataformas. Foram encontradas 79 campanhas Meta e 52 Google no cliente configurado. Advisors sem novos alertas de banco; permanece o aviso pré-existente sobre proteção de senhas vazadas. Logs: `.local/e2e-platform-filter.log` e `.local/build-platform-filter.log`.

### Diagnóstico Google após consentimento — 20/10/2026

OAuth Google concluído e renovação do token validada. `listAccessibleCustomers` retornou dois recursos (HTTP 200), mas a consulta de metadados retornou HTTP 403, `ACTION_NOT_PERMITTED` na API v23: o projeto Cloud está aprovado apenas para contas de teste. Próximo passo externo é solicitar acesso Explorer no mesmo projeto OAuth em Google Ads API Overview e, após aprovação, consultar as contas novamente.

A aplicação agora reconhece esse diagnóstico no formato SearchStream (array) e no formato objeto, incluindo o código moderno `CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION`. Exibe orientação e link para o Cloud sem expor o texto bruto da API; preserva contas que puderam ser consultadas. Outros erros `ACTION_NOT_PERMITTED` continuam genéricos para não atribuir uma causa incorreta.

Verificação: 73 testes aprovados, typecheck e lint sem erros; navegador autenticado confirmou a nova mensagem com a resposta real. Captura `.local/google-production-access-required.png`. Nenhum anúncio ou configuração Cloud foi alterado. Acesso a dados Google reais permanece pendente de aprovação externa.

- Execução síncrona em até 300 segundos: backfills grandes podem exigir intervalos menores. O estado de execução interrompida é recuperável após dez minutos.
- Uma janela de até 30 dias é enviada ao RPC de métricas em uma chamada. Contas grandes poderão exigir staging e processamento durável.
- Primeira versão aceita BRL e horário de São Paulo; contas com outras configurações são rejeitadas explicitamente.
- Auditoria completa de dependências apontou 9 entradas de severidade alta em ferramentas de desenvolvimento, derivadas de `braces`/`fast-glob` e cadeias de ESLint/shadcn. A ferramenta shadcn foi movida para desenvolvimento. Não há alerta nas dependências de produção. Não foi aplicada a sugestão automática de downgrade de major para ferramentas incompatíveis.

## Decisões

- Implementação local autorizada pelo usuário; sem interrupção adicional para aprovação do plano.
- Diretório inicial sem código ou Git: trabalhar diretamente na pasta aprovada, mantendo o guia como referência.
- Documentação de execução permanece no repositório.
- Versões obtidas do registro npm; opções do CLI shadcn foram adaptadas para a versão disponível (`--base base`).
- A demonstração usa dados locais fictícios, evitando criar usuários ou dados em infraestrutura externa.
- Metadados de conexões usam view com `security_invoker` e grants por coluna; tokens permanecem inacessíveis aos usuários autenticados, inclusive administradores.
- Reprocessamento substitui a janela atomicamente, em vez de apenas upsert: isso evita retenção de conversões retraídas. Custo: payload completo por janela.
- Ad IDs Google usam `ad_group_id:ad_id`; custo: o ID técnico difere do ID visual da plataforma, preservando unicidade.
- Caminhos de execução local mantidos na pasta aprovada, sem commit, push ou deploy automático.

## Próximo passo

Validar acessos de cliente e Google com uma conta real, conferir os resultados com o Gerenciador de Anúncios usando o mesmo período/atribuição, e preparar deploy e cron. Blocos 2–6 seguem pendentes.
