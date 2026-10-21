# Ads Flight Deck

Painel de operação de mídia: navegação persistente, análise independente por plataforma, leitura rápida de investimento e resultados, tabelas para investigação.

- Azul-marinho `#14273c`: navegação e identidade.
- Fundo `#f3f6fa`, superfície `#ffffff`, texto `#172b40`.
- Azul `#275cce`: ações e investimento. Verde `#167b67`: leads e resultado favorável.
- Tipografia: Segoe UI para interface, números tabulares; escala fixa em rem, textos auxiliares a partir de 12 px e títulos com peso 650.
- Navegação lateral de 248 px; título e filtros comuns, seguidos por seções independentes Meta Ads e Google Ads. Cada seção tem indicadores, gráficos e sua lista de campanhas. Nunca somar as plataformas na apresentação inicial.
- Indicadores em duas linhas por plataforma: investimento, resultado compatível e custo por resultado primeiro; impressões, cliques, CTR e CPC como apoio. Resultados heterogêneos ficam separados por tipo; conversões Google não são rotuladas como leads. No celular, as três métricas principais viram linhas com valor à direita.
- Listas de campanhas recolhidas quando ambas as plataformas estão visíveis; abertas na visualização focada. Gráficos de cada plataforma permanecem visíveis sem depender de filtros.
- Administração começa pelo cliente, seguida de seções Meta/Google com vínculo, autorização existente, status e recuperação. Cadastro manual e gestão de usuários são secundários. Seleção da conta exige uma confirmação contextual antes da importação.
- Após selecionar um cliente, “Abrir dashboard” é a ação principal da administração: botão azul preenchido no cabeçalho do cliente, com largura total no celular. As ações “Conectar [plataforma]” têm fundo azul-marinho, ícone de conexão e largura total em sua seção, seguidas de orientação sobre login e autorização. A conexão permanece evidente mesmo quando já existem contas vinculadas.
- Texto secundário `#576b82`, bordas `#dce4ee`, espaçamento de 8/16/24/32 px. Ícones discretos; cor reservada à navegação, ações e significado dos dados.
- Controles principais com pelo menos 44 px de altura; tabela com primeira coluna fixa e região de rolagem acessível por teclado.
- Links e botões com foco visível; mobile reorganiza navegação e indicadores, preservando rolagem horizontal apenas na tabela.
- Dados fictícios recebem aviso persistente. Estado vazio oferece orientação clara.

Esboço:

```text
marca | cliente e período                       acesso
nav   | visão geral                     filtro e datas
      | Meta Ads: indicadores e gráficos próprios
      | campanhas Meta (expandir)
      | Google Ads: indicadores e gráficos próprios
      | campanhas Google (expandir)
```
