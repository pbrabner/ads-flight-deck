# OAuth, filtros e resultados por campanha

> Execução autorizada pelo pedido do usuário. Aplicar superpowers:subagent-driven-development para o fluxo OAuth e executing-plans para integração e revisão final. Pasta existente sem Git; não criar commits/worktrees artificiais.

**Objetivo:** conectar contas Meta por seleção após OAuth, filtrar o painel por status atual e apresentar resultados oficiais por objetivo sem soma de unidades incompatíveis.

**Arquitetura:** Next.js server actions com autorização administrativa; tokens apenas no servidor. Dados Meta `results` normalizados na sincronização e persistidos como JSON tipado por dia. Novos RPCs invoker com RLS para filtros e agregação. UI mantém paleta e tipografia existentes.

**Decisões:** todas as campanhas por padrão; opções ativas/pausadas usam status na última sincronização e afetam tabela, KPIs, gráficos e comparação. Objetivo é informativo; resultado vem da Meta, sem inferência por nome da campanha. Valores de janelas de atribuição não são somados. Resultados indisponíveis não viram zero. Google mantém conversões configuradas, explicitamente identificadas, sem prometer detecção de objetivo Meta para Google.

## Tarefa 1 — conexão Meta por OAuth e seleção
- [x] Testar listagem paginada, host confiável, metadados validados, moeda/fuso incompatíveis e erros sem tokens.
- [x] Criar página administrativa de seleção de contas por conexão; callback Meta redireciona para ela. Reutilizar conexões existentes por link "Selecionar contas".
- [x] Server action revalida conta na Meta e vínculo com cliente, bloqueia duplicação entre clientes, permite atualizar conexão no mesmo cliente; sincroniza histórico ao cadastrar.
- [x] Colocar tokens/IDs manuais em opção avançada. Selecionar cliente antes de vincular, identificar incompatibilidades, preservar OAuth Google existente.
- [x] Testar, revisar e documentar.

## Tarefa 2 — resultados oficiais e status
- [x] Testes RED de normalização de `results`: valor padrão, zero real, ausência, múltiplos indicadores/janelas, duplicações, valores inválidos; filtros demo e SQL com isolamento RLS.
- [x] Adicionar `metrics_daily.results` nullable e normalização no conector/persistência. RPC atômico preserva JSON. Novos RPCs `report_entities`/`report_series` incluem status, objetivo, resultados agrupados e cobertura.
- [x] Status `all|active|paused`; métricas atuais e anteriores filtradas pelo mesmo conjunto de campanhas. Preservar parâmetro ao mudar período e navegar detalhes.
- [x] Dashboard/tabela exibem objetivo, tipo/quantidade/custo de resultado. Resumo agrupa por tipo e só calcula custo para conjunto homogêneo com cobertura completa. Nunca somar conversas e compras em um total genérico.
- [x] Testar unidade/SQL, migração remota e reprocessar apenas conta Meta válida do cliente para preencher histórico.

## Tarefa 3 — verificação integrada
- [x] Lint, typecheck, build e suíte local; E2E demo em servidor isolado sem credenciais e smoke autenticado na aplicação real.
- [x] Inspeção desktop/mobile, fluxo lista de contas sem token no HTML, filtros persistidos e resultados reais.
- [x] Revisão independente de segurança e semântica das métricas; corrigir achados importantes; atualizar README/status.

**Review focus:** manipulação de connection/client/account IDs; contas incompatíveis ou expiradas; status atual aplicado a histórico; resultados ausentes/mistos e sobreposição de atribuições; migração preservando dados e grants.

## Progresso
- Pesquisa: API real `results` validada com `indicator` e `values[{value,attribution_windows:[default]}]`; campanha OUTCOME_ENGAGEMENT retorna conversas iniciadas. SDK oficial Meta confirma campos objective/results.
- Implementação e revisão concluídas. 41 testes, lint, typecheck, build e 3 E2E aprovados. Migração remota `20261020193131_campaign_results` aplicada; 1.406 linhas reprocessadas. Seletor real retornou 14 contas; painel autenticado/mobile validado. Evidências e limites em `docs/development-status.md`.
