import { useEffect, useMemo, useState } from "react";
import { useApolloClient, useMutation, useQuery } from "@apollo/client";
import { Link } from "react-router";
import { formatDate, type Role } from "@ntv/shared";
import {
  BULK_DELETE_POSTS,
  BULK_UPDATE_POSTS,
  CATEGORIES,
  DELETE_POST,
  POSTS,
  PUBLISH_POST,
} from "../lib/queries";
import { Empty, StatusBadge } from "../components/ui";

const PAGE = 15;
/** Teto do `limit` no resolver de posts — usado ao varrer todas as páginas. */
const API_MAX_LIMIT = 50;

const CATEGORY_OPTIONS = [
  "NTV Exclusivo",
  "Notícias",
  "Mercado da Bola",
  "Bastidores",
  "Análise",
  "Jogos",
  "Base",
];

interface PostRow {
  id: string;
  title: string;
  slug: string;
  category: string;
  status: string;
  publishedAt?: string | null;
  updatedAt: string;
  views: number;
  credit?: string | null;
  featured: { active: boolean; position?: number | null };
  duplicateOf?: string | null;
  duplicateSource?: string | null;
  source: { type: string; name?: string | null };
  author?: { id: string; name: string } | null;
}

export function PostsList({ me }: { me: { id: string; role: Role } }) {
  const client = useApolloClient();
  const [filter, setFilter] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const cleanFilter = useMemo(() => {
    const { duplicates, ...rest } = filter;
    const clean: Record<string, unknown> = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v),
    );
    // O seletor de duplicatas vira dois flags no filtro da API.
    if (duplicates === "only") clean.onlyDuplicates = true;
    if (duplicates === "all") clean.hideDuplicates = false;
    return clean;
  }, [filter]);
  const variables = { filter: cleanFilter, limit: PAGE, offset: page * PAGE };

  const { data, loading, refetch } = useQuery<{
    posts: { total: number; hasMore: boolean; items: PostRow[] };
  }>(POSTS, { variables });
  const { data: cats } = useQuery<{ categories: { value: string }[] }>(CATEGORIES);

  const [deletePost] = useMutation(DELETE_POST);
  const [publishPost] = useMutation(PUBLISH_POST);
  const [bulkUpdate] = useMutation(BULK_UPDATE_POSTS);
  const [bulkDelete] = useMutation(BULK_DELETE_POSTS);

  // Trocar de filtro invalida a seleção — ela deixa de corresponder ao que está à vista.
  useEffect(() => setSelected([]), [JSON.stringify(cleanFilter)]);

  const set = (key: string, value: string) => {
    setPage(0);
    setFilter((prev) => ({ ...prev, [key]: value }));
  };

  const posts = data?.posts.items ?? [];
  const total = data?.posts.total ?? 0;
  const pageIds = posts.map((p) => p.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  function toggleAllOnPage(checked: boolean) {
    setSelected((prev) =>
      checked
        ? [...new Set([...prev, ...pageIds])]
        : prev.filter((id) => !pageIds.includes(id)),
    );
  }

  /** Varre todas as páginas do filtro atual e seleciona tudo. */
  async function selectEverything() {
    setWorking(true);
    try {
      const ids: string[] = [];
      for (let offset = 0; offset < total; offset += API_MAX_LIMIT) {
        const { data: pageData } = await client.query<{ posts: { items: { id: string }[] } }>({
          query: POSTS,
          variables: { filter: cleanFilter, limit: API_MAX_LIMIT, offset },
          fetchPolicy: "network-only",
        });
        ids.push(...pageData.posts.items.map((p) => p.id));
      }
      setSelected(ids);
      setMessage(`${ids.length} notícia(s) selecionada(s).`);
    } finally {
      setWorking(false);
    }
  }

  async function applyBulk() {
    if (!bulkStatus && !bulkCategory) {
      return setMessage("Escolha um status ou uma categoria para aplicar.");
    }
    setWorking(true);
    try {
      const { data: result } = await bulkUpdate({
        variables: {
          ids: selected,
          status: bulkStatus || null,
          category: bulkCategory || null,
        },
      });
      setMessage(result.bulkUpdatePosts.message);
      setSelected([]);
      setBulkStatus("");
      setBulkCategory("");
      await refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na ação em massa.");
    } finally {
      setWorking(false);
    }
  }

  async function deleteBulk() {
    if (!confirm(`Excluir ${selected.length} notícia(s)? A ação não pode ser desfeita.`)) return;
    setWorking(true);
    try {
      const { data: result } = await bulkDelete({ variables: { ids: selected } });
      setMessage(result.bulkDeletePosts.message);
      setSelected([]);
      await refetch();
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <div className="page__head">
        <h1 className="page__title">Notícias</h1>
        <div className="page__actions">
          <Link className="ntv-btn" to="/noticias/nova">
            Nova notícia
          </Link>
        </div>
      </div>

      {message ? <p className="alert alert--ok">{message}</p> : null}

      <div className="filters-row">
        <input
          className="ntv-input"
          placeholder="Buscar por título"
          onChange={(e) => set("search", e.target.value)}
        />
        <select className="ntv-select" onChange={(e) => set("status", e.target.value)}>
          <option value="">Todos os status</option>
          <option value="published">Publicado</option>
          <option value="draft">Rascunho</option>
          <option value="scheduled">Agendado</option>
        </select>
        <select className="ntv-select" onChange={(e) => set("category", e.target.value)}>
          <option value="">Todas as categorias</option>
          {cats?.categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.value}
            </option>
          ))}
        </select>
        <select className="ntv-select" onChange={(e) => set("sourceType", e.target.value)}>
          <option value="">Toda origem</option>
          <option value="team">Original</option>
          <option value="rss">RSS</option>
        </select>
        <select
          className="ntv-select"
          onChange={(e) => set("duplicates", e.target.value)}
          aria-label="Duplicatas"
        >
          <option value="">Sem duplicatas</option>
          <option value="only">Só duplicatas</option>
          <option value="all">Incluir duplicatas</option>
        </select>
        <input
          className="ntv-input"
          type="date"
          aria-label="A partir de"
          onChange={(e) => set("from", e.target.value ? new Date(e.target.value).toISOString() : "")}
        />
      </div>

      {selected.length ? (
        <div className="bulkbar">
          <strong>{selected.length} selecionada(s)</strong>

          {!allSelectedAcrossFilter(selected.length, total) ? (
            <button className="linkbtn" onClick={selectEverything} disabled={working}>
              Selecionar todas as {total}
            </button>
          ) : null}
          <button className="linkbtn" onClick={() => setSelected([])}>
            Limpar seleção
          </button>

          <span className="bulkbar__sep" />

          <select
            className="ntv-select"
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
            aria-label="Novo status"
          >
            <option value="">Trocar status…</option>
            <option value="published">Publicado</option>
            <option value="draft">Rascunho</option>
            <option value="scheduled">Agendado</option>
          </select>

          <select
            className="ntv-select"
            value={bulkCategory}
            onChange={(e) => setBulkCategory(e.target.value)}
            aria-label="Nova categoria"
          >
            <option value="">Trocar categoria…</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <button className="ntv-btn" onClick={applyBulk} disabled={working}>
            {working ? "Aplicando…" : "Aplicar"}
          </button>
          <button className="ntv-btn ntv-btn--outline" onClick={deleteBulk} disabled={working}>
            Excluir
          </button>
        </div>
      ) : null}

      <div className="card" style={{ padding: 0 }}>
        <div className="tablewrap">
          <table className="list">
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={(e) => toggleAllOnPage(e.target.checked)}
                    aria-label="Selecionar todas desta página"
                  />
                </th>
                <th>Título</th>
                <th>Autor / origem</th>
                <th>Categoria</th>
                <th>Status</th>
                <th>Data</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(post.id)}
                      aria-label={`Selecionar ${post.title}`}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked ? [...prev, post.id] : prev.filter((id) => id !== post.id),
                        )
                      }
                    />
                  </td>
                  <td>
                    <Link to={`/noticias/${post.slug}`} className="rowtitle">
                      {post.title}
                    </Link>
                    {post.featured.active ? (
                      <span className="ntv-badge">Destaque {post.featured.position}</span>
                    ) : null}
                    {post.duplicateOf ? (
                      <span
                        className="ntv-badge ntv-badge--warning"
                        title={`Já publicada por ${post.duplicateSource ?? "outra fonte"}`}
                      >
                        Duplicada
                      </span>
                    ) : null}
                    <span className="ntv-meta"> {post.views} visualizações</span>
                  </td>
                  <td>
                    {post.author?.name ?? post.source.name ?? "—"}
                    {post.source.type === "rss" ? (
                      <>
                        {" "}
                        <span className="ntv-badge ntv-badge--mute">RSS</span>
                      </>
                    ) : null}
                  </td>
                  <td>{post.category}</td>
                  <td>
                    <StatusBadge status={post.status} />
                  </td>
                  <td className="ntv-meta">{formatDate(post.publishedAt ?? post.updatedAt)}</td>
                  <td>
                    <div className="rowactions">
                      <Link className="linkbtn" to={`/noticias/${post.slug}`}>
                        Editar
                      </Link>
                      {post.status !== "published" ? (
                        <button
                          className="linkbtn"
                          onClick={async () => {
                            await publishPost({ variables: { id: post.id } });
                            await refetch();
                          }}
                        >
                          Publicar
                        </button>
                      ) : null}
                      {me.role === "admin" || post.author?.id === me.id ? (
                        <button
                          className="linkbtn"
                          onClick={async () => {
                            if (!confirm(`Excluir "${post.title}"?`)) return;
                            await deletePost({ variables: { id: post.id } });
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

        {!posts.length && !loading ? <Empty>Nenhuma notícia encontrada.</Empty> : null}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14 }}>
        <button
          className="ntv-btn ntv-btn--outline"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          Anterior
        </button>
        <span className="ntv-meta">{data ? `${page * PAGE + posts.length} de ${total}` : ""}</span>
        <button
          className="ntv-btn ntv-btn--outline"
          disabled={!data?.posts.hasMore}
          onClick={() => setPage((p) => p + 1)}
        >
          Próxima
        </button>
      </div>
    </>
  );
}

const allSelectedAcrossFilter = (selectedCount: number, total: number) =>
  total > 0 && selectedCount >= total;
