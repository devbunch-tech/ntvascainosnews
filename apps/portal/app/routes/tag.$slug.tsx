import { useLoaderData, type LoaderFunctionArgs, type MetaFunction } from "react-router";
import { NewsListPage, PAGE_SIZE } from "~/components/NewsListPage";
import { pageMeta } from "~/lib/seo";
import { loadArchive } from "~/lib/archive.server";

/**
 * Arquivo de tag. Cauda longa: nome de jogador, competição, adversário. São as
 * buscas de menor volume e maior intenção, e hoje o portal não tem nenhuma
 * página que as concentre.
 */
export const meta: MetaFunction<typeof loader> = ({ data: loaded, matches }) => {
  if (!loaded) return [{ title: "Tag não encontrada — NTV News" }];
  const suffix = loaded.page > 1 ? ` — página ${loaded.page}` : "";

  return pageMeta({
    matches: matches as never,
    path: loaded.path,
    title: `${loaded.name}${suffix}`,
    description: `Notícias do Vasco da Gama sobre ${loaded.name} — tudo o que o NTV News publicou sobre o assunto.`,
    keywords: [loaded.name, `${loaded.name} Vasco`, "Vasco da Gama", "notícias do Vasco"],
  });
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  return loadArchive({ request, slug: params.slug, kind: "tag" });
}

export function headers({ loaderHeaders }: { loaderHeaders: Headers }) {
  return loaderHeaders;
}

export default function TagRoute() {
  const { posts, me, page, name } = useLoaderData<typeof loader>();

  return (
    <NewsListPage
      title={name}
      subtitle={`Tudo sobre ${name} no NTV News.`}
      items={posts.items}
      total={posts.total}
      page={page}
      pageCount={Math.ceil(posts.total / PAGE_SIZE)}
      user={me}
    />
  );
}
