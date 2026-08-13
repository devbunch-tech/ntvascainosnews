import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { formatDate } from "@ntv/shared";
import { Header, Avatar } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { AvatarUpload } from "~/components/AvatarUpload";
import { gql } from "~/lib/graphql.server";
import { ME_QUERY, UPDATE_PROFILE_MUTATION } from "~/lib/queries";
import { getToken } from "~/lib/session.server";
import { getEnv } from "~/lib/env.server";

const CHANGE_PASSWORD = /* GraphQL */ `
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(currentPassword: $currentPassword, newPassword: $newPassword)
  }
`;

interface MeData {
  me: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    bio?: string | null;
    role: string;
    preferences: { newsletter: boolean; matchAlerts: boolean; shopNews: boolean };
    pollVotes: { pollId: string; playerName: string; choice: string; votedAt: string }[];
  } | null;
}

export const meta: MetaFunction = () => [{ title: "Meu perfil — NTV News" }];

export async function loader({ request }: LoaderFunctionArgs) {
  if (!(await getToken(request))) throw redirect("/entrar?voltar=/perfil");
  const data = await gql<MeData>(ME_QUERY, { request });
  if (!data.me) throw redirect("/entrar?voltar=/perfil");
  return { ...data, apiUrl: getEnv().PUBLIC_GRAPHQL_URL.replace(/\/graphql\/?$/, "") };
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "profile");

  try {
    if (intent === "password") {
      await gql(CHANGE_PASSWORD, {
        request,
        variables: {
          currentPassword: String(form.get("currentPassword") ?? ""),
          newPassword: String(form.get("newPassword") ?? ""),
        },
      });
      return { ok: "Senha alterada." };
    }

    await gql(UPDATE_PROFILE_MUTATION, {
      request,
      variables: {
        input: {
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          ...(form.get("avatarUrl") ? { avatarUrl: String(form.get("avatarUrl")) } : {}),
          preferences: {
            newsletter: form.get("newsletter") === "on",
            matchAlerts: form.get("matchAlerts") === "on",
            shopNews: form.get("shopNews") === "on",
          },
        },
      },
    });
    return { ok: "Alterações salvas." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível salvar." };
  }
}

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="toggle">
      <span className="toggle__label">{label}</span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      <span className="toggle__track" />
    </label>
  );
}

export default function PerfilRoute() {
  const { me, apiUrl } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  if (!me) return null;

  return (
    <div className="shell">
      <Header user={me} />
      <main className="main">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <section className="widget" style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Avatar name={me.name} url={me.avatarUrl} size={96} />
            <div>
              <h1 style={{ margin: 0, fontSize: 22, color: "var(--ntv-ink)" }}>{me.name}</h1>
              <p className="ntv-meta">{me.email}</p>
            </div>
            <Form method="post" action="/sair" style={{ marginLeft: "auto" }}>
              <button className="ntv-btn ntv-btn--outline">Sair</button>
            </Form>
          </section>

          {actionData?.ok ? <p className="alert alert--ok">{actionData.ok}</p> : null}
          {actionData?.error ? <p className="alert">{actionData.error}</p> : null}

          <Form method="post" className="widget" style={{ marginTop: 16 }}>
            <h2 className="widget__title">Dados da conta</h2>
            <AvatarUpload apiUrl={apiUrl} initial={me.avatarUrl} size={72} />

            <div className="field">
              <label htmlFor="name">Nome</label>
              <input id="name" className="ntv-input" name="name" defaultValue={me.name} />
            </div>
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                className="ntv-input"
                type="email"
                name="email"
                defaultValue={me.email}
              />
            </div>

            <h2 className="widget__title" style={{ marginTop: 24 }}>
              Preferências
            </h2>
            <Toggle name="newsletter" label="Newsletter semanal" defaultChecked={me.preferences.newsletter} />
            <Toggle name="matchAlerts" label="Alertas de jogo" defaultChecked={me.preferences.matchAlerts} />
            <Toggle name="shopNews" label="Novidades da Loja NTV" defaultChecked={me.preferences.shopNews} />

            <button
              className="ntv-btn"
              style={{ width: "100%", marginTop: 20 }}
              disabled={navigation.state !== "idle"}
            >
              Salvar alterações
            </button>
          </Form>

          <Form method="post" className="widget" style={{ marginTop: 16 }}>
            <input type="hidden" name="intent" value="password" />
            <h2 className="widget__title">Alterar senha</h2>
            <div className="field">
              <label htmlFor="currentPassword">Senha atual</label>
              <input
                id="currentPassword"
                className="ntv-input"
                type="password"
                name="currentPassword"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="newPassword">Nova senha</label>
              <input
                id="newPassword"
                className="ntv-input"
                type="password"
                name="newPassword"
                minLength={6}
                required
              />
            </div>
            <button className="ntv-btn ntv-btn--outline">Alterar senha</button>
          </Form>

          <section className="widget" style={{ marginTop: 16 }}>
            <h2 className="widget__title">Minhas enquetes</h2>
            {me.pollVotes.length ? (
              me.pollVotes.map((vote) => (
                <div key={vote.pollId} className="matchrow">
                  <span style={{ fontWeight: 700 }}>{vote.playerName}</span>
                  <span
                    className={`ntv-badge ${vote.choice === "good" ? "ntv-badge--success" : "ntv-badge--mute"}`}
                    style={{ marginLeft: "auto" }}
                  >
                    {vote.choice === "good" ? "Bom reforço" : "Péssimo negócio"}
                  </span>
                  <span className="ntv-meta">{formatDate(vote.votedAt)}</span>
                </div>
              ))
            ) : (
              <p className="ntv-meta">Você ainda não votou em nenhuma enquete.</p>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
