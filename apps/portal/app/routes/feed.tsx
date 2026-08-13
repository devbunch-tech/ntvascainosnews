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
    excerpt?: string | null;
    coverImage?: string | null;
    category: string;
  }[];
}

/** Feed RSS do portal — agregadores e leitores puxam daqui. */
export async function loader({ request }: LoaderFunctionArgs) {
  const origin = getEnv().PUBLIC_SITE_URL || new URL(request.url).origin;
  const { sitemapPosts } = await gql<Data>(SITEMAP_QUERY, { request, variables: { limit: 50 } });

  const items = sitemapPosts
    .map(
      (post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${origin}/noticia/${escapeXml(post.slug)}</link>
      <guid isPermaLink="true">${origin}/noticia/${escapeXml(post.slug)}</guid>
      <category>${escapeXml(post.category)}</category>
      <description>${escapeXml(post.excerpt ?? post.title)}</description>
      ${post.publishedAt ? `<pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>` : ""}
      ${post.coverImage ? `<enclosure url="${escapeXml(post.coverImage)}" type="image/jpeg" />` : ""}
    </item>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>NTV News — Notícias do Vasco da Gama</title>
    <link>${origin}</link>
    <description>O portal do torcedor vascaíno.</description>
    <language>pt-BR</language>
    <atom:link href="${origin}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=900",
    },
  });
}
