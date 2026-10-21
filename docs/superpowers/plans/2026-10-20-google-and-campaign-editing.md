# Google OAuth e edição de campanhas

> Executar com superpowers:subagent-driven-development para conectores independentes e integração pelo controlador. Pedido atual autoriza implementação; não executar alterações em anúncios reais para testar. Pasta sem Git: trabalhar diretamente, sem commits artificiais.

**Objetivo:** completar seleção de contas Google após OAuth e entregar edição administrativa de status e orçamento diário Meta/Google com prévia, confirmação na aplicação e histórico. MCP será uma etapa posterior, reutilizando os serviços desta entrega.

**Arquitetura:** Next.js server actions autenticadas; adaptadores de API com contratos testáveis; Supabase guarda propostas imutáveis com prazo de 10 minutos, ator e execução de uso único. Tokens ficam no servidor. Nenhuma mutação automática de campanhas durante desenvolvimento.

**Decisões do implementador:** primeira versão edita apenas campanhas existentes: pausar/reativar e orçamento diário em BRL. Orçamentos compartilhados, vitalícios ou definidos no conjunto são explicados e bloqueados nesta tela. Uma operação por proposta; reconsultar antes da execução e rejeitar se o estado mudou. Resultado remoto incerto fica sinalizado sem repetição automática. Exibir histórico administrativo. Meta recebe um fluxo separado para solicitar ads_management; leitura existente continua disponível. Google segue seu escopo adwords e permissões reais.

## Tarefas
- [x] Google: remover dependência obrigatória de developer token conforme documentação de 09/09/2026; selecionar contas diretas e via MCC, preservar login_customer_id por conta, revalidar no POST e impedir transferência entre clientes. Testes de descoberta, limites, erros e fronteiras de autorização.
- [x] Adaptadores de edição: ler snapshot e validar alvo, normalizar valores monetários, status Meta/Google; Google validateOnly, bloqueio de budgets compartilhados; Meta permissões ads_management e budget de campanha. Escrita sem retries automáticos. Testes de contratos e falhas sanitizadas.
- [x] Banco: login_customer_id em ad_accounts e campaign_changes com RLS/grants, claims atômicos, histórico e trava de uma execução por entidade. Testes SQL local com concorrência/replay, expiração e isolamento.
- [x] Aplicação: página administrativa de editar campanha, proposta atual→novo, confirmação explícita, checagem de estado atual, registro de sucesso/falha/resultado incerto e leitura após aplicação. Link a partir do detalhamento de campanha para administradores.
- [x] OAuth Meta de gerenciamento opcional; guardar modo no estado validado; leitura padrão permanece ads_read. Reconectar e selecionar conta atualiza a conexão usada.
- [x] Integração: lint, types, testes, build, navegador, revisão independente; migration remota aditiva; validar leitura real Meta sem alteração externa. Google real condicionado às credenciais/consentimento disponíveis. Atualizar README e evidências.

## Review focus
- Troca de IDs/cliente/connection/MCC; credenciais nunca no HTML ou logs.
- Confirmação repetida, expiração, alterações concorrentes e resposta remota ambígua.
- Centavos Meta versus micros Google; orçamento compartilhado ou vitalício.
- Revogação de autorização entre proposta e execução; apenas administradores.
- Falha em gravar histórico após a API aplicar: nunca anunciar falha segura nem repetir automaticamente.

## Progresso
- Escopo e contrato definidos; documentação atual Google consultada. Não haverá implantação de MCP remoto nesta etapa.

- Final: 71 testes, types, lint, build e 3 E2E aprovados. Migration remota 20261020201258 aplicada. Leitura real Meta validada. Google: credenciais presentes e redirecionamento validado; consentimento e dados reais pendentes. Escritas em campanhas apenas simuladas. Revis?o independente conclu?da com achados corrigidos.
