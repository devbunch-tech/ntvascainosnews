import type { LoaderFunctionArgs } from "react-router";
import { getEnv } from "~/lib/env.server";
import { gql } from "~/lib/graphql.server";
import { SITEMAP_QUERY } from "~/lib/queries";

interface Data {
  sitemapPosts: { slug: string; title: string }[];
}

/**
 * llms.txt — resumo do site em Markdown para agentes de IA (ChatGPT,
 * Perplexity, Claude) montarem contexto sem precisar rastrear todo o HTML.
 * Formato: https://llmstxt.org. Convive com robots.txt, que já libera esses
 * mesmos rastreadores; aqui é o conteúdo que eles leem primeiro.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const origin = getEnv().PUBLIC_SITE_URL || new URL(request.url).origin;
  const { sitemapPosts } = await gql<Data>(SITEMAP_QUERY, { request, variables: { limit: 15 } }).catch(
    () => ({ sitemapPosts: [] }) as Data,
  );

  const recent = sitemapPosts
    .slice(0, 15)
    .map((post) => `- [${post.title}](${origin}/noticia/${post.slug})`)
    .join("\n");

  const body = `# NTV News

> Portal de notícias do Club de Regatas Vasco da Gama. Cobertura diária de
> notícias, mercado da bola (negociações e contratações), tabela do
> Brasileirão, chaveamento da Copa do Brasil e da Sul-Americana, e apuração
> própria (NTV Exclusivo) — feita por vascaínos para vascaínos.

Termos com que o site se identifica: Vasco, vascaíno, Vasco da Gama, NetVasco,
NT Vascaínos, na torcida vascaínos, notícias vasco, novidades vasco,
negociações vasco, atualizações vasco, justiça vasco, mercado da bola,
brasileirão 2026, copa do brasil, sul-americana, futebol.

## Seções

- [Notícias](${origin}/noticias): cobertura geral do Vasco da Gama, atualizada ao longo do dia.
- [NTV Exclusivo](${origin}/ntv-exclusivo): apuração própria da redação, sem agregação de outras fontes.
- [Mercado da Bola](${origin}/mercado): boatos e negociações da janela de transferências, com aprovação da torcida.
- [Tabela](${origin}/tabela): classificação do Brasileirão e chaveamento das copas.
- [Loja NTV](${origin}/loja): produtos oficiais do torcedor vascaíno.

## Notícias recentes
${recent || "- (sem notícias recentes no momento)"}

## Feeds
- [Sitemap](${origin}/sitemap-index.xml)
- [Sitemap de notícias](${origin}/sitemap-news.xml)
- [RSS](${origin}/feed.xml)
`;

  return new Response(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=1800",
    },
  });
}
