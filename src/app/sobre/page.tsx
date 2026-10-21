import type { Metadata } from "next";
import Link from "next/link";
import { PrivacyContact, PublicDocument } from "@/components/public-document";

export const metadata: Metadata = { title: "Sobre o aplicativo", description: "Conheça o Ads Flight Deck: relatórios de Meta Ads e Google Ads, acesso por cliente e gerenciamento de campanhas com confirmação." };
export default function AboutPage() {
  return <PublicDocument title="Suas campanhas, em uma visão clara." introduction="O Ads Flight Deck reúne investimento e resultados de Meta Ads e Google Ads para agências e seus clientes acompanharem a operação de mídia." dated={false} sections={[{ id: "funcionalidades", title: "Como funciona" }, { id: "autorizacao", title: "Conexões e acesso" }, { id: "transparencia", title: "Privacidade e contato" }]}>
    <div className="public-actions"><Link className="primary-link" href="/login">Acessar painel</Link><Link href="/demo">Explorar demonstração</Link></div>
    <section id="funcionalidades"><h2>Como funciona</h2><p>Compare períodos, acompanhe investimento, cliques e conversões e explore os resultados de campanhas, grupos e anúncios. Filtre campanhas por status e consulte indicadores por tipo de resultado.</p><p>Administradores organizam clientes e conexões e podem revisar propostas para pausar, reativar ou ajustar o orçamento diário de campanhas compatíveis. Cada edição exige confirmação e fica registrada no histórico.</p></section>
    <section id="autorizacao"><h2>Conexões e acesso</h2><p>Google Ads e Meta Ads são conectados por autorização OAuth. O aplicativo consulta as contas permitidas pelo usuário, importa seus dados de publicidade e utiliza as permissões concedidas para os recursos de gerenciamento.</p><p>O acesso ao painel é individual: administradores gerenciam a operação e clientes consultam os dados vinculados ao seu cadastro. A demonstração é pública e utiliza dados fictícios.</p></section>
    <section id="transparencia"><h2>Privacidade e contato</h2><p>Conheça os dados utilizados, as finalidades e as opções de revogação e exclusão na <Link href="/privacidade">Política de Privacidade</Link>. As condições de acesso estão nos <Link href="/termos">Termos de Uso</Link>.</p><p>O Ads Flight Deck é operado pela Midnight Puppies Studios. Para suporte ou solicitações sobre seus dados: <PrivacyContact />.</p></section>
  </PublicDocument>;
}
