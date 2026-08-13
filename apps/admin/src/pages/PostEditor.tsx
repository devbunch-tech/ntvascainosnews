import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useNavigate, useParams } from "react-router";
import type { Role } from "@ntv/shared";
import { CREATE_POST, POST_BY_SLUG, PUBLISH_POST, SETTINGS, UPDATE_POST } from "../lib/queries";
import { Field, ImageDrop, Toggle } from "../components/ui";
import { RichText } from "../components/RichText";

const CATEGORIES = [
  "NTV Exclusivo",
  "Notícias",
  "Mercado da Bola",
  "Bastidores",
  "Análise",
  "Jogos",
  "Base",
];

interface FormState {
  title: string;
  subtitle: string;
  body: string;
  category: string;
  tags: string;
  coverImage: string;
  coverCredit: string;
  status: "draft" | "published" | "scheduled";
  publishedAt: string;
  featuredActive: boolean;
  featuredPosition: number;
  instagram: boolean;
  x: boolean;
  seoDescription: string;
  seoKeywords: string;
  seoAuto: boolean;
  noindex: boolean;
}

const EMPTY: FormState = {
  title: "",
  subtitle: "",
  body: "",
  category: "Notícias",
  tags: "",
  coverImage: "",
  coverCredit: "",
  status: "draft",
  publishedAt: "",
  featuredActive: false,
  featuredPosition: 1,
  instagram: false,
  x: false,
  seoDescription: "",
  seoKeywords: "",
  seoAuto: true,
  noindex: false,
};

