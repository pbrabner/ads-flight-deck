# Análise e conexões por plataforma

Direção confirmada em 21/10/2026: mostrar Meta e Google em duas seções independentes na entrada do dashboard; começar a conexão pelo cliente.

- Público: gestores que precisam entender investimento e resultados sem conhecer detalhes das APIs. Preservar a identidade visual existente.
- Nunca apresentar KPIs, taxas, custo por resultado ou gráficos agregados entre plataformas. Cada seção recebe sua própria série atual, anterior e campanhas. A visualização de ambas significa duas seções, não um consolidado.
- Período e status continuam compartilhados como critérios de consulta; comparações são internas à plataforma. Resultados diferentes continuam separados. Conversões Google não são rotuladas como leads. Custos sem cobertura completa permanecem indisponíveis.
- Ambas as seções têm gráficos próprios. Listas de campanhas ficam recolhidas na entrada para não esconder a segunda plataforma; podem ser abertas sem perder filtros. Visão focada em uma plataforma mantém a lista aberta.
- Administração: escolher cliente → escolher plataforma/usar autorização existente → selecionar conta → vincular e importar. Contas, ações e falhas são contextualizadas pelo cliente e pela plataforma. Cadastros de clientes, usuários e opções manuais permanecem disponíveis em áreas secundárias.
- Reutilizar RPCs com filtro de plataforma e fluxos OAuth existentes. Nenhuma nova migração, alteração de anúncios ou concessão real de OAuth é necessária para implementar a interface.
- Validar separação dos dados, comparação anterior, estados vazios, navegação, opções de conexão por cliente, desktop e celular.

## Expansão para TikTok, LinkedIn e outras plataformas

A mesma regra vale para todas as integrações futuras: uma seção por plataforma, com indicadores, séries atuais e anteriores, resultados e campanhas próprios. O filtro “Todas, separadas” nunca representa um relatório consolidado. O fluxo de conexão sempre começa pelo cliente e termina com a confirmação da conta e da importação.

O catálogo em `src/lib/platform.ts` concentra nomes, orientações de análise, contexto dos resultados e rotas das integrações disponíveis. Dashboard, tabela, filtros e conexão por cliente usam esse catálogo; `loadPlatformReports` consulta cada plataforma individualmente. TikTok e LinkedIn estão cadastrados como indisponíveis e não aparecem como opções de conexão ou consulta.

Antes de habilitar uma nova plataforma:

1. Implementar OAuth, descoberta e confirmação de contas, respeitando a propriedade do cliente e as permissões do provedor.
2. Ampliar os tipos, validações, armazenamento e funções de relatório para filtrar explicitamente a plataforma; implementar sincronização e dados de demonstração.
3. Normalizar objetivos, tipos de resultado, atribuição e unidades sem converter indiscriminadamente resultados em leads. Preservar métricas indisponíveis e separar resultados incompatíveis.
4. Revisar os textos do catálogo segundo o conector implementado, fornecer suas rotas e ativar a disponibilidade.
5. Validar que os novos dados não alteram indicadores ou gráficos das demais plataformas, incluindo comparação anterior, filtros, detalhamento e isolamento entre clientes. Cobrir também o fluxo cliente → plataforma → conta → confirmação e os layouts com mais de duas seções.

O cadastro de apresentação não implementa as APIs de TikTok ou LinkedIn. Essas integrações continuam pendentes.
