# Páginas públicas e configuração OAuth

Rotas criadas em 20/10/2026, sem login ou acesso ao banco: `/sobre`, `/privacidade` e `/termos`.

## Direção visual

Modo leitura. Preservar a identidade existente em `docs/DESIGN.md`: cabeçalho azul-marinho, fundo branco, texto escuro e links azuis. O conteúdo jurídico ocupa uma coluna de leitura com índice lateral; no celular, o índice precede o texto. A apresentação explica o serviço e permite acessar o painel ou a demonstração. Nenhuma mudança no roteamento autenticado da raiz.

## Conteúdo e identificação

Textos elaborados a partir dos recursos implementados, do schema e das regras públicas Google. Responsável confirmado pelo usuário: **Midnight Puppies Studios**. Contato mantido: `contato@midnightpuppies.com.br`, já indicado no projeto. Não foi inventado CNPJ ou endereço. Revisar a rotina de exclusão/retenção e os acordos com operadores antes da publicação. Não há prazo automático de exclusão implementado.

Referências consultadas:
- https://developers.google.com/terms/api-services-user-data-policy
- https://support.google.com/cloud/answer/13464321
- https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm

## Publicação no Google

As URLs locais servem para revisão. Publicar no domínio HTTPS controlado pelo responsável, acessível sem autenticação, usando o mesmo domínio para apresentação e privacidade. Cadastrar em Google Auth Platform → Branding:

| Campo | Caminho no domínio público |
| --- | --- |
| Página inicial do aplicativo | `/sobre` |
| Política de Privacidade | `/privacidade` |
| Termos de Serviço | `/termos` |

Verificar a propriedade do domínio quando solicitada pelo Google. Alinhar nome do aplicativo na tela de consentimento ao nome Ads Flight Deck (a tela anterior exibia human_loop). A publicação destas páginas e a verificação de marca não substituem a liberação Explorer da Google Ads API. Publicação posterior concluída com Sites; domínio próprio aguardando DNS. Consulte [public-hosting.md](public-hosting.md).

## Validação

- Typecheck, lint e build concluídos sem erros. As três rotas foram geradas estaticamente.
- Navegador sem sessão: HTTP 200 nas três rotas, em larguras 1440 e 390 px; títulos corretos, sem overflow horizontal ou erros JavaScript.
- Links de apresentação, termos e privacidade encontrados na tela de login.
- Capturas desktop/mobile inspecionadas para legibilidade e navegação. Arquivos `.local/public-*-1440.png` e `.local/public-*-390.png`.
- Revisão limitada ao funcionamento implementado e às fontes citadas; responsável atualizado para Midnight Puppies Studios conforme confirmação do usuário. A versão estática foi posteriormente publicada a pedido do usuário; detalhes em `public-hosting.md`.
