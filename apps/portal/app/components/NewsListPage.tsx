import { Link, useSearchParams } from "react-router";
import { Header, type SessionUser } from "./Header";
import { Footer } from "./Footer";
import { NewsRow, type PostCardData } from "./PostCards";
import { useSite } from "~/lib/site";
import { itemListJsonLd } from "~/lib/seo";

export const PAGE_SIZE = 25;

/** Paginação numerada com elipses — cabe no mobile sem virar uma régua. */
function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const out: (number | "…")[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) out.push("…");
    out.push(page);
    previous = page;
  }
  return out;
}

export function Paginator({ page, total }: { page: number; total: number }) {
  const [params] = useSearchParams();
  if (total <= 1) return null;

  const href = (target: number) => {
    const next = new URLSearchParams(params);
    if (target <= 1) next.delete("pagina");
    else next.set("pagina", String(target));
    const query = next.toString();
    return query ? `?${query}` : "";
  };

  return (
    <nav className="pager" aria-label="Paginação">
      <Link
        className={`pager__step ${page <= 1 ? "is-disabled" : ""}`}
        to={href(page - 1)}
        aria-disabled={page <= 1}
        preventScrollReset={false}
      >
        ‹ Anterior
      </Link>

      <span className="pager__pages">
        {pageNumbers(page, total).map((item, index) =>
          item === "…" ? (
            <span key={`gap-${index}`} className="pager__gap">
              …
            </span>
          ) : (
            <Link
              key={item}
              to={href(item)}
              className={`pager__page ${item === page ? "is-current" : ""}`}
              aria-current={item === page ? "page" : undefined}
            >
              {item}
            </Link>
          ),
        )}
      </span>

      <Link
        className={`pager__step ${page >= total ? "is-disabled" : ""}`}
        to={href(page + 1)}
        aria-disabled={page >= total}
      >
        Próxima ›
      </Link>
    </nav>
  );
}

/** Layout compartilhado por /noticias, /ntv-exclusivo e /busca. */
export function NewsListPage({
  title,
  subtitle,
  items,
  total,
  page,
  pageCount,
  user,
  children,
  empty,
}: {
  title: string;
  subtitle?: string;
  items: PostCardData[];
  total: number;
  page: number;
  pageCount: number;
  user?: SessionUser | null;
  children?: React.ReactNode;
  empty?: React.ReactNode;
}) {
  const site = useSite();

  return (
    <div className="shell">
      <Header user={user} />
      <main className="main">
        {/* Diz ao Google que a página é uma lista de matérias, com a ordem. */}
        {site.siteUrl && items.length ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                itemListJsonLd(
                  {
                    siteName: site.siteName,
                    siteUrl: site.siteUrl,
                    logoUrl: site.logoUrl || "/assets/logo.svg",
                    description: site.seo.description ?? "",
                    social: site.social.map((s) => s.url),
                  },
                  items,
                  title,
                ),
              ),
            }}
          />
        ) : null}
        <div className="wrap">
          <div className="section__head">
            <span className="section__rule" />
            <h1 className="section__title">{title}</h1>
            {total ? (
              <span className="section__more">
                {total.toLocaleString("pt-BR")} {total === 1 ? "publicação" : "publicações"}
              </span>
            ) : null}
          </div>

          {subtitle ? <p className="listpage__subtitle">{subtitle}</p> : null}
          {children}

          {items.length ? (
            <>
              <div className="newslist">
                {items.map((post) => (
                  <NewsRow key={post.id} post={post} />
                ))}
              </div>
              <Paginator page={page} total={pageCount} />
            </>
          ) : (
            (empty ?? <p className="ntv-meta listpage__empty">Nada por aqui ainda.</p>)
          )}
        </div>
      </main>
      <Footer siteName={site.siteName} social={site.social} ads={site.footerAds} />
    </div>
  );
}
