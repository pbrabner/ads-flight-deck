# Publicação das páginas públicas

Publicado em 20/10/2026 com Sites, acesso público sem login:

https://ads-flight-deck-midnight-puppies.dragon-dreamer.chatgpt.site

Rotas: `/sobre`, `/termos`, `/privacidade`; a raiz também apresenta o aplicativo. Foram publicados somente HTML, CSS e fontes das páginas públicas. Não foram enviados `.env`, credenciais, banco, arquivos de acesso administrativo ou rotas do painel. Links de acesso ao painel nessa versão estática levam ao contato de suporte enquanto o aplicativo completo não tem hospedagem pública.

Fonte isolada em `sites/ads-flight-deck-public`. Identidade persistida em `.openai/hosting.json` dentro dessa pasta. Não criar outro Site para futuras atualizações.

- Projeto: `appgprj_6ad7ddb3cac08191a621dda41b431ea5`
- Versão: `appgprj_6ad7ddb3cac08191a621dda41b431ea5~appgver_81693bc04c108191a249107d9a1d627e`
- Commit publicado: `33f9c809a2b13a094920084e839319aa1f53ea3f`
- Deployment: `appgdep_6ad7df08b1d4819191c5898bb7ea472c`, resultado `succeeded`.

## Domínio próprio pendente de DNS

O usuário informou que `midnightpuppies.com.br` está registrado na Hostinger. Os nameservers consultados foram `aster.dns-parking.com` e `helios.dns-parking.com`. Foi preparado o subdomínio `ads.midnightpuppies.com.br`, sem alterar o site principal ou o e-mail.

Adicionar na zona `midnightpuppies.com.br`:

| Tipo | Nome relativo | Valor |
| --- | --- | --- |
| CNAME | `ads` | `custom-domains.chatgpt.site` |
| TXT | `_openai-site-verification.ads` | `openai-site-verification=CEi00MGnld-Yvh1UHerUM76x-_wZx4WHwed7lV0wq7o` |
| TXT | `_cf-custom-hostname.ads` | `bd5dd6d4-ee22-4238-aa64-7e0dfdb4a1d9` |

Manter TTL padrão. O domínio foi registrado na hospedagem com ID `appgdom_6ad7df2181d48191a9de7661e77b0a98`, estado `pending`, SSL `initializing`. Nenhuma alteração DNS foi feita na Hostinger. Após cadastrar os registros, atualizar o status do domínio pelo Sites e conferir ativação/HTTPS antes de usar os endereços definitivos no Google:

- Página inicial: `https://ads.midnightpuppies.com.br/sobre`
- Termos: `https://ads.midnightpuppies.com.br/termos`
- Privacidade: `https://ads.midnightpuppies.com.br/privacidade`

O Google pode solicitar verificação de propriedade no Search Console, distinta destes registros da hospedagem. A aprovação Explorer da API permanece separada. O domínio próprio hospeda inicialmente os documentos; não alterar callbacks OAuth para esse domínio até publicar o backend do aplicativo nele.

## Atualizações

Editar os documentos no projeto Next.js, executar `node export.mjs` a partir da pasta do Site com o app local ativo, depois `node verify.mjs`. Usar a skill Sites para credencial temporária, sincronização e publicação. Os testes do pacote verificam as quatro rotas e assets, sem dependências localhost, em desktop/mobile.

No Windows, o empacotador requer Git Bash primeiro no PATH e `TAR_OPTIONS=--force-local` para caminhos D:. Se o Git tiver sido criado por outro usuário do sandbox, a confiança pode ser configurada apenas para o processo e para a pasta exata. Não salvar tokens em arquivos nem alterar a confiança global.
