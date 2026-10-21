# Importação na Hostinger

O repositório contém o aplicativo Next.js completo. As páginas públicas publicadas separadamente em `sites/` não fazem parte deste repositório; as rotas `/sobre`, `/termos` e `/privacidade` também existem no aplicativo.

## Configuração inicial

1. No hPanel, criar um site do tipo aplicativo web Node.js e importar o repositório privado `pbrabner/ads-flight-deck`. Autorizar a integração da Hostinger a acessar esse repositório.
2. Selecionar a branch `main` e a raiz do repositório. Usar o preset Next.js com backend e Node.js 22 ou 24.
3. Conferir a configuração detectada: instalação por `npm ci`, build por `npm run build`, saída `.next`. O comando de execução do projeto é `npm run start`; seguir o gerenciamento de execução oferecido pelo preset da Hostinger. Não usar exportação estática.
4. Cadastrar as variáveis de `.env.example` no painel da hospedagem, com os valores reais inseridos diretamente no gerenciador de ambiente. O repositório não contém `.env` nem credenciais. `SUPABASE_ACCESS_TOKEN` é apenas para administração de migrações e não precisa estar na hospedagem.
5. Definir a URL pública HTTPS em `NEXT_PUBLIC_APP_URL` antes do build. Endereço proposto: `https://app.midnightpuppies.com.br`, preservando o subdomínio das páginas públicas existentes.
6. Cadastrar os callbacks exatos nos aplicativos Meta e Google: `<URL pública>/api/oauth/meta/callback` e `<URL pública>/api/oauth/google/callback`.
7. Validar login, isolamento entre clientes, conexões e dashboard no endereço final antes de liberar o acesso.

## Sincronização

`vercel.json` é específico da Vercel e não configura agendamentos na Hostinger. Preparar um agendador que chame `/api/cron/sync` com o cabeçalho `Authorization: Bearer <CRON_SECRET>`, mantendo o segredo fora da URL e dos logs. Conferir duração permitida das requisições no ambiente e validar uma execução real. Importações longas poderão exigir a fila descrita nas prioridades de produção.

O Supabase continua sendo o banco; não executar scripts de seed ou recriar o banco ao importar o projeto. Migrações novas precisam seguir o processo de implantação próprio.

## Compatibilidade do build com a Hostinger

O projeto usa `next.config.mjs`, para carregar a configuração sem transpilar TypeScript, e `npm run build` executa `next build --webpack`. Essa combinação permite ao Next.js usar o fallback SWC WebAssembly quando o compilador nativo não carrega por incompatibilidade de glibc. Turbopack exige o compilador nativo; a Hostinger orienta usar Webpack nas versões Next.js 16.3.3 ou posteriores nesse ambiente.

No hPanel, manter Node.js **22**, build **`npm run build`** e saída **`.next`**. Um comando sobrescrito como `next build` ignora a correção do script. Fazer novo deploy do commit corrigido. Se houver cache antigo, limpar o cache de build pela hospedagem e reinstalar usando o lockfile versionado. Não é necessário apagar `package-lock.json`, trocar a versão do Next.js ou tentar instalar um pacote musl num sistema glibc.

O fallback WASM pode ser baixado pelo próprio Next.js; o ambiente de build precisa permitir esse download. Arquivos temporários como `<hash>.next.config.ts` são ignorados pelo Git. Eles não estavam no repositório quando a falha foi relatada.

Referência: [compatibilidade Next.js/Turbopack na Hostinger](https://www.hostinger.com/support/how-to-fix-next-js-16-turbopack-build-errors-on-hostinger/).

Validação da correção em 21/10/2026: build Webpack concluído em Windows com o fallback WASM forçado pelo mecanismo de teste do Next.js, sem mudar as dependências. A flag interna de teste não faz parte da configuração de produção. O servidor `next start` desse build serviu login, páginas públicas e demonstração, incluindo filtro de plataforma. Também passaram 77 testes, lint e tipagem. Essa validação exercita o caminho WASM, mas não reproduz o Linux/glibc da Hostinger; o novo deploy no provedor ainda precisa ser confirmado.

## Referências

- [Implantação Node.js na Hostinger](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/)
- [Prioridades para produção](production-priorities.md)
