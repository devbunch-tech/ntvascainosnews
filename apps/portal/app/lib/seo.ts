/**
 * Montagem de meta tags e JSON-LD.
 *
 * O JSON-LD é o que mais separa um portal bem indexado de um mal indexado hoje:
 * é o que alimenta o card de notícia, o carrossel do Google Discover e o
 * Knowledge Panel. O concorrente de referência não publica nenhum bloco.
 */

export interface SiteInfo {
  siteName: string;
  siteUrl: string;
  logoUrl: string;
  description: string;
  social: string[];
  organizationName?: string | null;
  foundingDate?: string | null;
}

const abs = (siteUrl: string, path: string) =>
  path.startsWith("http") ? path : `${siteUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

/** Escapa para o XML de sitemap e feed. */
export const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/** Organização + site, para o Knowledge Panel e a caixa de busca do Google. */
export function organizationJsonLd(site: SiteInfo) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsMediaOrganization",
        "@id": `${site.siteUrl}/#organization`,
        name: site.organizationName || site.siteName,
        alternateName: site.siteName,
        url: site.siteUrl,
        logo: {
          "@type": "ImageObject",
          url: abs(site.siteUrl, site.logoUrl),
        },
        description: site.description,
        ...(site.foundingDate ? { foundingDate: site.foundingDate } : {}),
        sameAs: site.social,
        areaServed: { "@type": "Country", name: "Brasil" },
        knowsAbout: ["Club de Regatas Vasco da Gama", "Futebol brasileiro", "Campeonato Brasileiro"],
      },
      {
        "@type": "WebSite",
        "@id": `${site.siteUrl}/#website`,
        url: site.siteUrl,
        name: site.siteName,
        description: site.description,
        publisher: { "@id": `${site.siteUrl}/#organization` },
        inLanguage: "pt-BR",
        // Habilita a caixa de busca do site no resultado do Google.
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${site.siteUrl}/busca?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

export interface ArticleInput {
  title: string;
  description: string;
  slug: string;
  image?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  category: string;
  keywords: string[];
  authorName?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
}

/** NewsArticle + trilha de navegação, os dois blocos que o Google usa em notícia. */
export function articleJsonLd(site: SiteInfo, article: ArticleInput) {
  const url = `${site.siteUrl}/noticia/${article.slug}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle",
        "@id": `${url}#article`,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        headline: article.title.slice(0, 110), // o Google ignora acima disso
        description: article.description,
        articleSection: article.category,
        keywords: article.keywords.join(", "),
        inLanguage: "pt-BR",
        ...(article.image
          ? { image: { "@type": "ImageObject", url: article.image, width: 1200, height: 630 } }
          : {}),
        datePublished: article.publishedAt ?? undefined,
        dateModified: article.updatedAt ?? article.publishedAt ?? undefined,
        author: article.authorName
          ? { "@type": "Person", name: article.authorName }
          : { "@id": `${site.siteUrl}/#organization` },
        publisher: { "@id": `${site.siteUrl}/#organization` },
        ...(article.sourceUrl ? { isBasedOn: article.sourceUrl } : {}),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: site.siteUrl },
          {
            "@type": "ListItem",
            position: 2,
            name: article.category,
            item: `${site.siteUrl}/noticias`,
          },
          { "@type": "ListItem", position: 3, name: article.title, item: url },
        ],
      },
    ],
  };
}

/** Lista de notícias — ajuda o Google a entender páginas de listagem. */
export function itemListJsonLd(
  site: SiteInfo,
  items: { title: string; slug: string }[],
  name: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.title,
      url: `${site.siteUrl}/noticia/${item.slug}`,
    })),
  };
}

/** Meta tags de geolocalização — sinal local, útil para portal de clube. */
export function geoMeta(geo?: { placename?: string | null; region?: string | null; position?: string | null } | null) {
  if (!geo?.position) return [];
  return [
    { name: "geo.placename", content: geo.placename ?? "" },
    { name: "geo.region", content: geo.region ?? "" },
    { name: "geo.position", content: geo.position },
    { name: "ICBM", content: geo.position.replace(";", ", ") },
  ].filter((tag) => tag.content);
}

/* ------------------------------------------------------------------ *
 * Meta tags de página
 * ------------------------------------------------------------------ */

interface RootMatch {
  id: string;
  data?: unknown;
  pathname?: string;
}

/** Configurações do site dentro do `meta()`, que não tem acesso a hooks. */
function siteFromMatches(matches: RootMatch[]) {
  const root = matches.find((match) => match.id === "root")?.data as
    | { settings?: { siteName?: string; url?: string; seo?: Record<string, any> } }
    | undefined;

  return {
    siteName: root?.settings?.siteName ?? "NTV News",
    siteUrl: (root?.settings?.url ?? "").replace(/\/$/, ""),
    defaultDescription: root?.settings?.seo?.description ?? "",
    defaultKeywords: (root?.settings?.seo?.keywords as string[] | undefined) ?? [],
    ogImage: root?.settings?.seo?.ogImage as string | undefined,
  };
}

export interface PageMetaInput {
  matches: RootMatch[];
  /** Caminho da página, começando com "/". */
  path: string;
  title: string;
  description?: string;
  keywords?: string[];
  image?: string | null;
  /** Busca e páginas de filtro não devem ser indexadas. */
  noindex?: boolean;
  type?: "website" | "article";
}

/**
 * Bloco padrão de meta tags: title, description, canonical, Open Graph e
 * Twitter. Toda página passa por aqui — sem isso, o Facebook e o X mostram
 * card vazio e o Google escolhe o snippet sozinho.
 */
export function pageMeta(input: PageMetaInput) {
  const site = siteFromMatches(input.matches);
  const url = site.siteUrl ? `${site.siteUrl}${input.path}` : undefined;
  const description = input.description || site.defaultDescription;
  const keywords = input.keywords?.length ? input.keywords : site.defaultKeywords;
  const image = input.image ?? site.ogImage;
  const title = input.title.includes(site.siteName)
    ? input.title
    : `${input.title} — ${site.siteName}`;

  return [
    { title },
    { name: "description", content: description },
    ...(keywords.length ? [{ name: "keywords", content: keywords.join(", ") }] : []),
    // Um único robots por página: emitir dois (um no root, outro aqui) deixa
    // o rastreador escolher qual vale.
    {
      name: "robots",
      content: input.noindex
        ? "noindex, follow"
        : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
    },
    ...(url ? [{ tagName: "link", rel: "canonical", href: url }] : []),

    { property: "og:site_name", content: site.siteName },
    { property: "og:type", content: input.type ?? "website" },
    { property: "og:locale", content: "pt_BR" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    ...(url ? [{ property: "og:url", content: url }] : []),
    ...(image ? [{ property: "og:image", content: image }] : []),

    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    ...(image ? [{ name: "twitter:image", content: image }] : []),
  ];
}
