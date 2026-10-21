import Link from "next/link";
import { Activity, ArrowUpRight, LayoutDashboard, LogOut, Plane, Settings2 } from "lucide-react";
import { logout } from "@/app/login/actions";
import { LegalLinks } from "./legal-links";

export function Brand() {
  return <span className="brand"><span className="brand-icon"><Plane size={23} aria-hidden /></span><span>Ads Flight Deck<small>Controle de mídia</small></span></span>;
}
export function Shell({ children, name, demo = false, admin = false, slug = "", section = "dashboard" }: {
  children: React.ReactNode; name: string; demo?: boolean; admin?: boolean; slug?: string; section?: string;
}) {
  const home = demo ? "/demo" : slug ? `/c/${slug}` : "/admin";
  return <div className="app-shell">
    <a className="skip-link" href="#main">Pular para o conteúdo</a>
    <aside className="sidebar">
      <Link href={home} className="brand-link"><Brand /></Link>
      <div className="workspace"><span className="workspace-avatar">{name.slice(0, 1)}</span><span><strong>{name}</strong><small>{demo ? "Conta de demonstração" : admin ? "Operação da agência" : "Sua conta de anúncios"}</small></span></div>
      <nav aria-label="Navegação principal">
        <Link href={home} aria-current={section === "dashboard" ? "page" : undefined}><LayoutDashboard size={18} />Visão geral</Link>
        {admin && <Link href="/admin" aria-current={section === "admin" ? "page" : undefined}><Settings2 size={18} />Administração</Link>}
        {demo && <Link href="/login"><Settings2 size={18} />Acessar minha conta<ArrowUpRight size={14} /></Link>}
      </nav>
      <div className="sidebar-note"><Activity size={19} /><strong>Clareza para decidir.</strong><p>Investimento e resultados da sua mídia, no mesmo lugar.</p></div>
      <div className="sidebar-footer"><span className="status-dot" />{demo ? "Ambiente de demonstração" : "Acesso protegido"}</div>
    </aside>
    <div className="workspace-main">
      <header className="topbar"><div><span className="breadcrumb">Workspace</span><span className="breadcrumb-separator">/</span><strong>{name}</strong></div>
        {demo ? <span className="demo-chip">Dados fictícios</span> : <form action={logout}><button className="logout-button"><LogOut size={16} />Sair</button></form>}
      </header>
      <main id="main" className="main-content">{children}</main>
      <footer className="page-footer"><span>Ads Flight Deck</span><LegalLinks /><span>Horário de Brasília · Valores em BRL</span></footer>
    </div>
  </div>;
}
