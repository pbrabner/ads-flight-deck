import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { removeConnection } from "./actions";

export function RemoveConnection({ connection, accounts, clients, clientId }: {
  connection: { id: string; label: string; owner_client_id: string | null };
  accounts: { connection_id: string; client_id: string; external_id: string }[];
  clients: { id: string; name: string }[];
  clientId?: string;
}) {
  const linked = accounts.filter(a => a.connection_id === connection.id);
  return <details className="connection-removal"><summary>Remover conexão</summary>
    <p><strong>{connection.label}</strong>{!connection.owner_client_id && " · Conexão compartilhada da agência"}</p>
    {linked.length ? <>
      <p>Esta conexão atende {linked.length} {linked.length === 1 ? "conta" : "contas"} e ainda não pode ser removida. Para preservar o histórico, conecte uma autorização válida e selecione nela as mesmas contas:</p>
      <ul>{linked.map(a => <li key={`${a.client_id}-${a.external_id}`}><Link href={`/admin?client_id=${a.client_id}`}>{clients.find(c => c.id === a.client_id)?.name || "Cliente"} · Conta {a.external_id}</Link></li>)}</ul>
      <p>Depois de transferir todos os vínculos, volte aqui para remover a conexão antiga. Desativar a sincronização não remove o vínculo.</p>
    </> : <form action={removeConnection}>
      <input type="hidden" name="id" value={connection.id} />
      {clientId && <input type="hidden" name="client_id" value={clientId} />}
      <p>Nenhuma conta vinculada. A conexão e suas credenciais salvas serão excluídas do Ads Flight Deck. Seus anúncios não serão alterados; a autorização no provedor não será revogada.</p>
      <label className="removal-confirmation"><input type="checkbox" name="confirmation" value="remove" required />Confirmo a remoção desta conexão.</label>
      <SubmitButton pendingText="Removendo…">Remover definitivamente</SubmitButton>
    </form>}
  </details>;
}
