import { useLoaderData, type LoaderFunctionArgs, type MetaFunction } from "react-router";
import { NewsListPage, PAGE_SIZE } from "~/components/NewsListPage";
import type { PostCardData } from "~/components/PostCards";
import type { SessionUser } from "~/components/Header";
import { pageMeta } from "~/lib/seo";
import { gql } from "~/lib/graphql.server";
import { NEWS_LIST_QUERY } from "~/lib/queries";

/** Categoria que marca o conteúdo próprio da redação. */
const CATEGORY = "NTV Exclusivo";

interface Data {
  posts: { total: number; hasMore: boolean; items: PostCardData[] };
  me: SessionUser | null;
}


export const meta: MetaFunction = ({ matches }) =>
  pageMeta({
    matches: matches as never,
    path: "/ntv-exclusivo",
    title: "NTV Exclusivo",
    description:
      "Apuração própria da equipe do NTV News sobre o Vasco da Gama — sem agregação.",
  });

export async function loader({ request }: LoaderFunctionArgs) {
  const page = Math.max(1, Number(new URL(request.url).searchParams.get("pagina") ?? 1));
  const data = await gql<Data>(NEWS_LIST_QUERY, {
    request,
    variables: {
      filter: { category: CATEGORY },
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    },
  });
  return { ...data, page };
}

export default function ExclusivoRoute() {
  const { posts, me, page } = useLoaderData<typeof loader>();
  return (
    <NewsListPage
      title="NTV Exclusivo"
      subtitle="Apuração própria da equipe — sem agregação de outras fontes."
      items={posts.items}
      total={posts.total}
      page={page}
      pageCount={Math.ceil(posts.total / PAGE_SIZE)}
      user={me}
      empty={
        <p className="ntv-meta listpage__empty">
          Nenhuma matéria exclusiva publicada ainda. Elas aparecem aqui assim que a equipe
          publicar com a categoria "NTV Exclusivo".
        </p>
      }
    />
  );
}
