import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/shell";
import { LegalLinks } from "@/components/legal-links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabaseConfig } from "@/lib/env";
import { login, logout } from "./actions";
const errors: Record<string, string> = { setup: "O acesso às contas estará disponível após a configuração do ambiente.", invalid: "Confira seu e-mail e sua senha e tente novamente.", no_profile: "Sua conta precisa ser vinculada a um cliente. Fale com o administrador." };
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const configured = !!supabaseConfig();
  return <main className="login-page"><div className="login-story"><Brand /><div><span className="login-line" /><h1>Sua mídia.<br />Uma visão completa.</h1><p>Conecte os pontos entre investimento, campanhas e resultados.</p></div><span className="login-security"><ShieldCheck size={18} />Acesso individual. Dados protegidos.</span></div><div className="login-area"><section className="login-card"><h2>Bem-vindo ao seu painel</h2><p>Acesse sua conta para acompanhar os resultados.</p>{(!configured || error) && <div className="form-message" role="status">{errors[error ?? "setup"] ?? "Não foi possível concluir o acesso."}</div>}
    <form action={login} className="stack-form"><label>E-mail<Input type="email" name="email" autoComplete="username" placeholder="voce@empresa.com.br" required disabled={!configured} /></label><label>Senha<Input type="password" name="password" autoComplete="current-password" required disabled={!configured} /></label><Button type="submit" disabled={!configured} className="h-11">Entrar</Button></form>
    {error === "no_profile" && <form action={logout}><button className="text-link">Sair e usar outra conta</button></form>}
    <div className="login-demo"><p>Conheça o Ads Flight Deck</p><Link href="/demo">Explorar demonstração<ArrowUpRight size={16} /></Link></div><LegalLinks /></section></div></main>;
}
