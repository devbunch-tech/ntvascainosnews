import {
  Link,
  data,
  useLoaderData,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { formatDateTime } from "@ntv/shared";
import { Header, Avatar, type SessionUser } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { useSite, publicAsset } from "~/lib/site";
import { articleJsonLd, geoMeta, twitterSiteFromMatches, DEFAULT_KEYWORDS } from "~/lib/seo";
import { categoryPath, tagPath } from "~/lib/taxonomy";
import { Sidebar, type SidebarData } from "~/components/Sidebar";
import { ShareButtons } from "~/components/ShareButtons";
import { Comments, type CommentItem } from "~/components/Comments";
import type { PostCardData } from "~/components/PostCards";
import { gql } from "~/lib/graphql.server";
import { CACHE_ARTICLE, pageCacheHeaders } from "~/lib/cache.server";
import { getEnv } from "~/lib/env.server";
import { POST_QUERY } from "~/lib/queries";

interface PostPageData {
  post: {
    id: string;
    title: string;
    slug: string;
    subtitle?: string | null;
    coverImage?: string | null;
    coverCredit?: string | null;
    excerpt?: string | null;
    body: string;
    category: string;
    tags: string[];
    publishedAt?: string | null;
    updatedAt: string;
    credit?: string | null;
    source: { type: string; name?: string | null; url?: string | null };
    seo: { description?: string | null; keywords: string[]; noindex: boolean };
    geo?: { placename?: string | null; region?: string | null; position?: string | null } | null;
    author?: {
      id: string;
      name: string;
      role: string;
      avatarUrl?: string | null;
      bio?: string | null;
    } | null;
  } | null;
  comments: { total: number; hasMore: boolean; items: CommentItem[] };
  articleAds: { id: string; title: string; imageUrl?: string | null; targetUrl: string }[];
  latestPosts: { items: PostCardData[] };
  home: SidebarData;
  me: SessionUser | null;
}

export const meta: MetaFunction<typeof loader> = ({ data: loaded, matches }) => {
  const post = loaded?.post;
  if (!post) return [{ title: "Notícia não encontrada — NTV News" }];

  // A descrição gerada na API é a autoridade: já respeita limite e edição manual.
  const description = post.seo?.description ?? post.subtitle ?? post.excerpt ?? post.title;
  const image = post.coverImage;
  const keywords = post.seo?.keywords?.length ? post.seo.keywords : DEFAULT_KEYWORDS;
  const twitterSite = twitterSiteFromMatches(matches as never);

  return [
    { title: `${post.title} — NTV News` },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: loaded.canonicalUrl },

    // Open Graph — é o que o rastreador do Facebook/WhatsApp lê ao montar o card.
    { property: "og:site_name", content: "NTV News" },
    { property: "og:type", content: "article" },
    { property: "og:locale", content: "pt_BR" },
    { property: "og:url", content: loaded.canonicalUrl },
    { property: "og:title", content: post.title },
    { property: "og:description", content: description },
    ...(image
      ? [
          { property: "og:image", content: image },
          { property: "og:image:alt", content: post.title },
          { property: "og:image:width", content: "1200" },
          { property: "og:image:height", content: "630" },
        ]
      : []),
    ...(post.publishedAt
      ? [{ property: "article:published_time", content: post.publishedAt }]
      : []),
    { property: "article:modified_time", content: post.updatedAt },
    { property: "article:section", content: post.category },
    ...post.tags.map((tag) => ({ property: "article:tag", content: tag })),

    ...(keywords.length ? [{ name: "keywords", content: keywords.join(", ") }] : []),
    {
      name: "robots",
      content: post.seo?.noindex
        ? "noindex, follow"
        : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
    },
    ...geoMeta(post.geo),

    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    ...(twitterSite ? [{ name: "twitter:site", content: twitterSite }] : []),
    { name: "twitter:title", content: post.title },
    { name: "twitter:description", content: description },
    ...(image ? [{ name: "twitter:image", content: image }] : []),
  ];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const result = await gql<PostPageData>(POST_QUERY, {
    variables: { slug: params.slug },
    request,
  });
  if (!result.post) throw data("Notícia não encontrada.", { status: 404 });

  const requestUrl = new URL(request.url);
  const env = getEnv();
  // Em produção a URL pública vem de PUBLIC_SITE_URL; em dev cai no host da request.
  const origin = env.PUBLIC_SITE_URL || requestUrl.origin;

  return data(
    {
      ...result,
      canonicalUrl: `${origin}/noticia/${result.post.slug}`,
      apiUrl: env.PUBLIC_GRAPHQL_URL.replace(/\/graphql\/?$/, ""),
    },
    { headers: pageCacheHeaders(request, CACHE_ARTICLE) },
  );
}

export function headers({ loaderHeaders }: { loaderHeaders: Headers }) {
  return loaderHeaders;
}

