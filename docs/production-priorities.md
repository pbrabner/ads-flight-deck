# Prioridades para produção — Ads Flight Deck

Atualizado em 21/10/2026. Ordem proposta por impacto na operação, dependências e risco. Este documento organiza o desenvolvimento; não autoriza contratação de infraestrutura, publicação ou alterações reais em campanhas.

## Base atual

- Meta e Google conectados com dados reais; dashboards independentes por plataforma, filtros e detalhamento implementados.
- Administração por cliente, OAuth, seleção de contas, sincronização manual, reconexão e remoção de conexões sem vínculos implementados.
- Supabase remoto e controles de acesso existentes, com testes de isolamento. Falta concluir a validação de acesso de um usuário cliente em condições de produção.
- Editor administrativo de status/orçamento já possui propostas, confirmação e auditoria. As escritas foram testadas com respostas simuladas; não considerar alterações reais homologadas.
- Páginas públicas para OAuth publicadas e marca Google verificada. A publicação do aplicativo completo e a execução agendada ainda estão pendentes segundo os registros atuais.
- Agentes, CRM/qualidade de leads, relatórios recorrentes, criativos e conectores TikTok/LinkedIn ainda precisam de implementação. O catálogo visual dessas plataformas não equivale à integração.

Os documentos anteriores contêm registros históricos: os bloqueios antigos de OAuth Google já foram superados. Esta lista usa as evidências mais recentes, sem tratar a documentação inicial como código concluído.

## Ordem de execução

| Ordem | Prioridade | Entrega | Impacto e critério de conclusão |
| --- | --- | --- | --- |
| 1 | P0 — liberar piloto | Publicar o aplicativo completo | Permitir uso independente do computador de desenvolvimento. Preparar ambiente de produção, segredos, domínio HTTPS, callbacks OAuth e agendamento; preservar as páginas públicas existentes. Validar login admin/cliente, acesso negado a outro cliente, OAuth e dashboard no domínio final. Documentar implantação e retorno à versão anterior. |
| 2 | P0 — confiança | Homologar dados e mostrar sua atualização | Comparar investimento, cliques e resultados com cada provedor usando período, fuso e atribuição compatíveis. Exibir última coleta bem-sucedida e avisos de atraso, falha ou cobertura parcial no dashboard. Um dado ausente não pode parecer zero nem um período incompleto parecer completo. |
| 3 | P0 — continuidade | Operação e recuperação da sincronização | Conferir o primeiro agendamento real, registrar falhas por conta, mostrar reconexão e permitir reprocessamento. Definir responsável e canal para alertas; verificar backups e procedimento de restauração. Critério: uma conta com erro não interrompe as demais e há caminho claro para recuperar dados. |
| 4 | P1 — escala | Fila durável e processamento em segundo plano | Tirar importações longas e futuros agentes da dependência de uma requisição aberta. Dividir tarefas por conta/janela, salvar progresso, limitar concorrência e retomar após reinício. Testar falha intermediária, duplicidade e repetição segura. Definir VPS ou serviço gerenciado a partir de volume e duração medidos. |
| 5 | P1 — valor recorrente | Relatórios para o gestor | Criar resumo semanal/mensal por link e depois exportação PDF, reaproveitando métricas homologadas. Manter plataformas e tipos de resultado separados, informar período e atualização, proteger acesso por cliente. Distribuição por e-mail/WhatsApp vem depois, com destinatários e autorização definidos. |
| 6 | P1 — resultado comercial | Integração CRM e qualidade dos leads | Começar por importação validada de planilhas; integrar IXC quando acesso e campos estiverem confirmados. Relacionar campanhas a leads e vendas por identificadores disponíveis, deduplicar e explicitar cobertura e incerteza. Mostrar leads qualificados, vendas e custo por resultado comercial apenas quando houver evidência suficiente. Não prometer ROAS sem receita atribuível. |
| 7 | P2 — inteligência | Agente de análise e recomendações | Usar fila, dados homologados e sinais comerciais disponíveis. Gerar recomendações por plataforma e objetivo, com evidências, período, confiança e custo de execução controlado. Salvar sugestões para revisão; não alterar anúncios. Avaliar com casos reais e revisão humana antes de ampliar o uso. |
| 8 | P2 — execução assistida | Agentes com aprovação humana | Reutilizar o editor existente, homologar permissões e uma alteração real escolhida pelo administrador. Associar aprovação a ação, conta, valores e validade; revalidar estado antes da escrita, registrar resultado e tratar resposta incerta sem repetir a ação. Reversão deve ser nova proposta validada, sem prometer rollback universal. MCP é opcional e só entra se houver necessidade de acesso por agentes externos. |
| 9 | P3 — expansão | Criativos, TikTok e LinkedIn | Analisar criativos após dispor de dados e avaliação confiáveis. Priorizar cada novo conector conforme demanda real dos clientes e disponibilidade de acesso. Exigir os mesmos critérios de isolamento, OAuth por cliente, atualização, semântica das métricas e testes já definidos para Meta/Google. |

## Marcos de liberação

1. **Piloto com clientes:** itens 1–3 concluídos e volume do piloto dentro dos limites medidos da sincronização atual. Se as tarefas excederem esses limites, antecipar o item 4 antes da liberação.
2. **Operação recorrente:** fila e relatórios concluídos; processo de suporte e recuperação exercitado.
3. **Análise de resultado comercial:** CRM com cobertura conhecida. Recomendações baseadas só em mídia podem ser experimentadas antes disso, desde que não aleguem qualidade de lead, receita ou venda.
4. **Agentes em produção:** análises avaliadas, limites de custo definidos e revisão humana. Escritas reais só após homologação separada da etapa 8.

## Próximo pacote concreto

Executar os itens 1–3 como preparação de um piloto: inventário da hospedagem atual, plano de publicação sem interromper as páginas públicas, configuração do ambiente, validação de acesso de cliente, conciliação de uma amostra Meta/Google, sinalização de atualização e acompanhamento da primeira sincronização agendada.

Não definir prazos ou capacidade de servidor antes de medir volume de contas, duração das importações, frequência necessária e orçamento operacional. O ranking pode mudar se houver cliente já aguardando TikTok/LinkedIn ou necessidade comercial urgente de uma integração específica.
