import type { LoaderFunctionArgs } from "react-router";
import { gql } from "~/lib/graphql.server";
import { getEnv } from "~/lib/env.server";
import { escapeXml } from "~/lib/seo";
import { SITEMAP_QUERY } from "~/lib/queries";

interface Data {
  sitemapPosts: {
    slug: string;
    title: string;
    publishedAt?: string | null;
    keywords: string[];
  }[];
}

/** O Google News só considera as últimas 48 h neste sitemap. */
const WINDOW_MS = 48 * 60 * 60 * 1000;

export async function loader({ request }: LoaderFunctionArgs) {
  const origin = getEnv().PUBLIC_SITE_URL || new URL(request.url).origin;
  const { sitemapPosts } = await gql<Data>(SITEMAP_QUERY, { request, variables: { limit: 500 } });

  const recent = sitemapPosts.filter(
    (post) => post.publishedAt && Date.now() - new Date(post.publishedAt).getTime() < WINDOW_MS,
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${recent
  .map(
    (post) => `  <url>
    <loc>${origin}/noticia/${escapeXml(post.slug)}</loc>
    <news:news>
      <news:publication>
        <news:name>NTV News</news:name>
        <news:language>pt</news:language>
      </news:publication>
      <news:publication_date>${new Date(post.publishedAt!).toISOString()}</news:publication_date>
      <news:title>${escapeXml(post.title)}</news:title>
      ${post.keywords.length ? `<news:keywords>${escapeXml(post.keywords.join(", "))}</news:keywords>` : ""}
    </news:news>
  </url>`,
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=600",
    },
  });
}
