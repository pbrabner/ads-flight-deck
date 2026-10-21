import Link from "next/link";
export default function NotFound() { return <main className="error-page"><h1>Página não encontrada</h1><p>Confira o endereço ou volte ao seu painel.</p><Link href="/" className="primary-link">Voltar ao início</Link></main>; }
