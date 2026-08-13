import { Form, Link, useActionData, useNavigation, useSearchParams } from "react-router";
import type { ActionFunctionArgs, MetaFunction } from "react-router";
import { Header } from "~/components/Header";
import { PasswordField } from "~/components/PasswordField";
import { gql } from "~/lib/graphql.server";
import { LOGIN_MUTATION } from "~/lib/queries";
import { commitWithToken } from "~/lib/session.server";

export const meta: MetaFunction = () => [{ title: "Entrar — NTV News" }];

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const redirectTo = String(form.get("redirectTo") || "/perfil");

  try {
    const { login } = await gql<{ login: { token: string } }>(LOGIN_MUTATION, {
      variables: { email, password },
    });
    return commitWithToken(request, login.token, redirectTo);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível entrar." };
  }
}

export default function EntrarRoute() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [params] = useSearchParams();

  return (
    <div className="shell">
      <Header user={null} />
      <div className="authpage">
        <aside className="authpage__aside">
          <h2 style={{ color: "#fff", fontSize: 30, lineHeight: 1.15, margin: "0 0 12px" }}>
            Bem-vindo de volta.
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.6, margin: 0 }}>
            Entre para votar nas enquetes e gerenciar suas preferências.
          </p>
        </aside>

        <main className="authpage__form">
          <h1 className="post__title" style={{ fontSize: 26 }}>
            Entrar
          </h1>

          {params.get("motivo") === "enquete" ? (
            <p className="alert">Entre na sua conta para votar na enquete.</p>
          ) : null}
          {actionData?.error ? <p className="alert">{actionData.error}</p> : null}

          <Form method="post">
            <input type="hidden" name="redirectTo" value={params.get("voltar") ?? "/perfil"} />

            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                className="ntv-input"
                type="email"
                name="email"
                required
                autoComplete="email"
              />
            </div>

            <PasswordField name="password" label="Senha" />

            <button
              className="ntv-btn"
              style={{ width: "100%" }}
              disabled={navigation.state !== "idle"}
            >
              {navigation.state === "idle" ? "Entrar" : "Entrando…"}
            </button>
          </Form>

          <p className="field__hint" style={{ marginTop: 16, textAlign: "center" }}>
            Ainda não tem conta? <Link to="/inscricao">Inscreva-se</Link>
          </p>
        </main>
      </div>
    </div>
  );
}
