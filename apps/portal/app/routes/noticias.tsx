import { data, useLoaderData, type LoaderFunctionArgs, type MetaFunction } from "react-router";
import { NewsListPage, PAGE_SIZE } from "~/components/NewsListPage";
import type { PostCardData } from "~/components/PostCards";
import type { SessionUser } from "~/components/Header";
import { pageMeta } from "~/lib/seo";
import { CACHE_LIST, pageCacheHeaders } from "~/lib/cache.server";
import { gql } from "~/lib/graphql.server";
import { NEWS_LIST_QUERY } from "~/lib/queries";

interface Data {
  posts: { total: number; hasMore: boolean; items: PostCardData[] };
  me: SessionUser | null;
}


export const meta: MetaFunction = ({ matches }) =>
  pageMeta({
    matches: matches as never,
    path: "/noticias",
    title: "Notícias do Vasco",
    description:
      "Todas as notícias do Vasco da Gama publicadas no NTV News, atualizadas o dia todo.",
  });

export async function loader({ request }: LoaderFunctionArgs) {
  const page = Math.max(1, Number(new URL(request.url).searchParams.get("pagina") ?? 1));
  const payload = await gql<Data>(NEWS_LIST_QUERY, {
    request,
    variables: { filter: {}, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
  });
  return data({ ...payload, page }, { headers: pageCacheHeaders(request, CACHE_LIST) });
}

export function headers({ loaderHeaders }: { loaderHeaders: Headers }) {
  return loaderHeaders;
}

export default function NoticiasRoute() {
  const { posts, me, page } = useLoaderData<typeof loader>();
  return (
    <NewsListPage
      title="Notícias"
      items={posts.items}
      total={posts.total}
      page={page}
      pageCount={Math.ceil(posts.total / PAGE_SIZE)}
      user={me}
    />
  );
}
