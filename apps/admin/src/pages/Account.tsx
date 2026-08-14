import { useState } from "react";
import { useMutation } from "@apollo/client";
import type { Role } from "@ntv/shared";
import { CHANGE_PASSWORD } from "../lib/queries";
import { Field } from "../components/ui";

/** Espelha o mínimo que a API cobra em `changePassword`. */
const MIN_LENGTH = 6;

interface Me {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/**
 * Conta da pessoa logada.
 *
 * Fica **fora de Configurações** de propósito: aquela página exige
 * `settings:manage`, então um editor ou autor não conseguiria trocar a própria
 * senha por lá. Aqui não há checagem de papel — mexer na própria senha é
 * direito de quem está logado, e a API só age sobre `ctx.user`.
 */
export function Account({ me }: { me: Me }) {
  const [changePassword, { loading }] = useMutation(CHANGE_PASSWORD);
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    // A confirmação é só do cliente: a API não a recebe, porque o que ela
    // precisa validar é a senha atual, não se a pessoa digitou duas vezes igual.
    if (form.next !== form.confirm) return setError("A confirmação não bate com a nova senha.");
    if (form.next.length < MIN_LENGTH) {
      return setError(`A nova senha precisa ter ao menos ${MIN_LENGTH} caracteres.`);
    }
    if (form.next === form.current) return setError("A nova senha é igual à atual.");

    try {
      await changePassword({
        variables: { currentPassword: form.current, newPassword: form.next },
      });
      setForm({ current: "", next: "", confirm: "" });
      // A troca vale já; o que não muda é a sessão atual, porque o JWT em mãos
      // continua válido até expirar. Dizer isso evita a leitura de que a senha
      // só passa a valer depois.
      setMessage("Senha alterada. Você segue conectado — use a nova no próximo login.");
    } catch (e) {
      // A API devolve mensagem pronta e em português ("Senha atual incorreta.").
      setError(e instanceof Error ? e.message : "Não foi possível alterar a senha.");
    }
  }

  return (
    <>
      <div className="page__head">
        <h1 className="page__title">Minha conta</h1>
      </div>

      <section className="card" style={{ maxWidth: 620 }}>
        <Field label="Nome">
          <input className="ntv-input" value={me.name} disabled />
        </Field>
        <Field label="E-mail" hint={`Perfil: ${me.role}. Só quem gere usuários altera estes dados.`}>
          <input className="ntv-input" value={me.email} disabled />
        </Field>
      </section>

      <form className="card" style={{ maxWidth: 620, marginTop: 16 }} onSubmit={submit}>
        <h2 className="widget__title">Alterar senha</h2>

        {message ? <p className="alert alert--ok">{message}</p> : null}
        {error ? <p className="alert">{error}</p> : null}

        <Field label="Senha atual">
          <input
            className="ntv-input"
            type="password"
            autoComplete="current-password"
            value={form.current}
            onChange={(e) => set("current", e.target.value)}
            required
          />
        </Field>
        <Field label="Nova senha" hint={`Ao menos ${MIN_LENGTH} caracteres.`}>
          <input
            className="ntv-input"
            type="password"
            autoComplete="new-password"
            minLength={MIN_LENGTH}
            value={form.next}
            onChange={(e) => set("next", e.target.value)}
            required
          />
        </Field>
        <Field label="Confirmar nova senha">
          <input
            className="ntv-input"
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => set("confirm", e.target.value)}
            required
          />
        </Field>

        <button className="ntv-btn" disabled={loading}>
          {loading ? "Alterando…" : "Alterar senha"}
        </button>
      </form>
    </>
  );
}
