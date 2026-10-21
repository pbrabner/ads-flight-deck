"use client";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="error-page"><h1>Não foi possível carregar esta página.</h1><p>Tente novamente. Se o problema continuar, fale com o administrador.</p><button onClick={reset} className="primary-link">Tentar novamente</button></main>;
}
