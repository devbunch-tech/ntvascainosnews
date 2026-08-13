import type { LoaderFunctionArgs } from "react-router";
import { gql } from "~/lib/graphql.server";
import { getEnv } from "~/lib/env.server";
import { escapeXml } from "~/lib/seo";
import { SITEMAP_QUERY } from "~/lib/queries";

interface Data {
  sitemapPosts: {
    slug: string;
    title: string;
    updatedAt: string;
    publishedAt?: string | null;
    coverImage?: string | null;
  }[];
}

/** Páginas fixas, com a prioridade que o portal dá a cada uma. */
const STATIC_PAGES = [
  { path: "/", changefreq: "hourly", priority: "1.0" },
  { path: "/noticias", changefreq: "hourly", priority: "0.9" },
  { path: "/ntv-exclusivo", changefreq: "daily", priority: "0.8" },
  { path: "/tabela", changefreq: "daily", priority: "0.7" },
  { path: "/mercado", changefreq: "daily", priority: "0.7" },
  { path: "/loja", changefreq: "weekly", priority: "0.6" },
  { path: "/anuncie", changefreq: "monthly", priority: "0.3" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const origin = getEnv().PUBLIC_SITE_URL || new URL(request.url).origin;
  const { sitemapPosts } = await gql<Data>(SITEMAP_QUERY, { request, variables: { limit: 5000 } });

  const urls = [
    ...STATIC_PAGES.map(
      (page) => `  <url>
    <loc>${origin}${page.path}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`,
    ),
    ...sitemapPosts.map((post) => {
      // A tag de imagem faz a foto da matéria entrar na busca por imagens.
      const image = post.coverImage
        ? `
    <image:image>
      <image:loc>${escapeXml(post.coverImage)}</image:loc>
      <image:title>${escapeXml(post.title)}</image:title>
    </image:image>`
        : "";

      return `  <url>
    <loc>${origin}/noticia/${escapeXml(post.slug)}</loc>
    <lastmod>${new Date(post.updatedAt).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${image}
  </url>`;
    }),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=1800",
    },
  });
}
