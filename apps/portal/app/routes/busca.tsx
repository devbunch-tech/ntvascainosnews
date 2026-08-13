import { Form, useLoaderData, type LoaderFunctionArgs, type MetaFunction } from "react-router";
import { NewsListPage, PAGE_SIZE } from "~/components/NewsListPage";
import type { PostCardData } from "~/components/PostCards";
import type { SessionUser } from "~/components/Header";
import { pageMeta } from "~/lib/seo";
import { gql } from "~/lib/graphql.server";
import { SEARCH_QUERY } from "~/lib/queries";

interface Data {
  searchPosts: { total: number; hasMore: boolean; fallback: boolean; items: PostCardData[] };
  me: SessionUser | null;
}

export const meta: MetaFunction = ({ matches }) =>
  pageMeta({
    matches: matches as never,
    path: "/busca",
    title: "Busca",
    description:
      "Busque notícias do Vasco no NTV News.",
    noindex: true,
  });

export async function loader({ request }: LoaderFunctionArgs) {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim();
  const page = Math.max(1, Number(params.get("pagina") ?? 1));

  if (!q) {
    return { q, page, searchPosts: { total: 0, hasMore: false, fallback: false, items: [] }, me: null };
  }

  const data = await gql<Data>(SEARCH_QUERY, {
    request,
    variables: { q, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
  });
  return { ...data, q, page };
}

export default function BuscaRoute() {
  const { searchPosts, me, q, page } = useLoaderData<typeof loader>();

  return (
    <NewsListPage
      title={q ? `Busca: ${q}` : "Busca"}
      items={searchPosts.items}
      total={searchPosts.total}
      page={page}
      pageCount={Math.ceil(searchPosts.total / PAGE_SIZE)}
      user={me}
      empty={
        q ? (
          <p className="ntv-meta listpage__empty">
            Nada encontrado para <strong>{q}</strong>. Tente outro termo ou o nome do jogador.
          </p>
        ) : (
          <p className="ntv-meta listpage__empty">Digite algo para buscar nas notícias.</p>
        )
      }
    >
      <Form method="get" className="searchbar" role="search">
        <input
          className="ntv-input"
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar notícias, jogadores, competições…"
          aria-label="Buscar"
        />
        <button className="ntv-btn">Buscar</button>
      </Form>

      {q && searchPosts.fallback && searchPosts.total > 0 ? (
        <p className="ntv-meta listpage__note">
          Sem resultado exato — mostrando notícias que mencionam o termo.
        </p>
      ) : null}
    </NewsListPage>
  );
}
