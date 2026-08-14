import { useLoaderData, type LoaderFunctionArgs, type MetaFunction } from "react-router";
import { NewsListPage, PAGE_SIZE } from "~/components/NewsListPage";
import { pageMeta } from "~/lib/seo";
import { loadArchive } from "~/lib/archive.server";

/**
 * Arquivo de categoria. É a página que faz uma busca por "mercado da bola
 * vasco" cair no portal em vez de cair só numa matéria solta — e o único lugar
 * onde o assunto existe como entidade própria para o Google.
 */
export const meta: MetaFunction<typeof loader> = ({ data: loaded, matches }) => {
  if (!loaded) return [{ title: "Categoria não encontrada — NTV News" }];
  const suffix = loaded.page > 1 ? ` — página ${loaded.page}` : "";

  return pageMeta({
    matches: matches as never,
    path: loaded.path,
    title: `${loaded.name}${suffix}`,
    description: `Todas as notícias do Vasco da Gama em ${loaded.name}, com atualização ao longo do dia no NTV News.`,
    keywords: [loaded.name, `${loaded.name} Vasco`, "Vasco da Gama", "notícias do Vasco"],
  });
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  return loadArchive({ request, slug: params.slug, kind: "categoria" });
}

export function headers({ loaderHeaders }: { loaderHeaders: Headers }) {
  return loaderHeaders;
}

export default function CategoriaRoute() {
  const { posts, me, page, name } = useLoaderData<typeof loader>();

  return (
    <NewsListPage
      title={name}
      subtitle={`Cobertura do NTV News em ${name}.`}
      items={posts.items}
      total={posts.total}
      page={page}
      pageCount={Math.ceil(posts.total / PAGE_SIZE)}
      user={me}
    />
  );
}
