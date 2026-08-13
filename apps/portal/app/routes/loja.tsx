import { useEffect, useState } from "react";
import {
  Form,
  useFetcher,
  useLoaderData,
  useSearchParams,
  useSubmit,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { formatPrice } from "@ntv/shared";
import { Header, type SessionUser } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { useSite } from "~/lib/site";
import { pageMeta } from "~/lib/seo";
import { gql } from "~/lib/graphql.server";
import { SHOP_QUERY } from "~/lib/queries";

interface ShopProduct {
  id: string;
  title: string;
  price: number;
  imageUrl?: string | null;
  externalUrl: string;
  marketplace: string;
  category?: string | null;
  soldOut: boolean;
  highlighted: boolean;
}

interface ShopData {
  products: {
    total: number;
    hasMore: boolean;
    priceRange: { min: number; max: number };
    categories: { value: string; count: number }[];
    marketplaces: { value: string; count: number }[];
    items: ShopProduct[];
  };
  me: SessionUser | null;
}

const PAGE_SIZE = 12;


export const meta: MetaFunction = ({ matches }) =>
  pageMeta({
    matches: matches as never,
    path: "/loja",
    title: "Loja NTV",
    description:
      "Camisas, acessórios e produtos do Vasco com link direto para o marketplace.",
  });

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const p = url.searchParams;
  const num = (key: string) => (p.get(key) ? Number(p.get(key)) : undefined);

  return gql<ShopData>(SHOP_QUERY, {
    request,
    variables: {
      filter: {
        category: p.get("categoria") || undefined,
        marketplace: p.get("marketplace") || undefined,
        minPrice: num("min"),
        maxPrice: num("max"),
        search: p.get("q") || undefined,
      },
      sort: p.get("ordenar") || "recent",
      limit: PAGE_SIZE,
      offset: Number(p.get("offset") ?? 0),
    },
  });
}

/** Clique em "Comprar" → conta a métrica e segue para o marketplace em nova aba. */
function BuyButton({ product }: { product: ShopProduct }) {
  const fetcher = useFetcher();
  if (product.soldOut) {
    return (
      <button className="ntv-btn product__buy" disabled>
        Indisponível
      </button>
    );
  }
  return (
    <a
      className="ntv-btn product__buy"
      href={product.externalUrl}
      target="_blank"
      rel="noopener sponsored"
      onClick={() =>
        fetcher.submit({ id: product.id }, { method: "post", action: "/api/clique-loja" })
      }
    >
      Comprar ↗
    </a>
  );
}

function ProductCard({ product }: { product: ShopProduct }) {
  return (
    <article className={`product ${product.soldOut ? "product--out" : ""}`}>
      {product.imageUrl ? (
        <img className="product__media" src={product.imageUrl} alt="" />
      ) : (
        <div className="product__media" aria-hidden />
      )}
      <div className="product__body">
        <div style={{ display: "flex", gap: 6 }}>
          {product.highlighted ? <span className="ntv-badge">Destaque</span> : null}
          {product.soldOut ? <span className="ntv-badge ntv-badge--mute">Esgotado</span> : null}
        </div>
        <h3 className="product__title">{product.title}</h3>
        <span className="product__price">{formatPrice(product.price)}</span>
        <span className="product__market">{product.marketplace}</span>
        <BuyButton product={product} />
      </div>
    </article>
  );
}

