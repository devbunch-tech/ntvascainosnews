/** Carregamento comum das páginas de arquivo (/categoria/:slug e /tag/:slug). */
import { data } from "react-router";
import type { PostCardData } from "~/components/PostCards";
import type { SessionUser } from "~/components/Header";
import { PAGE_SIZE } from "~/components/NewsListPage";
import { gql } from "./graphql.server";
import { CACHE_LIST, pageCacheHeaders } from "./cache.server";
import { NEWS_LIST_QUERY, TAXONOMY_QUERY } from "./queries";
import { findBySlug, type Facet } from "./taxonomy";

interface TaxonomyData {
  categories: Facet[];
  postTags: Facet[];
}

interface ListData {
  posts: { total: number; hasMore: boolean; items: PostCardData[] };
  me: SessionUser | null;
}

/**
 * Resolve o slug da URL para o rótulo real e devolve a página de matérias.
 *
 * São duas idas à API porque o filtro depende do rótulo, que só se descobre
 * depois da faceta. Ambas são cacheadas na borda, e a de facetas é uma
 * agregação pequena — na prática o custo extra só aparece no cache frio.
 */
export async function loadArchive({
  request,
  slug,
  kind,
}: {
  request: Request;
  slug: string | undefined;
  kind: "categoria" | "tag";
}) {
  const facets = await gql<TaxonomyData>(TAXONOMY_QUERY, { request });
  const pool = kind === "categoria" ? facets.categories : facets.postTags;
  const match = findBySlug(pool ?? [], slug ?? "", kind);

  // Slug inexistente vira 404 de verdade: um arquivo vazio respondendo 200
  // entra no índice como página rasa e derruba a avaliação do site inteiro.
  if (!match) {
    throw data(kind === "categoria" ? "Categoria não encontrada." : "Tag não encontrada.", {
      status: 404,
    });
  }

  const page = Math.max(1, Number(new URL(request.url).searchParams.get("pagina") ?? 1));
  const filter = kind === "categoria" ? { category: match.value } : { tag: match.value };
  const payload = await gql<ListData>(NEWS_LIST_QUERY, {
    request,
    variables: { filter, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
  });

  return data(
    {
      ...payload,
      page,
      name: match.value,
      slug: match.slug,
      // Canonical aponta para a própria página paginada: desde que o Google
      // aposentou rel=prev/next, apontar a página 2 para a 1 esconde o que
      // está na 2.
      path: page > 1 ? `${match.path}?pagina=${page}` : match.path,
    },
    { headers: pageCacheHeaders(request, CACHE_LIST) },
  );
}
