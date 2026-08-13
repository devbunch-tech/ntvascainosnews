import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { formatDate } from "@ntv/shared";
import { ADS, CREATE_AD, DELETE_AD, UPDATE_AD } from "../lib/queries";
import { Empty, Field, ImageDrop, Toggle } from "../components/ui";

interface AdRow {
  id: string;
  title: string;
  advertiser?: string | null;
  imageUrl?: string | null;
  targetUrl: string;
  placement: string;
  active: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  weight: number;
  impressions: number;
  clicks: number;
}

/** Rótulos e specs iguais aos anunciados na página /anuncie do portal. */
const PLACEMENTS = [
  { value: "sidebar", label: "Barra lateral", spec: "300×250 ou 300×600" },
  { value: "in_article", label: "Dentro da matéria", spec: "728×90 / 320×100" },
  { value: "footer", label: "Rodapé", spec: "970×250" },
  { value: "shop", label: "Loja NTV", spec: "300×250" },
];

const EMPTY = {
  title: "",
  advertiser: "",
  imageUrl: "",
  targetUrl: "",
  placement: "sidebar",
  active: true,
  startsAt: "",
  endsAt: "",
  weight: "1",
};

const toDateInput = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

export function Ads() {
  const { data, loading, refetch } = useQuery<{ ads: AdRow[] }>(ADS);
  const [createAd] = useMutation(CREATE_AD);
  const [updateAd] = useMutation(UPDATE_AD);
  const [deleteAd] = useMutation(DELETE_AD);

  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    const ad = data?.ads.find((a) => a.id === editing);
    if (!ad) return;
    setForm({
      title: ad.title,
      advertiser: ad.advertiser ?? "",
      imageUrl: ad.imageUrl ?? "",
      targetUrl: ad.targetUrl,
      placement: ad.placement,
      active: ad.active,
      startsAt: toDateInput(ad.startsAt),
      endsAt: toDateInput(ad.endsAt),
      weight: String(ad.weight),
    });
  }, [editing, data]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const input = {
      title: form.title,
      advertiser: form.advertiser || null,
      imageUrl: form.imageUrl || null,
      targetUrl: form.targetUrl,
      placement: form.placement,
      active: form.active,
      startsAt: form.startsAt ? new Date(`${form.startsAt}T00:00:00`).toISOString() : null,
      endsAt: form.endsAt ? new Date(`${form.endsAt}T23:59:59`).toISOString() : null,
      weight: Number(form.weight) || 1,
    };

    if (editing) await updateAd({ variables: { id: editing, input } });
    else await createAd({ variables: { input } });

    setMessage(editing ? "Campanha atualizada." : "Campanha criada.");
    setEditing(null);
    setForm({ ...EMPTY });
    await refetch();
  }

  const ads = data?.ads ?? [];
  const ctr = (ad: AdRow) =>
    ad.impressions ? `${((ad.clicks / ad.impressions) * 100).toFixed(2)}%` : "—";

  return (
    <>
      <div className="page__head">
        <h1 className="page__title">Anunciantes</h1>
        <span className="ntv-meta">{ads.length} campanha(s)</span>
      </div>

      {message ? <p className="alert alert--ok">{message}</p> : null}

      <p className="hint" style={{ marginBottom: 16 }}>
        As peças são servidas pelo próprio portal — sem rede de terceiros e sem script externo.
        A página pública com os formatos fica em <code>/anuncie</code>.
      </p>

      <div className="editor">
        <div className="card" style={{ padding: 0 }}>
          <div className="tablewrap">
            <table className="list">
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th>Posição</th>
                  <th>Período</th>
                  <th>Status</th>
                  <th>Impressões</th>
                  <th>Cliques</th>
                  <th>CTR</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {ads.map((ad) => (
                  <tr key={ad.id}>
                    <td>
                      <span className="rowtitle">{ad.title}</span>
                      <span className="ntv-meta">{ad.advertiser ?? "—"}</span>
                    </td>
                    <td>{PLACEMENTS.find((p) => p.value === ad.placement)?.label ?? ad.placement}</td>
                    <td className="ntv-meta">
                      {ad.startsAt || ad.endsAt
                        ? `${formatDate(ad.startsAt) || "—"} → ${formatDate(ad.endsAt) || "—"}`
                        : "sem prazo"}
                    </td>
                    <td>
                      <span className={`ntv-badge ${ad.active ? "ntv-badge--success" : "ntv-badge--mute"}`}>
                        {ad.active ? "No ar" : "Pausada"}
                      </span>
                    </td>
                    <td>{ad.impressions.toLocaleString("pt-BR")}</td>
                    <td>{ad.clicks.toLocaleString("pt-BR")}</td>
                    <td>{ctr(ad)}</td>
                    <td>
                      <div className="rowactions">
                        <button className="linkbtn" onClick={() => setEditing(ad.id)}>
                          Editar
                        </button>
                        <button
                          className="linkbtn"
                          onClick={async () => {
                            if (!confirm(`Excluir "${ad.title}"?`)) return;
                            await deleteAd({ variables: { id: ad.id } });
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
          {!ads.length && !loading ? <Empty>Nenhuma campanha cadastrada.</Empty> : null}
        </div>

        <form className="card" onSubmit={submit}>
          <h2 className="card__title">{editing ? "Editar campanha" : "Nova campanha"}</h2>

          <Field label="Posição">
            <select
              className="ntv-select"
              value={form.placement}
              onChange={(e) => set("placement", e.target.value)}
            >
              {PLACEMENTS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label} — {p.spec}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Peça">
            <ImageDrop value={form.imageUrl} onChange={(url) => set("imageUrl", url)} />
          </Field>

          <Field label="Título" hint="Usado como texto alternativo e quando não há imagem.">
            <input
              className="ntv-input"
              required
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </Field>

          <Field label="Anunciante">
            <input
              className="ntv-input"
              value={form.advertiser}
              onChange={(e) => set("advertiser", e.target.value)}
            />
          </Field>

          <Field label="Link de destino">
            <input
              className="ntv-input"
              type="url"
              required
              value={form.targetUrl}
              onChange={(e) => set("targetUrl", e.target.value)}
            />
          </Field>

          <Field label="Período" hint="Vazio = sem data limite.">
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="ntv-input"
                type="date"
                value={form.startsAt}
                onChange={(e) => set("startsAt", e.target.value)}
              />
              <input
                className="ntv-input"
                type="date"
                value={form.endsAt}
                onChange={(e) => set("endsAt", e.target.value)}
              />
            </div>
          </Field>

          <Field label="Peso" hint="Maior peso aparece primeiro quando há várias na mesma posição.">
            <input
              className="ntv-input"
              type="number"
              min={1}
              value={form.weight}
              onChange={(e) => set("weight", e.target.value)}
            />
          </Field>

          <Toggle label="No ar" checked={form.active} onChange={(v) => set("active", v)} />

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="ntv-btn" style={{ flex: 1 }}>
              {editing ? "Salvar" : "Criar campanha"}
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