export default function LojaRoute() {
  const { products, me } = useLoaderData<typeof loader>();
  const site = useSite();
  const [params, setParams] = useSearchParams();
  const submit = useSubmit();
  const fetcher = useFetcher<ShopData>();
  const [extra, setExtra] = useState<ShopProduct[]>([]);
  const [drawer, setDrawer] = useState(false);

  // Trocar de filtro reinicia a lista acumulada.
  useEffect(() => setExtra([]), [params.toString()]);
  useEffect(() => {
    const incoming = fetcher.data?.products?.items;
    if (incoming?.length) setExtra((prev) => [...prev, ...incoming]);
  }, [fetcher.data]);

  const items = [...products.items, ...extra];
  const hasMore = fetcher.data ? fetcher.data.products.hasMore : products.hasMore;

  const setFilter = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (!value || next.get(key) === value) next.delete(key);
    else next.set(key, value);
    next.delete("offset");
    setParams(next, { preventScrollReset: true });
  };

  const loadMore = () => {
    const next = new URLSearchParams(params);
    next.set("offset", String(items.length));
    fetcher.load(`/loja?${next.toString()}`);
  };

  const filters = (
    <>
      <section className="widget">
        <h2 className="widget__title">Categoria</h2>
        {products.categories.map((c) => (
          <label key={c.value} className="checkline" style={{ margin: "6px 0" }}>
            <input
              type="checkbox"
              checked={params.get("categoria") === c.value}
              onChange={() => setFilter("categoria", c.value)}
            />
            <span style={{ flex: 1 }}>{c.value}</span>
            <span className="ntv-meta">{c.count}</span>
          </label>
        ))}
      </section>

      <section className="widget">
        <h2 className="widget__title">Preço</h2>
        <Form
          onChange={(e) => submit(e.currentTarget, { preventScrollReset: true })}
          style={{ display: "flex", gap: 8 }}
        >
          {[...params.entries()]
            .filter(([k]) => !["min", "max", "offset"].includes(k))
            .map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
          <input
            className="ntv-input"
            type="number"
            name="min"
            placeholder={String(Math.floor(products.priceRange.min))}
            defaultValue={params.get("min") ?? ""}
            aria-label="Preço mínimo"
          />
          <input
            className="ntv-input"
            type="number"
            name="max"
            placeholder={String(Math.ceil(products.priceRange.max))}
            defaultValue={params.get("max") ?? ""}
            aria-label="Preço máximo"
          />
        </Form>
      </section>

      <section className="widget">
        <h2 className="widget__title">Marketplace</h2>
        {products.marketplaces.map((m) => (
          <label key={m.value} className="checkline" style={{ margin: "6px 0" }}>
            <input
              type="checkbox"
              checked={params.get("marketplace") === m.value}
              onChange={() => setFilter("marketplace", m.value)}
            />
            <span style={{ flex: 1 }}>{m.value}</span>
            <span className="ntv-meta">{m.count}</span>
          </label>
        ))}
      </section>

      <button
        type="button"
        className="ntv-btn ntv-btn--outline"
        style={{ width: "100%" }}
        onClick={() => setParams(new URLSearchParams(), { preventScrollReset: true })}
      >
        Limpar filtros
      </button>
    </>
  );

  return (
    <div className="shell">
      <Header user={me} />
      <main className="main">
        <div className="wrap">
          <div className="section__head">
            <span className="section__rule" />
            <h1 className="section__title">Loja NTV</h1>
          </div>

          <div className="shop">
            <div className="filters sidebar">{filters}</div>

            <div>
              <div className="chips">
                <button
                  type="button"
                  className="chip"
                  aria-pressed={!params.get("categoria")}
                  onClick={() => setFilter("categoria", null)}
                >
                  Tudo
                </button>
                {products.categories.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className="chip"
                    aria-pressed={params.get("categoria") === c.value}
                    onClick={() => setFilter("categoria", c.value)}
                  >
                    {c.value}
                  </button>
                ))}
                <button type="button" className="chip" onClick={() => setDrawer(true)}>
                  ☰ Filtrar
                </button>
              </div>

              <div className="shop__toolbar">
                <span>{products.total} produtos</span>
                <select
                  className="ntv-select"
                  aria-label="Ordenar"
                  value={params.get("ordenar") ?? "recent"}
                  onChange={(e) => setFilter("ordenar", e.target.value)}
                >
                  <option value="recent">Mais recentes</option>
                  <option value="price_asc">Menor preço</option>
                  <option value="price_desc">Maior preço</option>
                  <option value="title">A–Z</option>
                </select>
              </div>

              <div className="productgrid">
                {items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {hasMore ? (
                <button
                  type="button"
                  className="ntv-btn ntv-btn--outline loadmore"
                  disabled={fetcher.state !== "idle"}
                  onClick={loadMore}
                >
                  {fetcher.state === "idle" ? "Carregar mais produtos" : "Carregando…"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </main>

      {drawer ? (
        <div className="backdrop" onClick={() => setDrawer(false)}>
          <div
            className="modal"
            style={{ maxHeight: "80vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal__head">
              Filtrar
              <button className="modal__close" onClick={() => setDrawer(false)} aria-label="Fechar">
                ✕
              </button>
            </div>
            <div className="modal__body sidebar">{filters}</div>
          </div>
        </div>
      ) : null}

      <Footer siteName={site.siteName} social={site.social} ads={site.footerAds} />
    </div>
  );
}
