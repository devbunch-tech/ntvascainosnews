import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { formatDateTime } from "@ntv/shared";
import {
  CONNECT_SOCIAL,
  CREATE_RSS,
  DELETE_RSS,
  DISCONNECT_SOCIAL,
  RUN_RSS,
  SAVE_SETTINGS,
  SAVE_SIDEBAR,
  SAVE_SOCIAL_LINKS,
  SAVE_YOUTUBE_CHANNEL,
  SYNC_YOUTUBE,
  SETTINGS,
  TOGGLE_RSS,
} from "../lib/queries";
import { Field, ImageDrop, Toggle } from "../components/ui";
import { SidebarConfig } from "../components/SidebarConfig";

const TABS = ["Geral", "Sidebar", "Fontes RSS", "Redes sociais", "SEO"] as const;

const NETWORK_FIELDS = [
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/…" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@…" },
  { key: "x", label: "X / Twitter", placeholder: "https://x.com/…" },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/…" },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@…" },
];

export function Settings() {
  const { data, refetch } = useQuery(SETTINGS);
  const [saveSettings, { loading: saving }] = useMutation(SAVE_SETTINGS);
  const [toggleRss] = useMutation(TOGGLE_RSS);
  const [createRss] = useMutation(CREATE_RSS);
  const [deleteRss] = useMutation(DELETE_RSS);
  const [runRss, { loading: ingesting }] = useMutation(RUN_RSS);
  const [connectSocial] = useMutation(CONNECT_SOCIAL);
  const [disconnectSocial] = useMutation(DISCONNECT_SOCIAL);
  const [saveSocialLinks, { loading: savingLinks }] = useMutation(SAVE_SOCIAL_LINKS);
  const [saveYoutubeChannel] = useMutation(SAVE_YOUTUBE_CHANNEL);
  const [syncYoutube, { loading: syncingYoutube }] = useMutation(SYNC_YOUTUBE);

  const [tab, setTab] = useState<(typeof TABS)[number]>("Geral");
  const [message, setMessage] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [channelUrl, setChannelUrl] = useState("");
  const [form, setForm] = useState({
    siteName: "",
    url: "",
    logoUrl: "",
    faviconUrl: "",
    maintenance: false,
    seoTitle: "",
    seoDescription: "",
    seoOgImage: "",
    seoKeywords: "",
    googleVerification: "",
  });

  useEffect(() => {
    const s = data?.settings;
    if (!s) return;
    setLinks({
      instagram: s.socialAccounts?.instagram?.url ?? "",
      youtube: s.socialAccounts?.youtube?.url ?? "",
      x: s.socialAccounts?.x?.url ?? "",
      facebook: s.socialAccounts?.facebook?.url ?? "",
      tiktok: s.socialAccounts?.tiktok?.url ?? "",
    });
    setChannelUrl(s.youtube?.channelUrl ?? "");
    setForm({
      siteName: s.siteName,
      url: s.url,
      logoUrl: s.logoUrl ?? "",
      faviconUrl: s.faviconUrl ?? "",
      maintenance: s.maintenance,
      seoTitle: s.seo.title,
      seoDescription: s.seo.description,
      seoOgImage: s.seo.ogImage ?? "",
      seoKeywords: (s.seo.keywords ?? []).join(", "),
      googleVerification: s.seo.googleVerification ?? "",
    });
  }, [data]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function save() {
    const { seoKeywords, ...rest } = form;
    await saveSettings({
      variables: {
        input: {
          ...rest,
          seoKeywords: seoKeywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
        },
      },
    });
    setMessage("Configurações salvas.");
    await refetch();
  }

  const social = data?.settings?.socialAccounts;

  return (
    <>
      <div className="page__head">
        <h1 className="page__title">Configurações</h1>
        <div className="page__actions">
          <button className="ntv-btn" onClick={save} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>

      {message ? <p className="alert alert--ok">{message}</p> : null}

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? "is-active" : ""} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Geral" ? (
        <section className="card" style={{ maxWidth: 620 }}>
          <Field label="Nome do site">
            <input
              className="ntv-input"
              value={form.siteName}
              onChange={(e) => set("siteName", e.target.value)}
            />
          </Field>
          <Field label="URL do site">
            <input
              className="ntv-input"
              value={form.url}
              onChange={(e) => set("url", e.target.value)}
            />
          </Field>
          <Field label="Logo">
            <ImageDrop value={form.logoUrl} onChange={(url) => set("logoUrl", url)} />
          </Field>
          <Field
            label="Favicon"
            hint="Ícone da aba do navegador. Ideal 512×512 px (PNG) ou SVG quadrado."
          >
            <ImageDrop
              value={form.faviconUrl}
              onChange={(url) => set("faviconUrl", url)}
              label="Arraste o favicon ou clique para enviar"
            />
          </Field>
          <Toggle
            label="Modo manutenção"
            hint="O portal exibe uma página de aviso enquanto ativo."
            checked={form.maintenance}
            onChange={(v) => set("maintenance", v)}
          />
        </section>
      ) : null}

      {tab === "Sidebar" && data?.settings?.sidebar ? (
        <SidebarConfig
          widgets={data.settings.sidebar.widgets}
          adLimit={data.settings.sidebar.adLimit}
          onSaved={() => void refetch()}
        />
      ) : null}

      {tab === "Fontes RSS" ? (
        <section className="card" style={{ maxWidth: 720 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
            <h2 className="card__title" style={{ margin: 0 }}>
              Fontes cadastradas
            </h2>
            <button
              className="ntv-btn ntv-btn--outline"
              style={{ marginLeft: "auto" }}
              disabled={ingesting}
              onClick={async () => {
                const { data: result } = await runRss();
                setMessage(`${result.runRssIngest} notícia(s) importada(s).`);
                await refetch();
              }}
            >
              {ingesting ? "Importando…" : "Importar agora"}
            </button>
          </div>

          <p className="hint" style={{ marginBottom: 14 }}>
            Política: publica direto · crédito automático da fonte ("via ge.globo · RSS").
          </p>

          {data?.rssSources?.map((source: any) => (
            <div
              key={source.id}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                padding: "12px 0",
                borderBottom: "1px solid var(--ntv-border-inner)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: source.lastError ? "var(--ntv-alert)" : "var(--ntv-success)",
                }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: 13.5, color: "var(--ntv-ink)" }}>{source.name}</strong>
                <span className="hint" style={{ wordBreak: "break-all" }}>
                  {source.url}
                </span>
                <span className="hint">
                  {source.lastError
                    ? `Erro: ${source.lastError} (${formatDateTime(source.lastFetchAt)})`
                    : `${source.importedCount} importadas · ${formatDateTime(source.lastFetchAt) || "sem leitura ainda"}`}
                </span>
              </span>
              <label className="toggle" style={{ borderBottom: 0, padding: 0 }}>
                <input
                  type="checkbox"
                  checked={source.enabled}
                  onChange={async (e) => {
                    await toggleRss({ variables: { id: source.id, enabled: e.target.checked } });
                    await refetch();
                  }}
                />
                <span className="toggle__track" />
              </label>
              <button
                className="linkbtn"
                onClick={async () => {
                  if (!confirm(`Remover ${source.name}?`)) return;
                  await deleteRss({ variables: { id: source.id } });
                  await refetch();
                }}
              >
                Remover
              </button>
            </div>
          ))}

          <form
            style={{ marginTop: 18 }}
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              await createRss({
                variables: {
                  input: {
                    name: form.get("name"),
                    url: form.get("url"),
                    category: form.get("category") || "Notícias",
                  },
                },
              });
              (event.target as HTMLFormElement).reset();
              await refetch();
            }}
          >
            <h3 className="card__title">Nova fonte</h3>
            <Field label="Nome">
              <input className="ntv-input" name="name" required placeholder="ge.globo — Vasco" />
            </Field>
            <Field label="URL do feed">
              <input className="ntv-input" name="url" type="url" required />
            </Field>
            <Field label="Categoria dos posts importados">
              <input className="ntv-input" name="category" defaultValue="Notícias" />
            </Field>
            <button className="ntv-btn">Adicionar fonte</button>
          </form>
        </section>
      ) : null}

      {tab === "Redes sociais" ? (
        <>
          <section className="card" style={{ maxWidth: 620 }}>
            <h2 className="card__title">Links do rodapé</h2>
            <p className="hint" style={{ marginBottom: 14 }}>
              O rodapé do portal mostra o ícone de cada rede. Rede sem URL não aparece.
            </p>

            {NETWORK_FIELDS.map((network) => (
              <Field key={network.key} label={network.label}>
                <input
                  className="ntv-input"
                  type="url"
                  placeholder={network.placeholder}
                  value={links[network.key] ?? ""}
                  onChange={(e) => setLinks((prev) => ({ ...prev, [network.key]: e.target.value }))}
                />
              </Field>
            ))}

            <button
              className="ntv-btn"
              disabled={savingLinks}
              onClick={async () => {
                await saveSocialLinks({
                  variables: {
                    links: Object.entries(links).map(([network, url]) => ({ network, url })),
                  },
                });
                setMessage("Links do rodapé salvos.");
                await refetch();
              }}
            >
              {savingLinks ? "Salvando…" : "Salvar links"}
            </button>
          </section>

          <section className="card" style={{ maxWidth: 620 }}>
            <h2 className="card__title">Canal do YouTube (widget da sidebar)</h2>
            <Field
              label="URL do canal"
              hint="Aceita @handle ou /channel/UC…. O channelId é resolvido na sincronização."
            >
              <input
                className="ntv-input"
                type="url"
                value={channelUrl}
                onChange={(e) => setChannelUrl(e.target.value)}
              />
            </Field>

            {data?.settings?.youtube?.channelTitle ? (
              <p className="hint">
                Canal detectado: <strong>{data.settings.youtube.channelTitle}</strong>
                {data.settings.youtube.channelId ? ` (${data.settings.youtube.channelId})` : ""}
                {data.settings.youtube.lastSyncAt
                  ? ` · última sincronização ${formatDateTime(data.settings.youtube.lastSyncAt)}`
                  : ""}
              </p>
            ) : null}
            {data?.settings?.youtube?.lastError ? (
              <p className="alert">{data.settings.youtube.lastError}</p>
            ) : null}

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                className="ntv-btn ntv-btn--outline"
                onClick={async () => {
                  await saveYoutubeChannel({ variables: { channelUrl } });
                  setMessage("Canal salvo. Sincronize para carregar os vídeos.");
                  await refetch();
                }}
              >
                Salvar canal
              </button>
              <button
                className="ntv-btn"
                disabled={syncingYoutube}
                onClick={async () => {
                  try {
                    const { data: result } = await syncYoutube();
                    setMessage(`${result.syncYoutube} vídeo(s) novo(s) importado(s).`);
                  } catch (e) {
                    setMessage(e instanceof Error ? e.message : "Falha ao sincronizar.");
                  }
                  await refetch();
                }}
              >
                {syncingYoutube ? "Sincronizando…" : "Sincronizar vídeos"}
              </button>
            </div>
          </section>

          <section className="card" style={{ maxWidth: 620 }}>
            <h2 className="card__title">Contas conectadas (duplicação de posts)</h2>
            {(["instagram", "x"] as const).map((network) => {
              const account = social?.[network];
              return (
                <div
                  key={network}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    padding: "14px 0",
                    borderBottom: "1px solid var(--ntv-border-inner)",
                  }}
                >
                  <span style={{ flex: 1 }}>
                    <strong style={{ textTransform: "capitalize", color: "var(--ntv-ink)" }}>
                      {network === "x" ? "X / Twitter" : network}
                    </strong>
                    <span className="hint">{account?.handle ?? "não conectada"}</span>
                  </span>
                  <span
                    className={`ntv-badge ${account?.connected ? "ntv-badge--success" : "ntv-badge--mute"}`}
                  >
                    {account?.connected ? "Conectado" : "Desconectado"}
                  </span>
                  <button
                    className="linkbtn"
                    onClick={async () => {
                      if (account?.connected) {
                        await disconnectSocial({ variables: { network } });
                      } else {
                        const handle = prompt(`@ da conta no ${network}:`);
                        if (!handle) return;
                        await connectSocial({ variables: { network, handle } });
                      }
                      await refetch();
                    }}
                  >
                    {account?.connected ? "Desconectar" : "Conectar"}
                  </button>
                </div>
              );
            })}
          </section>
        </>
      ) : null}

      {tab === "SEO" ? (
        <section className="card" style={{ maxWidth: 620 }}>
          <Field label="Título padrão">
            <input
              className="ntv-input"
              value={form.seoTitle}
              onChange={(e) => set("seoTitle", e.target.value)}
            />
          </Field>
          <Field label="Descrição padrão">
            <textarea
              className="ntv-textarea"
              rows={3}
              value={form.seoDescription}
              onChange={(e) => set("seoDescription", e.target.value)}
            />
          </Field>
          <Field label="Imagem de compartilhamento (OG)" hint="1200×630 px.">
            <ImageDrop value={form.seoOgImage} onChange={(url) => set("seoOgImage", url)} />
          </Field>
          <Field label="Palavras-chave do site" hint="Separadas por vírgula.">
            <input
              className="ntv-input"
              value={form.seoKeywords}
              onChange={(e) => set("seoKeywords", e.target.value)}
              placeholder="Vasco da Gama, notícias do Vasco, São Januário"
            />
          </Field>
          <Field
            label="Verificação do Google Search Console"
            hint="Só o valor do content da meta google-site-verification."
          >
            <input
              className="ntv-input"
              value={form.googleVerification}
              onChange={(e) => set("googleVerification", e.target.value)}
            />
          </Field>

          <p className="hint" style={{ marginTop: 16 }}>
            O portal publica automaticamente: <code>robots.txt</code>, <code>sitemap.xml</code>,{" "}
            <code>sitemap-news.xml</code> (Google News, últimas 48 h) e <code>feed.xml</code>.
          </p>
        </section>
      ) : null}
    </>
  );
}
