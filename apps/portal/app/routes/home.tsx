import { useEffect, useState } from "react";
import { data, useFetcher, useLoaderData, type LoaderFunctionArgs, type MetaFunction } from "react-router";
import { Header, Ticker, type SessionUser } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { useSite } from "~/lib/site";
import { HeroCard, NewsRow, TeamCard, type PostCardData } from "~/components/PostCards";
import { Sidebar, type SidebarData } from "~/components/Sidebar";
import { pageMeta } from "~/lib/seo";
import { gql } from "~/lib/graphql.server";
import { CACHE_HOME, pageCacheHeaders } from "~/lib/cache.server";
import { HOME_QUERY, LATEST_PAGE_QUERY } from "~/lib/queries";

interface HomeData {
  home: SidebarData & {
    ticker?: string | null;
    featured: PostCardData[];
    teamPosts: PostCardData[];
    latest: { total: number; hasMore: boolean; items: PostCardData[] };
  };
  me: SessionUser | null;
}


export const meta: MetaFunction = ({ matches }) =>
  pageMeta({
    matches: matches as never,
    path: "/",
    title: "NTV News — Notícias do Vasco da Gama",
    description:
      "O portal do torcedor vascaíno: notícias, mercado da bola, tabela, chaveamento das copas e a Loja NTV.",
  });

export async function loader({ request }: LoaderFunctionArgs) {
  const payload = await gql<HomeData>(HOME_QUERY, { variables: { latestLimit: 12 }, request });
  return data(payload, { headers: pageCacheHeaders(request, CACHE_HOME) });
}

/** Sem isto o React Router descarta os headers do loader e a página volta a
 *  ser `uncacheable` na borda. */
export function headers({ loaderHeaders }: { loaderHeaders: Headers }) {
  return loaderHeaders;
}

const PAGE_SIZE = 12;

export default function HomeRoute() {
  const { home, me } = useLoaderData<typeof loader>();
  const site = useSite();
  const [extra, setExtra] = useState<PostCardData[]>([]);
  const fetcher = useFetcher<{ posts: { items: PostCardData[]; hasMore: boolean } }>();

  useEffect(() => {
    const incoming = fetcher.data?.posts?.items;
    if (incoming?.length) setExtra((prev) => [...prev, ...incoming]);
  }, [fetcher.data]);

  const latest = [...home.latest.items, ...extra];
  const hasMore = fetcher.data ? fetcher.data.posts.hasMore : home.latest.hasMore;
  const [lead, ...rest] = home.featured;

  return (
    <div className="shell">
      <Header user={me} />
      <Ticker headline={home.ticker} />

      <main className="main">
        <div className="wrap columns">
          <div>
            {lead ? (
              <section className="hero">
                <HeroCard post={lead} lead />
                {rest.slice(0, 2).map((post) => (
                  <HeroCard key={post.id} post={post} />
                ))}
              </section>
            ) : null}

            {home.teamPosts.length ? (
              <section className="section">
                <div className="section__head">
                  <span className="section__rule" />
                  <h2 className="section__title">Leo Lacerda &amp; equipe</h2>
                </div>
                <div className="teamgrid">
                  {home.teamPosts.map((post) => (
                    <TeamCard key={post.id} post={post} />
                  ))}
                </div>
              </section>
            ) : null}

            <section className="section">
              <div className="section__head">
                <span className="section__rule" />
                <h2 className="section__title">Últimas notícias</h2>
                <span className="section__more">{home.latest.total} publicações</span>
              </div>
              <div className="newslist">
                {latest.map((post) => (
                  <NewsRow key={post.id} post={post} />
                ))}
              </div>
              {hasMore ? (
                <button
                  type="button"
                  className="ntv-btn ntv-btn--outline loadmore"
                  disabled={fetcher.state !== "idle"}
                  onClick={() =>
                    fetcher.load(`/api/ultimas?offset=${latest.length}&limit=${PAGE_SIZE}`)
                  }
                >
                  {fetcher.state === "idle" ? "Ver mais notícias" : "Carregando…"}
                </button>
              ) : null}
            </section>
          </div>

          <Sidebar
            data={home}
            youtubeChannelUrl={site.social.find((s) => s.network === "youtube")?.url}
          />
        </div>
      </main>

      <Footer siteName={site.siteName} social={site.social} ads={site.footerAds} />
    </div>
  );
}