export default function PostRoute() {
  const { post, comments, articleAds, latestPosts, home, me, canonicalUrl, apiUrl } =
    useLoaderData<typeof loader>();
  const site = useSite();
  if (!post) return null;

  return (
    <div className="shell">
      <Header user={me} />
      <main className="main">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              articleJsonLd(
                {
                  siteName: site.siteName,
                  siteUrl: site.siteUrl || new URL(canonicalUrl).origin,
                  logoUrl: site.logoUrl || "/assets/logo.svg",
                  description: site.seo.description ?? "",
                  social: site.social.map((item) => item.url),
                },
                {
                  title: post.title,
                  description: post.seo?.description ?? post.subtitle ?? post.title,
                  slug: post.slug,
                  image: post.coverImage,
                  publishedAt: post.publishedAt,
                  updatedAt: post.updatedAt,
                  category: post.category,
                  keywords: post.seo?.keywords?.length ? post.seo.keywords : DEFAULT_KEYWORDS,
                  authorName: post.author?.name,
                  sourceName: post.source.name,
                  sourceUrl: post.source.url,
                  categoryPath: categoryPath(post.category),
                },
              ),
            ),
          }}
        />
        <div className="wrap columns">
          <article>
            <nav className="breadcrumb">
              <Link to="/">Início</Link> ·{" "}
              <Link to={categoryPath(post.category)}>{post.category}</Link>
            </nav>
            <Link className="ntv-badge" to={categoryPath(post.category)}>
              {post.category}
            </Link>
            <h1 className="post__title">{post.title}</h1>
            {post.subtitle ? <p className="post__subtitle">{post.subtitle}</p> : null}

            <div className="byline">
              <Avatar name={post.author?.name ?? "NTV"} url={post.author?.avatarUrl} size={40} />
              <div className="byline__who">
                <strong style={{ color: "var(--ntv-ink)", fontSize: 14 }}>
                  {post.author?.name ?? post.source.name ?? "Redação NTV"}{" "}
                  {post.author && post.author.role !== "reader" ? (
                    <span className="ntv-badge" style={{ marginLeft: 4 }}>
                      Equipe
                    </span>
                  ) : null}
                </strong>
                <p className="ntv-meta" style={{ marginTop: 2 }}>
                  Publicado em {formatDateTime(post.publishedAt)}
                  {post.updatedAt !== post.publishedAt
                    ? ` · atualizado em ${formatDateTime(post.updatedAt)}`
                    : ""}
                  {post.credit ? ` · ${post.credit}` : ""}
                </p>
              </div>
              <div className="byline__actions">
                <ShareButtons
                  title={post.title}
                  category={post.category}
                  coverImage={post.coverImage}
                  coverCredit={post.coverCredit}
                  url={canonicalUrl}
                  apiUrl={apiUrl}
                />
              </div>
            </div>

            {post.coverImage ? (
              // A foto de abertura é o que concorre na busca por imagens; sem
              // `alt` descritivo ela não entra em nenhum resultado.
              <img
                className="post__cover"
                src={post.coverImage}
                alt={post.title}
                width={1200}
                height={630}
                fetchPriority="high"
              />
            ) : (
              <div className="post__cover" aria-hidden />
            )}
            {post.coverCredit ? <p className="post__credit">{post.coverCredit}</p> : null}

            {/* Corpo vem do editor rich-text do admin (HTML sanitizado na gravação). */}
            <div className="post__body" dangerouslySetInnerHTML={{ __html: post.body }} />

            {articleAds.length ? (
              <a
                className="adslot adslot--in-article"
                href={articleAds[0].targetUrl}
                target="_blank"
                rel="noopener sponsored"
              >
                {publicAsset(articleAds[0].imageUrl) ? (
                  <img src={publicAsset(articleAds[0].imageUrl)!} alt={articleAds[0].title} />
                ) : (
                  <span className="adslot__fallback">{articleAds[0].title}</span>
                )}
              </a>
            ) : null}

            {post.tags.length ? (
              <div className="tags">
                {post.tags.map((tag) => (
                  <Link key={tag} className="tag" to={tagPath(tag)}>
                    {tag}
                  </Link>
                ))}
              </div>
            ) : null}

            {post.source.type === "rss" && post.source.url ? (
              <p className="ntv-meta" style={{ marginBottom: 24 }}>
                Matéria original:{" "}
                <a
                  href={post.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--ntv-link-ext)" }}
                >
                  {post.source.name}
                </a>
              </p>
            ) : null}

            {post.author ? (
              <section className="authorbox">
                <Avatar name={post.author.name} url={post.author.avatarUrl} size={48} />
                <div>
                  <h3>{post.author.name}</h3>
                  <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.5 }}>
                    {post.author.bio ?? "Time de reportagem do NTV News."}
                  </p>
                  <a
                    className="ntv-btn"
                    style={{ background: "#fff", color: "var(--ntv-ink)", borderColor: "#fff" }}
                    href="https://youtube.com/@natorcidavascainos"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Seguir
                  </a>
                </div>
              </section>
            ) : null}

            <Comments
              postSlug={post.slug}
              user={me}
              initial={comments.items}
              total={comments.total}
            />
          </article>

          <Sidebar
            data={home}
            latestPosts={latestPosts.items}
            youtubeChannelUrl={site.social.find((s) => s.network === "youtube")?.url}
          />
        </div>
      </main>
      <Footer siteName={site.siteName} social={site.social} ads={site.footerAds} />
    </div>
  );
}
