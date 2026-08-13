import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import type { ActionFunctionArgs, MetaFunction } from "react-router";
import { Header } from "~/components/Header";
import { AvatarUpload } from "~/components/AvatarUpload";
import { PasswordField } from "~/components/PasswordField";
import { gql } from "~/lib/graphql.server";
import { SIGNUP_MUTATION, UPDATE_PROFILE_MUTATION } from "~/lib/queries";
import { commitWithToken } from "~/lib/session.server";
import { getEnv } from "~/lib/env.server";

export const meta: MetaFunction = () => [{ title: "Criar conta — NTV News" }];

export function loader() {
  return { apiUrl: getEnv().PUBLIC_GRAPHQL_URL.replace(/\/graphql\/?$/, "") };
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const avatarUrl = String(form.get("avatarUrl") ?? "");
  const newsletter = form.get("newsletter") === "on";

  if (!name || !email || password.length < 6) {
    return { error: "Preencha nome, e-mail e uma senha de ao menos 6 caracteres." };
  }

  try {
    const { signup } = await gql<{ signup: { token: string } }>(SIGNUP_MUTATION, {
      variables: { name, email, password, newsletter },
    });
    if (avatarUrl) {
      await gql(UPDATE_PROFILE_MUTATION, {
        variables: { input: { avatarUrl } },
        token: signup.token,
      });
    }
    return commitWithToken(request, signup.token, "/perfil");
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível criar a conta." };
  }
}

export default function InscricaoRoute() {
  const { apiUrl } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <div className="shell">
      <Header user={null} />
      <div className="authpage">
        <aside className="authpage__aside">
          <h2 style={{ color: "#fff", fontSize: 30, lineHeight: 1.15, margin: "0 0 12px" }}>
            Tudo sobre o Vasco, no seu ritmo.
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.6, margin: 0 }}>
            Crie sua conta para votar nas enquetes do Mercado da Bola, salvar preferências e receber
            a newsletter do NTV News.
          </p>
        </aside>

        <main className="authpage__form">
          <h1 className="post__title" style={{ fontSize: 26 }}>
            Criar conta
          </h1>

          {actionData?.error ? <p className="alert">{actionData.error}</p> : null}

          <Form method="post">
            <AvatarUpload apiUrl={apiUrl} />

            <div className="field">
              <label htmlFor="name">Nome</label>
              <input id="name" className="ntv-input" name="name" required autoComplete="name" />
            </div>

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

            <PasswordField name="password" label="Senha" autoComplete="new-password" />

            <label className="checkline">
              <input type="checkbox" name="newsletter" defaultChecked />
              <span>Quero receber a newsletter com os destaques da semana.</span>
            </label>

            <button
              className="ntv-btn"
              style={{ width: "100%" }}
              disabled={navigation.state !== "idle"}
            >
              {navigation.state === "idle" ? "Criar conta" : "Criando…"}
            </button>
          </Form>

          <p className="field__hint" style={{ marginTop: 16, textAlign: "center" }}>
            Já tem conta? <Link to="/entrar">Entrar</Link>
          </p>
        </main>
      </div>
    </div>
  );
}
