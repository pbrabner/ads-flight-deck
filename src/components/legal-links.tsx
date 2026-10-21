import Link from "next/link";

export function LegalLinks() {
  return <nav className="legal-links" aria-label="Informações do aplicativo">
    <Link href="/sobre">Sobre o aplicativo</Link>
    <Link href="/termos">Termos de Uso</Link>
    <Link href="/privacidade">Política de Privacidade</Link>
  </nav>;
}
