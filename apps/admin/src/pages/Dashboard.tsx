import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { Link } from "react-router";
import { formatDateTime } from "@ntv/shared";
import { DASHBOARD, REORDER_FEATURED, RUN_RSS } from "../lib/queries";
import { Empty, StatusBadge } from "../components/ui";

interface SlotPost {
  id: string;
  title: string;
  category: string;
  featured: { position: number | null };
}

interface DashboardData {
  dashboard: {
    stats: {
      visitsToday: number;
      postsToday: number;
      postsTodaySplit: { team: number; rss: number };
      rssImportedToday: number;
      shopClicksToday: number;
    };
    featuredSlots: (SlotPost | null)[];
    rssSources: {
      id: string;
      name: string;
      enabled: boolean;
      lastFetchAt?: string | null;
      lastError?: string | null;
      importedCount: number;
    }[];
    recentPosts: { id: string; title: string; slug: string; status: string; updatedAt: string }[];
  };
  posts: { items: { id: string; title: string; category: string }[] };
}

export function Dashboard() {
  const { data, loading, refetch } = useQuery<DashboardData>(DASHBOARD);
  const [reorder, { loading: saving }] = useMutation(REORDER_FEATURED);
  const [runRss, { loading: ingesting }] = useMutation(RUN_RSS);
  const [slots, setSlots] = useState<(SlotPost | null)[]>([null, null, null]);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (data?.dashboard.featuredSlots) setSlots(data.dashboard.featuredSlots);
  }, [data]);

  if (loading && !data) return <p className="ntv-meta">Carregando…</p>;
  if (!data) return null;

  const { stats, rssSources, recentPosts } = data.dashboard;

  /** Reordenação por arraste entre as três posições. */
  function onDrop(target: number, payload: string) {
    const next = [...slots];
    if (payload.startsWith("slot:")) {
      const from = Number(payload.slice(5));
      [next[from], next[target]] = [next[target], next[from]];
    } else {
      const post = data!.posts.items.find((p) => p.id === payload);
      if (!post) return;
      // Exclusividade: se o post já ocupa outra posição, ela é liberada.
      const existing = next.findIndex((s) => s?.id === post.id);
      if (existing >= 0) next[existing] = null;
      next[target] = { ...post, featured: { position: target + 1 } };
    }
    setSlots(next);
    setDragOver(null);
  }

  async function save() {
    const payload = slots
      .map((slot, index) => (slot ? { postId: slot.id, position: index + 1 } : null))
      .filter(Boolean) as { postId: string; position: number }[];
    await reorder({ variables: { slots: payload } });
    setMessage("Destaques atualizados.");
    await refetch();
  }

  return (
    <>
      <div className="page__head">
        <h1 className="page__title">Dashboard</h1>
        <div className="page__actions">
          <button
            className="ntv-btn ntv-btn--outline"
            disabled={ingesting}
            onClick={async () => {
              const { data: result } = await runRss();
              setMessage(`${result.runRssIngest} notícia(s) importada(s) do RSS.`);
              await refetch();
            }}
          >
            {ingesting ? "Importando…" : "Rodar RSS agora"}
          </button>
          <Link className="ntv-btn" to="/noticias/nova">
            Nova notícia
          </Link>
        </div>
      </div>

      {message ? <p className="alert alert--ok">{message}</p> : null}

      <div className="statgrid4">
        <div className="stat">
          <span className="stat__label">Visitas hoje</span>
          <p className="stat__value">{stats.visitsToday.toLocaleString("pt-BR")}</p>
          <span className="stat__hint">sessões registradas</span>
        </div>
        <div className="stat">
          <span className="stat__label">Posts hoje</span>
          <p className="stat__value">{stats.postsToday}</p>
          <span className="stat__hint">
            {stats.postsTodaySplit.team} equipe · {stats.postsTodaySplit.rss} RSS
          </span>
        </div>
        <div className="stat">
          <span className="stat__label">Importadas do RSS</span>
          <p className="stat__value">{stats.rssImportedToday}</p>
          <span className="stat__hint">nas últimas 24 h</span>
        </div>
        <div className="stat">
          <span className="stat__label">Cliques na Loja</span>
          <p className="stat__value">{stats.shopClicksToday}</p>
          <span className="stat__hint">saídas para marketplaces</span>
        </div>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <h2 className="card__title">Destaques da home</h2>
        <p className="hint" style={{ marginBottom: 12 }}>
          Arraste para reordenar. Definir a posição 1 devolve o ocupante anterior à lista comum.
        </p>

        <div className="slots">
          {slots.map((slot, index) => (
            <div
              key={index}
              className={`slot ${slot ? "" : "slot--empty"} ${dragOver === index ? "slot--over" : ""}`}
              draggable={Boolean(slot)}
              onDragStart={(e) => e.dataTransfer.setData("text/plain", `slot:${index}`)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(index);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                onDrop(index, e.dataTransfer.getData("text/plain"));
              }}
            >
              {slot ? (
                <>
                  <span className="slot__pos">{index + 1}</span>
                  <span>
                    <span className="slot__title">{slot.title}</span>
                    <span className="ntv-meta">{slot.category}</span>
                  </span>
                  <button
                    className="linkbtn"
                    style={{ marginLeft: "auto" }}
                    onClick={() => {
                      const next = [...slots];
                      next[index] = null;
                      setSlots(next);
                    }}
                  >
                    Remover
                  </button>
                </>
              ) : (
                `Posição ${index + 1} — arraste uma notícia aqui`
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button className="ntv-btn" onClick={save} disabled={saving}>
            {saving ? "Salvando…" : "Salvar destaques"}
          </button>
        </div>

        <h3 className="card__title" style={{ marginTop: 24 }}>
          Publicadas — arraste para um slot
        </h3>
        <div className="tablewrap" style={{ maxHeight: 220, overflowY: "auto" }}>
          {data.posts.items.map((post) => (
            <div
              key={post.id}
              className="slot"
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", post.id)}
            >
              <span className="slot__title">{post.title}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="card__title">Fontes RSS</h2>
        {rssSources.length ? (
          rssSources.map((source) => (
            <div key={source.id} className="matchrow" style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--ntv-border-inner)" }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  marginTop: 6,
                  background: source.lastError ? "var(--ntv-alert)" : "var(--ntv-success)",
                }}
              />
              <span style={{ flex: 1 }}>
                <strong style={{ fontSize: 13.5, color: "var(--ntv-ink)" }}>{source.name}</strong>
                <span className="hint">
                  {source.lastError
                    ? `${source.lastError} · ${formatDateTime(source.lastFetchAt)}`
                    : `OK · última leitura ${formatDateTime(source.lastFetchAt) || "—"} · ${source.importedCount} importadas`}
                </span>
              </span>
              <span className={`ntv-badge ${source.enabled ? "ntv-badge--success" : "ntv-badge--mute"}`}>
                {source.enabled ? "Ativa" : "Pausada"}
              </span>
            </div>
          ))
        ) : (
          <Empty>Nenhuma fonte cadastrada.</Empty>
        )}
      </section>

      <section className="card">
        <h2 className="card__title">Editadas recentemente</h2>
        {recentPosts.map((post) => (
          <div
            key={post.id}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              padding: "10px 0",
              borderBottom: "1px solid var(--ntv-border-inner)",
            }}
          >
            <Link to={`/noticias/${post.slug}`} style={{ fontWeight: 700, fontSize: 13.5 }}>
              {post.title}
            </Link>
            <span style={{ marginLeft: "auto" }}>
              <StatusBadge status={post.status} />
            </span>
            <span className="ntv-meta">{formatDateTime(post.updatedAt)}</span>
          </div>
        ))}
      </section>
    </>
  );
}
