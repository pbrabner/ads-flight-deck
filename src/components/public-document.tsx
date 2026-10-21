import Link from "next/link";
import { Plane } from "lucide-react";
import { LegalLinks } from "./legal-links";

export const privacyEmail = "contato@midnightpuppies.com.br";
export function PrivacyContact() { return <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a>; }

export function PublicDocument({ title, introduction, sections, children, dated = true }: {
  title: string; introduction: string; sections: { id: string; title: string }[]; children: React.ReactNode; dated?: boolean;
}) {
  return <div className="public-document">
    <a className="skip-link" href="#document">Pular para o conteúdo</a>
    <header className="public-header"><Link href="/sobre" className="public-brand"><Plane size={24} aria-hidden />Ads Flight Deck</Link><Link href="/login" className="public-login">Acessar painel</Link></header>
    <div className="document-layout">
      <aside className="document-navigation"><nav aria-label="Nesta página"><p>Nesta página</p>{sections.map(section => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}</nav><LegalLinks /></aside>
      <main id="document" className="document-body"><header><h1>{title}</h1><p className="document-intro">{introduction}</p>{dated && <p className="document-date">Última atualização: <time dateTime="2026-10-20">20 de outubro de 2026</time></p>}</header>{children}</main>
    </div>
    <footer className="public-footer"><span>Ads Flight Deck · Controle de mídia</span><LegalLinks /></footer>
  </div>;
}
