import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { formatDateTime } from "@ntv/shared";
import {
  CREATE_MATCH,
  DELETE_MATCH,
  MATCHES,
  MATCH_SOURCE,
  SAVE_TRANSFERMARKT_URL,
  SYNC_MATCHES,
  UPDATE_MATCH,
} from "../lib/queries";
import { Empty, Field } from "../components/ui";

interface MatchRow {
  id: string;
  opponent: string;
  date: string;
  competition: string;
  venue: "home" | "away";
  scoreFor?: number | null;
  scoreAgainst?: number | null;
  result?: string | null;
  ticketUrl?: string | null;
}

const EMPTY = {
  opponent: "",
  date: "",
  competition: "Brasileirão",
  venue: "home" as "home" | "away",
  scoreFor: "",
  scoreAgainst: "",
  ticketUrl: "",
};

/** `datetime-local` quer "YYYY-MM-DDTHH:mm" no fuso local. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
};

export function Matches() {
  const { data, loading, refetch } = useQuery<{ matches: MatchRow[] }>(MATCHES);
  const { data: source, refetch: refetchSource } = useQuery(MATCH_SOURCE);
  const [saveTransfermarktUrl] = useMutation(SAVE_TRANSFERMARKT_URL);
  const [tmUrl, setTmUrl] = useState("");
  const [createMatch] = useMutation(CREATE_MATCH);
  const [updateMatch] = useMutation(UPDATE_MATCH);
  const [deleteMatch] = useMutation(DELETE_MATCH);
  const [syncMatches, { loading: syncing }] = useMutation(SYNC_MATCHES);

  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const url = source?.settings?.matches?.transfermarktUrl;
    if (url) setTmUrl(url);
  }, [source]);

  useEffect(() => {
    if (!editing) return;
    const match = data?.matches.find((m) => m.id === editing);
    if (!match) return;
    setForm({
      opponent: match.opponent,
      date: toLocalInput(match.date),
      competition: match.competition,
      venue: match.venue,
      scoreFor: match.scoreFor == null ? "" : String(match.scoreFor),
      scoreAgainst: match.scoreAgainst == null ? "" : String(match.scoreAgainst),
      ticketUrl: match.ticketUrl ?? "",
    });
  }, [editing, data]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const input = {
      opponent: form.opponent,
      date: new Date(form.date).toISOString(),
      competition: form.competition,
      venue: form.venue,
      scoreFor: form.scoreFor === "" ? null : Number(form.scoreFor),
      scoreAgainst: form.scoreAgainst === "" ? null : Number(form.scoreAgainst),
      ticketUrl: form.ticketUrl || null,
    };

    if (editing) await updateMatch({ variables: { id: editing, input } });
    else await createMatch({ variables: { input } });

    setMessage(editing ? "Jogo atualizado." : "Jogo cadastrado.");
    setEditing(null);
    setForm({ ...EMPTY });
    await refetch();
  }

  const matches = data?.matches ?? [];
  const now = Date.now();
  const past = matches.filter((m) => m.scoreFor != null);
  const next = matches.filter((m) => m.scoreFor == null && new Date(m.date).getTime() >= now);

  return (
    <>
      <div className="page__head">
        <h1 className="page__title">Jogos</h1>
        <div className="page__actions">
          <button
            className="ntv-btn ntv-btn--outline"
            disabled={syncing}
            onClick={async () => {
              const { data: result } = await syncMatches();
              setMessage(result.syncMatches.message);
              await Promise.all([refetch(), refetchSource()]);
            }}
          >
            {syncing ? "Sincronizando…" : "Sincronizar"}
          </button>
        </div>
      </div>

      {message ? <p className="alert alert--ok">{message}</p> : null}

      <section className="card" style={{ marginBottom: 16 }}>
        <h2 className="card__title">Origem dos jogos</h2>
        <Field
          label="Calendário no Transfermarkt"
          hint="A página traz a temporada inteira, agrupada por competição."
        >
          <input
            className="ntv-input"
            type="url"
            value={tmUrl}
            onChange={(e) => setTmUrl(e.target.value)}
          />
        </Field>

        {source?.settings?.matches?.lastError ? (
          <p className="alert">{source.settings.matches.lastError}</p>
        ) : source?.settings?.matches?.lastSyncAt ? (
          <p className="hint">
            {source.settings.matches.lastCount} jogo(s) na última sincronização ·{" "}
            {formatDateTime(source.settings.matches.lastSyncAt)}
          </p>
        ) : null}

        <button
          className="ntv-btn ntv-btn--outline"
          style={{ marginTop: 8 }}
          onClick={async () => {
            await saveTransfermarktUrl({ variables: { url: tmUrl } });
            setMessage("URL salva. Sincronize para atualizar os jogos.");
            await refetchSource();
          }}
        >
          Salvar URL
        </button>

        <p className="hint" style={{ marginTop: 12 }}>
          A sidebar do portal mostra os <strong>5 últimos resultados</strong> e os{" "}
          <strong>5 próximos jogos</strong>. O link de ingresso é preenchido aqui e nunca é
          sobrescrito pela sincronização.
        </p>
      </section>

      <div className="editor">
        <div className="card" style={{ padding: 0 }}>
          <div className="tablewrap">
            <table className="list">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Adversário</th>
                  <th>Competição</th>
                  <th>Local</th>
                  <th>Placar</th>
                  <th>Ingresso</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => (
                  <tr key={match.id}>
                    <td className="ntv-meta">{formatDateTime(match.date)}</td>
                    <td>
                      <span className="rowtitle">{match.opponent}</span>
                    </td>
                    <td>{match.competition}</td>
                    <td>{match.venue === "home" ? "Casa" : "Fora"}</td>
                    <td>
                      {match.scoreFor == null ? (
                        <span className="ntv-badge ntv-badge--mute">A jogar</span>
                      ) : (
                        <strong>
                          {match.scoreFor}–{match.scoreAgainst}
                        </strong>
                      )}
                    </td>
                    <td>
                      {match.ticketUrl ? (
                        <a
                          className="prodcard__link"
                          href={match.ticketUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          link
                        </a>
                      ) : (
                        <span className="ntv-meta">—</span>
                      )}
                    </td>
                    <td>
                      <div className="rowactions">
                        <button className="linkbtn" onClick={() => setEditing(match.id)}>
                          Editar
                        </button>
                        <button
                          className="linkbtn"
                          onClick={async () => {
                            if (!confirm(`Excluir o jogo contra ${match.opponent}?`)) return;
                            await deleteMatch({ variables: { id: match.id } });
                            await refetch();
                          }}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!matches.length && !loading ? <Empty>Nenhum jogo cadastrado.</Empty> : null}
          <p className="hint" style={{ padding: "12px 16px" }}>
            {past.length} resultado(s) · {next.length} jogo(s) futuro(s)
          </p>
        </div>

        <form className="card" onSubmit={submit}>
          <h2 className="card__title">{editing ? "Editar jogo" : "Novo jogo"}</h2>

          <Field label="Adversário">
            <input
              className="ntv-input"
              required
              value={form.opponent}
              onChange={(e) => set("opponent", e.target.value)}
            />
          </Field>

          <Field label="Data e hora">
            <input
              className="ntv-input"
              type="datetime-local"
              required
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </Field>

          <Field label="Competição">
            <input
              className="ntv-input"
              value={form.competition}
              onChange={(e) => set("competition", e.target.value)}
            />
          </Field>

          <Field label="Local">
            <select
              className="ntv-select"
              value={form.venue}
              onChange={(e) => set("venue", e.target.value as "home" | "away")}
            >
              <option value="home">Casa</option>
              <option value="away">Fora</option>
            </select>
          </Field>

          <Field label="Placar" hint="Deixe vazio se o jogo ainda não aconteceu.">
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="ntv-input"
                type="number"
                min={0}
                placeholder="Vasco"
                value={form.scoreFor}
                onChange={(e) => set("scoreFor", e.target.value)}
              />
              <input
                className="ntv-input"
                type="number"
                min={0}
                placeholder="Adversário"
                value={form.scoreAgainst}
                onChange={(e) => set("scoreAgainst", e.target.value)}
              />
            </div>
          </Field>

          <Field label="Link de ingresso" hint="Aparece no widget de próximos jogos.">
            <input
              className="ntv-input"
              type="url"
              placeholder="https://…"
              value={form.ticketUrl}
              onChange={(e) => set("ticketUrl", e.target.value)}
            />
          </Field>

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="ntv-btn" style={{ flex: 1 }}>
              {editing ? "Salvar" : "Cadastrar"}
            </button>
            {editing ? (
              <button
                type="button"
                className="ntv-btn ntv-btn--outline"
                onClick={() => {
                  setEditing(null);
                  setForm({ ...EMPTY });
                }}
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </>
  );
}
