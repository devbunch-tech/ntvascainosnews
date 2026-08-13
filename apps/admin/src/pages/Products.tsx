import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { formatPrice } from "@ntv/shared";
import { CREATE_PRODUCT, DELETE_PRODUCT, PRODUCTS, UPDATE_PRODUCT } from "../lib/queries";
import { Empty, Field, ImageDrop, Toggle } from "../components/ui";

interface ProductRow {
  id: string;
  title: string;
  price: number;
  imageUrl?: string | null;
  externalUrl: string;
  marketplace: string;
  category?: string | null;
  visible: boolean;
  soldOut: boolean;
  highlighted: boolean;
  clicks: number;
}

const MARKETPLACES = ["Shopee", "Mercado Livre", "Amazon", "Magalu", "Outro"];

const EMPTY = {
  title: "",
  price: "",
  imageUrl: "",
  externalUrl: "",
  marketplace: "Shopee",
  category: "",
  visible: true,
  soldOut: false,
  highlighted: false,
};

export function Products() {
  const { data, loading, refetch } = useQuery<{ products: { total: number; items: ProductRow[] } }>(
    PRODUCTS,
    { variables: { filter: { includeHidden: true }, limit: 60 } },
  );
  const [createProduct] = useMutation(CREATE_PRODUCT);
  const [updateProduct] = useMutation(UPDATE_PRODUCT);
  const [deleteProduct] = useMutation(DELETE_PRODUCT);

  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    const product = data?.products.items.find((p) => p.id === editing);
    if (product) {
      setForm({
        title: product.title,
        price: String(product.price),
        imageUrl: product.imageUrl ?? "",
        externalUrl: product.externalUrl,
        marketplace: product.marketplace,
        category: product.category ?? "",
        visible: product.visible,
        soldOut: product.soldOut,
        highlighted: product.highlighted,
      });
    }
  }, [editing, data]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const input = {
      title: form.title,
      price: Number(form.price),
      imageUrl: form.imageUrl || null,
      externalUrl: form.externalUrl,
      marketplace: form.marketplace,
      category: form.category || null,
      visible: form.visible,
      soldOut: form.soldOut,
      highlighted: form.highlighted,
    };

    if (editing) await updateProduct({ variables: { id: editing, input } });
    else await createProduct({ variables: { input } });

    setMessage(editing ? "Produto atualizado." : "Produto cadastrado.");
    setEditing(null);
    setForm({ ...EMPTY });
    await refetch();
  }

  return (
    <>
      <div className="page__head">
        <h1 className="page__title">Produtos</h1>
        <span className="ntv-meta">{data?.products.total ?? 0} cadastrados</span>
      </div>

      {message ? <p className="alert alert--ok">{message}</p> : null}

      <div className="editor">
        <div>
          {loading && !data ? <p className="ntv-meta">Carregando…</p> : null}
          <div className="prodgrid">
            {data?.products.items.map((product) => (
              <article key={product.id} className="prodcard">
                {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span className="ph" />}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span className="prodcard__title">{product.title}</span>
                  <p style={{ margin: "4px 0", fontWeight: 800, color: "var(--ntv-ink)" }}>
                    {formatPrice(product.price)}
                  </p>
                  <a
                    className="prodcard__link"
                    href={product.externalUrl}
                    target="_blank"
                    rel="noopener sponsored"
                  >
                    {product.externalUrl}
                  </a>
                  <div style={{ display: "flex", gap: 4, margin: "8px 0" }}>
                    <span
                      className={`ntv-badge ${product.visible ? "ntv-badge--success" : "ntv-badge--mute"}`}
                    >
                      {product.visible ? "Visível" : "Oculto"}
                    </span>
                    {product.soldOut ? (
                      <span className="ntv-badge ntv-badge--warning">Esgotado</span>
                    ) : null}
                  </div>
                  <div className="rowactions">
                    <button className="linkbtn" onClick={() => setEditing(product.id)}>
                      Editar
                    </button>
                    <button
                      className="linkbtn"
                      onClick={async () => {
                        if (!confirm(`Excluir "${product.title}"?`)) return;
                        await deleteProduct({ variables: { id: product.id } });
                        await refetch();
                      }}
                    >
                      Excluir
                    </button>
                    <span className="ntv-meta">{product.clicks} cliques</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!loading && !data?.products.items.length ? <Empty>Nenhum produto ainda.</Empty> : null}
        </div>

        <form className="card" onSubmit={submit}>
          <h2 className="card__title">{editing ? "Editar produto" : "Novo produto"}</h2>

          <Field label="Foto" hint="Ideal 800×800 px.">
            <ImageDrop value={form.imageUrl} onChange={(url) => set("imageUrl", url)} />
          </Field>

          <Field label="Título">
            <input
              className="ntv-input"
              required
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </Field>

          <Field label="Preço">
            <input
              className="ntv-input"
              type="number"
              step="0.01"
              required
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
            />
          </Field>

          <Field label="Link do marketplace">
            <input
              className="ntv-input"
              type="url"
              required
              value={form.externalUrl}
              onChange={(e) => set("externalUrl", e.target.value)}
              placeholder="https://shopee.com.br/..."
            />
          </Field>

          <Field label="Marketplace">
            <select
              className="ntv-select"
              value={form.marketplace}
              onChange={(e) => set("marketplace", e.target.value)}
            >
              {MARKETPLACES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>

          <Field label="Categoria">
            <input
              className="ntv-input"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              placeholder="Camisas, Acessórios…"
            />
          </Field>

          <Toggle
            label="Visível na Loja NTV"
            checked={form.visible}
            onChange={(v) => set("visible", v)}
          />
          <Toggle label="Esgotado" checked={form.soldOut} onChange={(v) => set("soldOut", v)} />
          <Toggle
            label="Destaque"
            checked={form.highlighted}
            onChange={(v) => set("highlighted", v)}
          />

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
