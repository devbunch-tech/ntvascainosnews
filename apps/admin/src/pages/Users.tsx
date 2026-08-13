import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { formatDateTime, PERMISSIONS, type Role } from "@ntv/shared";
import { DELETE_USER, INVITE_USER, UPDATE_ROLE, USERS } from "../lib/queries";
import { Field } from "../components/ui";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string | null;
  lastLoginAt?: string | null;
  invitePending: boolean;
  createdAt: string;
}

const PERMISSION_LABELS: Record<string, string> = {
  "posts:write": "Criar e editar notícias",
  "posts:delete-any": "Excluir notícias de qualquer autor",
  "featured:manage": "Gerenciar destaques da home",
  "users:manage": "Gerenciar usuários",
  "products:manage": "Gerenciar produtos",
  "settings:manage": "Alterar configurações",
  "rss:manage": "Gerenciar fontes RSS",
  "social:manage": "Conectar redes sociais",
};

export function Users({ me }: { me: { id: string } }) {
  const [search, setSearch] = useState("");
  const { data, refetch } = useQuery<{ users: UserRow[] }>(USERS, { variables: { search } });
  const [inviteUser] = useMutation(INVITE_USER);
  const [updateRole] = useMutation(UPDATE_ROLE);
  const [deleteUser] = useMutation(DELETE_USER);
  const [message, setMessage] = useState<string | null>(null);

  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await inviteUser({
        variables: {
          name: form.get("name"),
          email: form.get("email"),
          role: form.get("role"),
        },
      });
      setMessage("Convite criado. O acesso é liberado no primeiro login.");
      event.currentTarget.reset();
      await refetch();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Não foi possível convidar.");
    }
  }

  return (
    <>
      <div className="page__head">
        <h1 className="page__title">Usuários</h1>
        <input
          className="ntv-input"
          style={{ maxWidth: 240, marginLeft: "auto" }}
          placeholder="Buscar por nome ou e-mail"
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {message ? <p className="alert alert--ok">{message}</p> : null}

      <div className="editor">
        <div className="card" style={{ padding: 0 }}>
          <div className="tablewrap">
            <table className="list">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Papel</th>
                  <th>Último acesso</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {data?.users.map((user) => (
                  <tr key={user.id} style={{ opacity: user.invitePending ? 0.55 : 1 }}>
                    <td>
                      <span className="rowtitle">{user.name}</span>
                      <span className="ntv-meta">{user.email}</span>
                      {user.invitePending ? (
                        <span className="ntv-badge ntv-badge--warning" style={{ marginLeft: 6 }}>
                          Convite pendente
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <select
                        className="ntv-select"
                        value={user.role}
                        disabled={user.id === me.id}
                        onChange={async (e) => {
                          await updateRole({ variables: { id: user.id, role: e.target.value } });
                          await refetch();
                        }}
                      >
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="reader">Leitor</option>
                      </select>
                    </td>
                    <td className="ntv-meta">
                      {user.invitePending ? "—" : formatDateTime(user.lastLoginAt) || "nunca"}
                    </td>
                    <td>
                      <div className="rowactions">
                        {user.invitePending ? (
                          <button className="linkbtn" onClick={() => setMessage("Convite reenviado.")}>
                            Reenviar
                          </button>
                        ) : null}
                        {user.id !== me.id ? (
                          <button
                            className="linkbtn"
                            onClick={async () => {
                              if (!confirm(`Excluir ${user.name}?`)) return;
                              await deleteUser({ variables: { id: user.id } });
                              await refetch();
                            }}
                          >
                            Excluir
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside>
          <form className="card" onSubmit={invite}>
            <h2 className="card__title">Convidar usuário</h2>
            <Field label="Nome">
              <input className="ntv-input" name="name" required />
            </Field>
            <Field label="E-mail">
              <input className="ntv-input" name="email" type="email" required />
            </Field>
            <Field label="Papel">
              <select className="ntv-select" name="role" defaultValue="editor">
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <button className="ntv-btn" style={{ width: "100%" }}>
              Enviar convite
            </button>
          </form>

          <section className="card">
            <h2 className="card__title">Permissões por papel</h2>
            {(["admin", "editor"] as Role[]).map((role) => (
              <div key={role} style={{ marginBottom: 16 }}>
                <span className="ntv-badge">{role}</span>
                <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12.5, lineHeight: 1.7 }}>
                  {PERMISSIONS[role].map((permission) => (
                    <li key={permission}>{PERMISSION_LABELS[permission] ?? permission}</li>
                  ))}
                </ul>
                {role === "editor" ? (
                  <p className="hint">Não acessa usuários nem configurações, e não exclui posts de terceiros.</p>
                ) : null}
              </div>
            ))}
          </section>
        </aside>
      </div>
    </>
  );
}
