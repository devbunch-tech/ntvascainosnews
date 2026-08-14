/**
 * Categorias e tags como páginas de arquivo.
 *
 * O banco guarda o rótulo de exibição ("Mercado da Bola"), não um slug. A URL
 * precisa do slug. Como não há coleção de taxonomia, a resolução é feita ao
 * contrário: pega a lista de valores publicados e procura aquele cujo slug bate
 * com o da URL. É uma agregação barata e cacheada na borda, e evita criar uma
 * segunda fonte de verdade que sairia do ar em relação aos posts.
 */
import { slugify, categoryPath, tagPath } from "@ntv/shared";

export { categoryPath, tagPath };

export interface Facet {
  value: string;
  count: number;
}

export interface Taxonomy extends Facet {
  slug: string;
  path: string;
}

const withSlug = (facet: Facet, prefix: "categoria" | "tag"): Taxonomy => ({
  ...facet,
  slug: slugify(facet.value),
  path: prefix === "categoria" ? categoryPath(facet.value) : tagPath(facet.value),
});

export const toTaxonomies = (facets: Facet[], prefix: "categoria" | "tag"): Taxonomy[] =>
  facets.filter((facet) => facet.value?.trim() && slugify(facet.value)).map((f) => withSlug(f, prefix));

/**
 * Encontra o rótulo real a partir do slug da URL. Devolve `null` quando não
 * existe — a rota responde 404 em vez de renderizar um arquivo vazio, que o
 * Google indexaria como página sem conteúdo.
 */
export function findBySlug(facets: Facet[], slug: string, prefix: "categoria" | "tag") {
  const target = slug.toLowerCase();
  return toTaxonomies(facets, prefix).find((item) => item.slug === target) ?? null;
}
