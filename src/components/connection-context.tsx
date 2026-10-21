import Link from "next/link";

export function ConnectionContext({ client, platform }: { client: { id: string; name: string } | undefined; platform: string }) {
  return <div className="selection-context"><ol className="connection-steps" aria-label="Progresso da conexão"><li aria-current={!client ? "step" : undefined}>{client ? `Cliente: ${client.name}` : "Escolher cliente"}</li><li>Conexão {platform}</li><li aria-current={client ? "step" : undefined}>Escolher conta</li><li>Confirmar importação</li></ol>
    {client && <p>Você está vinculando uma conta a <strong>{client.name}</strong>. <Link className="text-link" href={`/admin?client_id=${client.id}`}>Voltar às contas do cliente</Link></p>}
  </div>;
}