export function PostEditor({ me }: { me: { id: string; name: string; role: Role } }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [postId, setPostId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { data } = useQuery(POST_BY_SLUG, { variables: { slug }, skip: !slug });
  const { data: settings } = useQuery(SETTINGS, { errorPolicy: "ignore" });
  const [createPost, { loading: creating }] = useMutation(CREATE_POST);
  const [updatePost, { loading: updating }] = useMutation(UPDATE_POST);
  const [publishPost] = useMutation(PUBLISH_POST);

  useEffect(() => {
    const post = data?.post;
    if (!post) return;
    setPostId(post.id);
    setForm({
      title: post.title,
      subtitle: post.subtitle ?? "",
      body: post.body ?? "",
      category: post.category,
      tags: (post.tags ?? []).join(", "),
      coverImage: post.coverImage ?? "",
      coverCredit: post.coverCredit ?? "",
      status: post.status,
      publishedAt: post.publishedAt ? post.publishedAt.slice(0, 16) : "",
      featuredActive: post.featured?.active ?? false,
      featuredPosition: post.featured?.position ?? 1,
      instagram: post.crosspost?.instagram ?? false,
      x: post.crosspost?.x ?? false,
      seoDescription: post.seo?.auto ? "" : (post.seo?.description ?? ""),
      seoKeywords: post.seo?.auto ? "" : (post.seo?.keywords ?? []).join(", "),
      seoAuto: post.seo?.auto ?? true,
      noindex: post.seo?.noindex ?? false,
    });
  }, [data]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  function buildInput(status?: FormState["status"]) {
    return {
      title: form.title,
      subtitle: form.subtitle || null,
      body: form.body,
      category: form.category,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      coverImage: form.coverImage || null,
      coverCredit: form.coverCredit || null,
      status: status ?? form.status,
      publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
      featured: { active: form.featuredActive, position: form.featuredActive ? form.featuredPosition : null },
      crosspost: { instagram: form.instagram, x: form.x },
      // Vazio = a API gera sozinha a partir do subtítulo/resumo.
      seoDescription: form.seoDescription.trim() || null,
      seoKeywords: form.seoKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
      noindex: form.noindex,
    };
  }

  async function save(status?: FormState["status"]) {
    if (!form.title.trim()) return setMessage("Dê um título à notícia antes de salvar.");
    const input = buildInput(status);

    if (postId) {
      const { data: result } = await updatePost({ variables: { id: postId, input } });
      if (status === "published") await publishPost({ variables: { id: postId } });
      setMessage("Notícia salva.");
      if (result.updatePost.slug !== slug) navigate(`/noticias/${result.updatePost.slug}`, { replace: true });
    } else {
      const { data: result } = await createPost({ variables: { input } });
      setPostId(result.createPost.id);
      if (status === "published") await publishPost({ variables: { id: result.createPost.id } });
      setMessage("Notícia criada.");
      navigate(`/noticias/${result.createPost.slug}`, { replace: true });
    }
  }

  const social = settings?.settings?.socialAccounts;
  const busy = creating || updating;

  return (
    <>
      <div className="page__head">
        <h1 className="page__title">{postId ? "Editar notícia" : "Nova notícia"}</h1>
        <div className="page__actions">
          <button className="ntv-btn ntv-btn--outline" disabled={busy} onClick={() => save()}>
            Salvar
          </button>
          <button className="ntv-btn" disabled={busy} onClick={() => save("published")}>
            {form.status === "published" ? "Atualizar" : "Publicar"}
          </button>
        </div>
      </div>

      {message ? <p className="alert alert--ok">{message}</p> : null}

      <div className="editor">
        <div className="card">
          <textarea
            className="titlearea"
            rows={2}
            placeholder="Título da notícia"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
          <input
            className="ntv-input"
            style={{ marginBottom: 14 }}
            placeholder="Subtítulo (linha fina)"
            value={form.subtitle}
            onChange={(e) => set("subtitle", e.target.value)}
          />

          <RichText value={form.body} onChange={(html) => set("body", html)} />

          <div style={{ marginTop: 14 }}>
            <Field label="Tags" hint="Separe por vírgula.">
              <input
                className="ntv-input"
                value={form.tags}
                onChange={(e) => set("tags", e.target.value)}
                placeholder="mercado, reforço, brasileirão"
              />
            </Field>
          </div>
        </div>

        <aside>
          <section className="card">
            <h2 className="card__title">Publicação</h2>
            <Field label="Status">
              <select
                className="ntv-select"
                value={form.status}
                onChange={(e) => set("status", e.target.value as FormState["status"])}
              >
                <option value="draft">Rascunho</option>
                <option value="published">Publicado</option>
                <option value="scheduled">Agendado</option>
              </select>
            </Field>
            {form.status === "scheduled" ? (
              <Field label="Publicar em">
                <input
                  className="ntv-input"
                  type="datetime-local"
                  value={form.publishedAt}
                  onChange={(e) => set("publishedAt", e.target.value)}
                />
              </Field>
            ) : null}
            <Field label="Categoria">
              <select
                className="ntv-select"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Autor">
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--ntv-ink)" }}>
                {data?.post?.author?.name ?? me.name}{" "}
                <span className="ntv-badge" style={{ marginLeft: 4 }}>
                  Equipe
                </span>
              </p>
            </Field>
          </section>

          <section className="card">
            <h2 className="card__title">Destaque</h2>
            <Toggle
              label="Exibir na home"
              checked={form.featuredActive}
              onChange={(v) => set("featuredActive", v)}
            />
            {form.featuredActive ? (
              <>
                <Field label="Posição">
                  <select
                    className="ntv-select"
                    value={form.featuredPosition}
                    onChange={(e) => set("featuredPosition", Number(e.target.value))}
                  >
                    <option value={1}>1 — manchete principal</option>
                    <option value={2}>2 — secundário</option>
                    <option value={3}>3 — secundário</option>
                  </select>
                </Field>
                <p className="hint">
                  O ocupante atual desta posição volta para a lista comum de notícias.
                </p>
              </>
            ) : null}
          </section>

          <section className="card">
            <h2 className="card__title">Duplicar em outras redes</h2>
            <Toggle
              label="Instagram"
              hint={social?.instagram?.connected ? social.instagram.handle : "conta não conectada"}
              checked={form.instagram}
              onChange={(v) => set("instagram", v)}
            />
            <Toggle
              label="X / Twitter"
              hint={social?.x?.connected ? social.x.handle : "conta não conectada"}
              checked={form.x}
              onChange={(v) => set("x", v)}
            />
            <p className="hint">A postagem dispara no momento da publicação, com card e link.</p>
          </section>

          <section className="card">
            <h2 className="card__title">SEO</h2>
            {form.seoAuto ? (
              <p className="hint" style={{ marginBottom: 10 }}>
                Descrição, palavras-chave e geolocalização estão sendo <strong>geradas
                automaticamente</strong> a partir do subtítulo, resumo e tags. Preencha abaixo
                só se quiser escrever à mão.
              </p>
            ) : (
              <p className="hint" style={{ marginBottom: 10 }}>
                Esta notícia usa SEO <strong>escrito à mão</strong>. Apague os campos para voltar
                à geração automática.
              </p>
            )}

            <Field
              label="Descrição (meta description)"
              hint={`${form.seoDescription.length}/158 caracteres — o Google corta o excedente.`}
            >
              <textarea
                className="ntv-textarea"
                rows={3}
                maxLength={200}
                value={form.seoDescription}
                onChange={(e) => set("seoDescription", e.target.value)}
                placeholder={data?.post?.seo?.description ?? "Gerada automaticamente"}
              />
            </Field>

            <Field label="Palavras-chave" hint="Separadas por vírgula.">
              <input
                className="ntv-input"
                value={form.seoKeywords}
                onChange={(e) => set("seoKeywords", e.target.value)}
                placeholder={(data?.post?.seo?.keywords ?? []).join(", ") || "Geradas automaticamente"}
              />
            </Field>

            <Toggle
              label="Não indexar (noindex)"
              hint="Tira a notícia do Google sem despublicar do portal."
              checked={form.noindex}
              onChange={(v) => set("noindex", v)}
            />
          </section>

          <section className="card">
            <h2 className="card__title">Imagem de capa</h2>
            <ImageDrop value={form.coverImage} onChange={(url) => set("coverImage", url)} />
            <div style={{ marginTop: 10 }}>
              <Field label="Crédito da foto">
                <input
                  className="ntv-input"
                  value={form.coverCredit}
                  onChange={(e) => set("coverCredit", e.target.value)}
                  placeholder="Foto: Divulgação / Vasco"
                />
              </Field>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
