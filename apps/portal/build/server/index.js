import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { renderToReadableStream } from "react-dom/server.browser";
import { ServerRouter, redirect, createCookieSessionStorage, createCookie, useRouteLoaderData, useLocation, Link, Form, NavLink, UNSAFE_withComponentProps, Outlet, UNSAFE_withErrorBoundaryProps, useRouteError, isRouteErrorResponse, Meta, Links, ScrollRestoration, Scripts, useFetcher, useLoaderData, data, useSearchParams, useSubmit, useActionData, useNavigation } from "react-router";
import { isbot } from "isbot";
import { useState, useRef, useEffect, useMemo } from "react";
async function handleRequest(request, responseStatusCode, responseHeaders, routerContext) {
  const body = await renderToReadableStream(
    /* @__PURE__ */ jsx(ServerRouter, { context: routerContext, url: request.url }),
    {
      signal: request.signal,
      onError(error) {
        console.error(error);
        responseStatusCode = 500;
      }
    }
  );
  if (isbot(request.headers.get("user-agent") ?? "")) {
    await body.allReady;
  }
  responseHeaders.set("Content-Type", "text/html; charset=utf-8");
  return new Response(body, { headers: responseHeaders, status: responseStatusCode });
}
const entryServer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: handleRequest
}, Symbol.toStringTag, { value: "Module" }));
function getEnv() {
  var _a;
  const source = globalThis.__NTV_ENV ?? ((_a = globalThis.process) == null ? void 0 : _a.env) ?? {};
  return {
    PUBLIC_GRAPHQL_URL: source.PUBLIC_GRAPHQL_URL ?? "http://localhost:4010/graphql",
    SESSION_SECRET: source.SESSION_SECRET ?? "dev-session-secret",
    PUBLIC_SITE_URL: source.PUBLIC_SITE_URL ?? "",
    PUBLIC_STORE_DOMAIN: source.PUBLIC_STORE_DOMAIN,
    PUBLIC_STOREFRONT_API_TOKEN: source.PUBLIC_STOREFRONT_API_TOKEN
  };
}
let storage = null;
function getStorage() {
  if (storage) return storage;
  storage = createCookieSessionStorage({
    cookie: {
      name: "ntv_session",
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secrets: [getEnv().SESSION_SECRET],
      secure: true,
      maxAge: 60 * 60 * 24 * 30
    }
  });
  return storage;
}
function getSession(request) {
  return getStorage().getSession(request.headers.get("Cookie"));
}
async function getToken(request) {
  const session = await getSession(request);
  return session.get("token") ?? null;
}
async function commitWithToken(request, token, to = "/") {
  const session = await getSession(request);
  session.set("token", token);
  return redirect(to, { headers: { "Set-Cookie": await getStorage().commitSession(session) } });
}
async function logout(request) {
  const session = await getSession(request);
  return redirect("/", {
    headers: { "Set-Cookie": await getStorage().destroySession(session) }
  });
}
const voterCookie = createCookie("ntv_voter", {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 365
});
async function readVoterId(request) {
  const existing = await voterCookie.parse(request.headers.get("Cookie"));
  return typeof existing === "string" && existing.length >= 8 ? existing : null;
}
async function getVoterId(request) {
  const existing = await readVoterId(request);
  if (existing) return { id: existing, isNew: false };
  return { id: crypto.randomUUID(), isNew: true };
}
class GraphQLRequestError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = "GraphQLRequestError";
  }
}
async function gql(query, options = {}) {
  var _a, _b;
  const { PUBLIC_GRAPHQL_URL } = getEnv();
  const token = options.token ?? (options.request ? await getToken(options.request) : null);
  const voter = options.voterId ?? (options.request ? await readVoterId(options.request) : null);
  const response = await fetch(PUBLIC_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...token ? { authorization: `Bearer ${token}` } : {},
      ...voter ? { "x-voter-id": voter } : {}
    },
    body: JSON.stringify({ query, variables: options.variables ?? {} }),
    signal: options.signal
  });
  if (!response.ok) {
    throw new GraphQLRequestError(`API respondeu ${response.status}`, "HTTP_ERROR");
  }
  const payload = await response.json();
  if ((_a = payload.errors) == null ? void 0 : _a.length) {
    const first = payload.errors[0];
    throw new GraphQLRequestError(first.message, (_b = first.extensions) == null ? void 0 : _b.code);
  }
  if (!payload.data) throw new GraphQLRequestError("Resposta vazia da API");
  return payload.data;
}
const AD_FIELDS = (
  /* GraphQL */
  `
  fragment AdFields on Ad {
    id
    title
    advertiser
    imageUrl
    targetUrl
    placement
  }
`
);
const SITE_QUERY = (
  /* GraphQL */
  `
  ${AD_FIELDS}
  query Site {
    settings {
      siteName
      logoUrl
      faviconUrl
      url
      seo {
        title
        description
        keywords
        googleVerification
        organizationName
        foundingDate
        ogImage
      }
      socialAccounts {
        instagram {
          url
        }
        youtube {
          url
        }
        x {
          url
        }
        facebook {
          url
        }
        tiktok {
          url
        }
      }
    }
    footerAds: ads(placement: footer) {
      ...AdFields
    }
  }
`
);
const POST_CARD_FIELDS = (
  /* GraphQL */
  `
  fragment PostCard on Post {
    id
    title
    slug
    subtitle
    coverImage
    category
    publishedAt
    credit
    source {
      type
      name
    }
    author {
      id
      name
      role
      avatarUrl
    }
  }
`
);
const SIDEBAR_FIELDS = (
  /* GraphQL */
  `
  ${AD_FIELDS}
  fragment SidebarData on Home {
    clubStats {
      position
      points
      played
      wins
      draws
      losses
      efficiency
    }
    lastMatches {
      id
      opponent
      result
      scoreFor
      scoreAgainst
      date
    }
    nextMatches {
      id
      opponent
      date
      venue
      competition
      ticketUrl
    }
    activePolls {
      id
      question
      goodPercent
      totalVotes
      myVote
      fee
      probability
      player {
        name
        position
        club
        photo
      }
    }
    shopHighlights {
      id
      title
      price
      imageUrl
      externalUrl
      marketplace
    }
    signings {
      id
      playerName
      position
      club
      fee
      photo
      date
    }
    latestVideos {
      id
      videoId
      title
      thumbnail
      url
      publishedAt
    }
    ads {
      ...AdFields
    }
  }
`
);
const HOME_QUERY = (
  /* GraphQL */
  `
  ${POST_CARD_FIELDS}
  ${SIDEBAR_FIELDS}
  query Home($latestLimit: Int!) {
    home(latestLimit: $latestLimit) {
      ticker
      featured {
        ...PostCard
        featured {
          position
        }
      }
      teamPosts {
        ...PostCard
      }
      latest {
        total
        hasMore
        items {
          ...PostCard
        }
      }
      ...SidebarData
    }
    me {
      id
      name
      avatarUrl
    }
  }
`
);
const LATEST_PAGE_QUERY = (
  /* GraphQL */
  `
  ${POST_CARD_FIELDS}
  query Latest($limit: Int!, $offset: Int!) {
    posts(limit: $limit, offset: $offset) {
      total
      hasMore
      items {
        ...PostCard
      }
    }
  }
`
);
const COMMENT_FIELDS = (
  /* GraphQL */
  `
  fragment CommentBase on Comment {
    id
    body
    createdAt
    status
    mine
    parentId
    replyingTo
    author {
      id
      name
      avatarUrl
    }
  }

  fragment CommentFields on Comment {
    ...CommentBase
    replies {
      ...CommentBase
    }
  }
`
);
const POST_QUERY = (
  /* GraphQL */
  `
  ${POST_CARD_FIELDS}
  ${SIDEBAR_FIELDS}
  ${COMMENT_FIELDS}
  query PostPage($slug: String!) {
    post(slug: $slug) {
      id
      title
      slug
      subtitle
      coverImage
      coverCredit
      excerpt
      body
      category
      tags
      publishedAt
      updatedAt
      credit
      views
      seo {
        description
        keywords
        noindex
      }
      geo {
        placename
        region
        position
      }
      source {
        type
        name
        url
      }
      author {
        id
        name
        role
        avatarUrl
        bio
      }
    }
    comments(postSlug: $slug, limit: 20) {
      total
      hasMore
      items {
        ...CommentFields
      }
    }
    articleAds: ads(placement: in_article) {
      ...AdFields
    }
    latestPosts: posts(limit: 6) {
      items {
        ...PostCard
      }
    }
    home(latestLimit: 1) {
      ...SidebarData
    }
    me {
      id
      name
      avatarUrl
    }
  }
`
);
const SHOP_QUERY = (
  /* GraphQL */
  `
  query Shop($filter: ProductFilter, $sort: ProductSort, $limit: Int!, $offset: Int!) {
    products(filter: $filter, sort: $sort, limit: $limit, offset: $offset) {
      total
      hasMore
      priceRange {
        min
        max
      }
      categories {
        value
        count
      }
      marketplaces {
        value
        count
      }
      items {
        id
        title
        price
        imageUrl
        externalUrl
        marketplace
        category
        soldOut
        highlighted
      }
    }
    me {
      id
      name
      avatarUrl
    }
  }
`
);
const ADD_COMMENT_MUTATION = (
  /* GraphQL */
  `
  ${COMMENT_FIELDS}
  mutation AddComment($postSlug: String!, $body: String!, $parentId: ID) {
    addComment(postSlug: $postSlug, body: $body, parentId: $parentId) {
      ok
      error
      category
      comment {
        ...CommentBase
      }
    }
  }
`
);
const REMOVE_COMMENT_MUTATION = (
  /* GraphQL */
  `
  mutation RemoveComment($id: ID!) {
    removeComment(id: $id)
  }
`
);
const ME_QUERY = (
  /* GraphQL */
  `
  query Me {
    me {
      id
      name
      email
      avatarUrl
      bio
      role
      preferences {
        newsletter
        matchAlerts
        shopNews
      }
      pollVotes {
        pollId
        playerName
        choice
        votedAt
      }
    }
  }
`
);
const SIGNUP_MUTATION = (
  /* GraphQL */
  `
  mutation Signup($name: String!, $email: String!, $password: String!, $newsletter: Boolean) {
    signup(name: $name, email: $email, password: $password, newsletter: $newsletter) {
      token
    }
  }
`
);
const LOGIN_MUTATION = (
  /* GraphQL */
  `
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
    }
  }
`
);
const UPDATE_PROFILE_MUTATION = (
  /* GraphQL */
  `
  mutation UpdateProfile($input: ProfileInput!) {
    updateProfile(input: $input) {
      id
      name
      email
      avatarUrl
      preferences {
        newsletter
        matchAlerts
        shopNews
      }
    }
  }
`
);
const VOTE_MUTATION = (
  /* GraphQL */
  `
  mutation Vote($pollId: ID!, $choice: PollChoice!) {
    votePoll(pollId: $pollId, choice: $choice) {
      id
      goodPercent
      totalVotes
      myVote
    }
  }
`
);
const TRACK_CLICK_MUTATION = (
  /* GraphQL */
  `
  mutation TrackClick($id: ID!) {
    trackProductClick(id: $id)
  }
`
);
const NEWS_LIST_QUERY = (
  /* GraphQL */
  `
  ${POST_CARD_FIELDS}
  query NewsList($filter: PostFilter, $limit: Int!, $offset: Int!) {
    posts(filter: $filter, limit: $limit, offset: $offset) {
      total
      hasMore
      items {
        ...PostCard
      }
    }
    me {
      id
      name
      avatarUrl
    }
  }
`
);
const SEARCH_QUERY = (
  /* GraphQL */
  `
  ${POST_CARD_FIELDS}
  query Search($q: String!, $limit: Int!, $offset: Int!) {
    searchPosts(q: $q, limit: $limit, offset: $offset) {
      total
      hasMore
      fallback
      items {
        ...PostCard
      }
    }
    me {
      id
      name
      avatarUrl
    }
  }
`
);
const STANDINGS_QUERY = (
  /* GraphQL */
  `
  query Standings {
    standings {
      key
      competition
      season
      sourceUrl
      lastSyncAt
      rows {
        position
        team
        played
        wins
        draws
        losses
        goalsFor
        goalsAgainst
        goalDiff
        points
        highlight
      }
    }
    brackets {
      key
      competition
      sourceUrl
      lastSyncAt
      rounds {
        name
        order
        ties {
          home
          away
          score
          date
          highlight
        }
      }
    }
    me {
      id
      name
      avatarUrl
    }
  }
`
);
const MARKET_QUERY = (
  /* GraphQL */
  `
  query Market {
    polls(status: "open", limit: 60) {
      id
      question
      goodPercent
      totalVotes
      myVote
      fee
      probability
      rumouredAt
      player {
        name
        position
        club
        photo
      }
    }
    signings(direction: "in", limit: 12) {
      id
      playerName
      position
      club
      fee
      photo
    }
    settings {
      matches {
        lastSyncAt
      }
    }
    me {
      id
      name
      avatarUrl
    }
  }
`
);
const SITEMAP_QUERY = (
  /* GraphQL */
  `
  query Sitemap($limit: Int!) {
    sitemapPosts(limit: $limit) {
      slug
      title
      updatedAt
      publishedAt
      coverImage
      category
      excerpt
      keywords
    }
  }
`
);
function useSite() {
  var _a, _b, _c, _d, _e, _f;
  const data2 = useRouteLoaderData("root");
  const accounts = ((_a = data2 == null ? void 0 : data2.settings) == null ? void 0 : _a.socialAccounts) ?? {};
  return {
    siteName: ((_b = data2 == null ? void 0 : data2.settings) == null ? void 0 : _b.siteName) ?? "NTV News",
    logoUrl: ((_c = data2 == null ? void 0 : data2.settings) == null ? void 0 : _c.logoUrl) ?? null,
    faviconUrl: ((_d = data2 == null ? void 0 : data2.settings) == null ? void 0 : _d.faviconUrl) ?? null,
    siteUrl: ((_e = data2 == null ? void 0 : data2.settings) == null ? void 0 : _e.url) ?? "",
    seo: ((_f = data2 == null ? void 0 : data2.settings) == null ? void 0 : _f.seo) ?? {},
    footerAds: (data2 == null ? void 0 : data2.footerAds) ?? [],
    social: Object.entries(accounts).filter(([, value]) => Boolean(value == null ? void 0 : value.url)).map(([network, value]) => ({
      network,
      url: value.url
    }))
  };
}
const abs = (siteUrl, path) => path.startsWith("http") ? path : `${siteUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
const escapeXml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
function organizationJsonLd(site) {
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
          url: abs(site.siteUrl, site.logoUrl)
        },
        description: site.description,
        ...site.foundingDate ? { foundingDate: site.foundingDate } : {},
        sameAs: site.social,
        areaServed: { "@type": "Country", name: "Brasil" },
        knowsAbout: ["Club de Regatas Vasco da Gama", "Futebol brasileiro", "Campeonato Brasileiro"]
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
            urlTemplate: `${site.siteUrl}/busca?q={search_term_string}`
          },
          "query-input": "required name=search_term_string"
        }
      }
    ]
  };
}
function articleJsonLd(site, article) {
  const url = `${site.siteUrl}/noticia/${article.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle",
        "@id": `${url}#article`,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        headline: article.title.slice(0, 110),
        // o Google ignora acima disso
        description: article.description,
        articleSection: article.category,
        keywords: article.keywords.join(", "),
        inLanguage: "pt-BR",
        ...article.image ? { image: { "@type": "ImageObject", url: article.image, width: 1200, height: 630 } } : {},
        datePublished: article.publishedAt ?? void 0,
        dateModified: article.updatedAt ?? article.publishedAt ?? void 0,
        author: article.authorName ? { "@type": "Person", name: article.authorName } : { "@id": `${site.siteUrl}/#organization` },
        publisher: { "@id": `${site.siteUrl}/#organization` },
        ...article.sourceUrl ? { isBasedOn: article.sourceUrl } : {}
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
            item: `${site.siteUrl}/noticias`
          },
          { "@type": "ListItem", position: 3, name: article.title, item: url }
        ]
      }
    ]
  };
}
function itemListJsonLd(site, items, name) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.title,
      url: `${site.siteUrl}/noticia/${item.slug}`
    }))
  };
}
function geoMeta(geo) {
  if (!(geo == null ? void 0 : geo.position)) return [];
  return [
    { name: "geo.placename", content: geo.placename ?? "" },
    { name: "geo.region", content: geo.region ?? "" },
    { name: "geo.position", content: geo.position },
    { name: "ICBM", content: geo.position.replace(";", ", ") }
  ].filter((tag) => tag.content);
}
function siteFromMatches(matches) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i;
  const root2 = (_a = matches.find((match) => match.id === "root")) == null ? void 0 : _a.data;
  return {
    siteName: ((_b = root2 == null ? void 0 : root2.settings) == null ? void 0 : _b.siteName) ?? "NTV News",
    siteUrl: (((_c = root2 == null ? void 0 : root2.settings) == null ? void 0 : _c.url) ?? "").replace(/\/$/, ""),
    defaultDescription: ((_e = (_d = root2 == null ? void 0 : root2.settings) == null ? void 0 : _d.seo) == null ? void 0 : _e.description) ?? "",
    defaultKeywords: ((_g = (_f = root2 == null ? void 0 : root2.settings) == null ? void 0 : _f.seo) == null ? void 0 : _g.keywords) ?? [],
    ogImage: (_i = (_h = root2 == null ? void 0 : root2.settings) == null ? void 0 : _h.seo) == null ? void 0 : _i.ogImage
  };
}
function pageMeta(input) {
  var _a;
  const site = siteFromMatches(input.matches);
  const url = site.siteUrl ? `${site.siteUrl}${input.path}` : void 0;
  const description = input.description || site.defaultDescription;
  const keywords = ((_a = input.keywords) == null ? void 0 : _a.length) ? input.keywords : site.defaultKeywords;
  const image = input.image ?? site.ogImage;
  const title = input.title.includes(site.siteName) ? input.title : `${input.title} — ${site.siteName}`;
  return [
    { title },
    { name: "description", content: description },
    ...keywords.length ? [{ name: "keywords", content: keywords.join(", ") }] : [],
    // Um único robots por página: emitir dois (um no root, outro aqui) deixa
    // o rastreador escolher qual vale.
    {
      name: "robots",
      content: input.noindex ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
    },
    ...url ? [{ tagName: "link", rel: "canonical", href: url }] : [],
    { property: "og:site_name", content: site.siteName },
    { property: "og:type", content: input.type ?? "website" },
    { property: "og:locale", content: "pt_BR" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    ...url ? [{ property: "og:url", content: url }] : [],
    ...image ? [{ property: "og:image", content: image }] : [],
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    ...image ? [{ name: "twitter:image", content: image }] : []
  ];
}
const tokens = "/assets/tokens-UUupfFrb.css";
const portal = "/assets/portal-D2uG0-uI.css";
const NAV = [
  { to: "/", label: "Início", end: true },
  { to: "/ntv-exclusivo", label: "NTV Exclusivo" },
  { to: "/noticias", label: "Notícias" },
  { to: "#youtube", label: "Vídeos", external: "youtube" },
  { to: "/tabela", label: "Tabela" },
  { to: "/loja", label: "Loja NTV" }
];
const YOUTUBE_FALLBACK = "https://www.youtube.com/@natorcidavascaino";
function Avatar({
  name,
  url,
  size = 30
}) {
  return /* @__PURE__ */ jsx("span", { className: "avatar", style: { width: size, height: size, fontSize: size * 0.4 }, children: url ? /* @__PURE__ */ jsx("img", { src: url, alt: "" }) : name.slice(0, 1).toUpperCase() });
}
function Header({ user }) {
  var _a;
  const site = useSite();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInput = useRef(null);
  const youtubeUrl = ((_a = site.social.find((s) => s.network === "youtube")) == null ? void 0 : _a.url) ?? YOUTUBE_FALLBACK;
  useEffect(() => {
    var _a2;
    if (searchOpen) (_a2 = searchInput.current) == null ? void 0 : _a2.focus();
  }, [searchOpen]);
  useEffect(() => setSearchOpen(false), [location.pathname]);
  const renderNav = (className) => NAV.map(
    (item) => item.external ? /* @__PURE__ */ jsx(
      "a",
      {
        className,
        href: youtubeUrl,
        target: "_blank",
        rel: "noopener noreferrer",
        children: item.label
      },
      item.label
    ) : /* @__PURE__ */ jsx(NavLink, { to: item.to, end: item.end, className, children: item.label }, item.label)
  );
  return /* @__PURE__ */ jsx("header", { className: "header", children: /* @__PURE__ */ jsxs("div", { className: "wrap", children: [
    /* @__PURE__ */ jsxs("div", { className: "header__bar", children: [
      /* @__PURE__ */ jsx(Link, { to: "/", className: "header__logo", "aria-label": `${site.siteName} — início`, children: /* @__PURE__ */ jsx("img", { src: "/assets/logo.svg", alt: site.siteName }) }),
      /* @__PURE__ */ jsx("nav", { className: "header__nav", children: renderNav("header__link") }),
      /* @__PURE__ */ jsxs("div", { className: "header__actions", children: [
        /* @__PURE__ */ jsx(Form, { method: "get", action: "/busca", role: "search", className: "header__searchform", children: /* @__PURE__ */ jsx(
          "input",
          {
            ref: searchInput,
            className: "header__search",
            type: "search",
            name: "q",
            placeholder: "Buscar no NTV News",
            "aria-label": "Buscar notícias"
          }
        ) }),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            className: "header__icon header__icon--search",
            "aria-label": "Buscar",
            "aria-expanded": searchOpen,
            onClick: () => setSearchOpen((open) => !open),
            children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", stroke: "currentColor", strokeWidth: "2.2", "aria-hidden": true, children: [
              /* @__PURE__ */ jsx("circle", { cx: "11", cy: "11", r: "7" }),
              /* @__PURE__ */ jsx("path", { d: "m20 20-3.5-3.5", strokeLinecap: "round" })
            ] })
          }
        ),
        user ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(Link, { to: "/perfil", className: "header__user", "aria-label": `Perfil de ${user.name}`, children: /* @__PURE__ */ jsx(Avatar, { name: user.name, url: user.avatarUrl }) }),
          /* @__PURE__ */ jsx(Form, { method: "post", action: "/sair", children: /* @__PURE__ */ jsx("button", { className: "ntv-btn header__cta header__cta--ghost", children: "Logout" }) })
        ] }) : /* @__PURE__ */ jsx(Link, { to: "/entrar", className: "ntv-btn header__cta", children: "Login" })
      ] })
    ] }),
    searchOpen ? /* @__PURE__ */ jsxs(Form, { method: "get", action: "/busca", role: "search", className: "header__searchdrawer", children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          className: "ntv-input",
          type: "search",
          name: "q",
          placeholder: "Buscar notícias, jogadores, competições…",
          "aria-label": "Buscar notícias",
          autoFocus: true
        }
      ),
      /* @__PURE__ */ jsx("button", { className: "ntv-btn", children: "Buscar" })
    ] }) : null,
    /* @__PURE__ */ jsx("nav", { className: "mobilenav", "aria-label": "Seções", children: renderNav("mobilenav__link") })
  ] }) });
}
function Ticker({ headline }) {
  if (!headline) return null;
  return /* @__PURE__ */ jsx("div", { className: "ticker", children: /* @__PURE__ */ jsx("div", { className: "wrap", children: /* @__PURE__ */ jsxs("div", { className: "ticker__inner", children: [
    /* @__PURE__ */ jsx("span", { className: "ticker__flag", children: "Agora" }),
    /* @__PURE__ */ jsx("span", { className: "ticker__text", children: headline })
  ] }) }) });
}
const SOCIAL_ICONS = {
  facebook: /* @__PURE__ */ jsx("path", { d: "M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.5-3.9 3.77-3.9 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12Z" }),
  instagram: /* @__PURE__ */ jsx("path", { d: "M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07Zm0 5.18a4.66 4.66 0 1 0 0 9.32 4.66 4.66 0 0 0 0-9.32Zm0 7.69a3.03 3.03 0 1 1 0-6.06 3.03 3.03 0 0 1 0 6.06Zm5.93-7.87a1.09 1.09 0 1 1-2.18 0 1.09 1.09 0 0 1 2.18 0Z" }),
  youtube: /* @__PURE__ */ jsx("path", { d: "M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.51A3.02 3.02 0 0 0 .5 6.2C0 8.09 0 12 0 12s0 3.91.5 5.8a3.02 3.02 0 0 0 2.12 2.14c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51a3.02 3.02 0 0 0 2.12-2.14C24 15.91 24 12 24 12s0-3.91-.5-5.8ZM9.6 15.57V8.43L15.82 12 9.6 15.57Z" }),
  x: /* @__PURE__ */ jsx("path", { d: "M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.22-6.82-5.96 6.82H1.68l7.73-8.84L1.25 2.25h6.82l4.71 6.23 5.46-6.23Zm-1.16 17.52h1.83L7.03 4.13H5.06l12.02 15.64Z" }),
  tiktok: /* @__PURE__ */ jsx("path", { d: "M16.6 5.82a4.28 4.28 0 0 1-1.04-2.82h-3.1v12.4a2.59 2.59 0 0 1-2.6 2.5 2.6 2.6 0 1 1 .77-5.08V9.65a5.7 5.7 0 0 0-.77-.06 5.68 5.68 0 1 0 5.68 5.68V9.01a7.35 7.35 0 0 0 4.29 1.37V7.28a4.3 4.3 0 0 1-3.23-1.46Z" })
};
const SOCIAL_LABELS = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  x: "X (Twitter)",
  tiktok: "TikTok"
};
const SOCIAL_ORDER = ["instagram", "youtube", "x", "facebook", "tiktok"];
function SocialIcon({ network, size = 20 }) {
  return /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "currentColor", "aria-hidden": true, focusable: "false", children: SOCIAL_ICONS[network] });
}
function Footer({
  siteName = "NTV News",
  social = [],
  ads = []
}) {
  const links2 = SOCIAL_ORDER.map((network) => social.find((item) => item.network === network)).filter(
    (item) => Boolean(item == null ? void 0 : item.url)
  );
  return /* @__PURE__ */ jsx("footer", { className: "footer", children: /* @__PURE__ */ jsxs("div", { className: "wrap", children: [
    ads.length ? /* @__PURE__ */ jsx("div", { className: "footer__ads", children: ads.map((ad) => /* @__PURE__ */ jsx(
      "a",
      {
        className: "adslot adslot--footer",
        href: ad.targetUrl,
        target: "_blank",
        rel: "noopener sponsored",
        children: ad.imageUrl ? /* @__PURE__ */ jsx("img", { src: ad.imageUrl, alt: ad.title }) : /* @__PURE__ */ jsx("span", { children: ad.title })
      },
      ad.id
    )) }) : null,
    /* @__PURE__ */ jsxs("div", { className: "footer__top", children: [
      /* @__PURE__ */ jsx(Link, { to: "/", className: "footer__logo", children: /* @__PURE__ */ jsx("img", { src: "/assets/logo.svg", alt: siteName }) }),
      /* @__PURE__ */ jsx("div", { className: "footer__social", children: links2.map((item) => /* @__PURE__ */ jsx(
        "a",
        {
          href: item.url,
          target: "_blank",
          rel: "noopener noreferrer",
          "aria-label": SOCIAL_LABELS[item.network],
          title: SOCIAL_LABELS[item.network],
          children: /* @__PURE__ */ jsx(SocialIcon, { network: item.network })
        },
        item.network
      )) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "footer__bottom", children: [
      /* @__PURE__ */ jsxs("span", { children: [
        "© ",
        (/* @__PURE__ */ new Date()).getFullYear(),
        " ",
        siteName,
        ". Todos os direitos reservados."
      ] }),
      /* @__PURE__ */ jsx(Link, { to: "/anuncie", className: "footer__advertise", children: "Anuncie aqui" }),
      /* @__PURE__ */ jsxs("span", { className: "footer__by", children: [
        "Desenvolvido por",
        /* @__PURE__ */ jsx("img", { src: "/assets/bunch.png", alt: "Bunch" })
      ] })
    ] })
  ] }) });
}
const links = () => [
  {
    rel: "preconnect",
    href: "https://fonts.googleapis.com"
  },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous"
  },
  // Pré-conexão ao CDN das fotos do RSS: economiza o handshake na primeira imagem.
  {
    rel: "preconnect",
    href: "https://s2-ge.glbimg.com",
    crossOrigin: "anonymous"
  },
  {
    rel: "stylesheet",
    href: tokens
  },
  {
    rel: "stylesheet",
    href: portal
  }
];
async function loader$h({
  request
}) {
  try {
    return await gql(SITE_QUERY, {
      request
    });
  } catch {
    return null;
  }
}
function Layout({
  children
}) {
  const site = useSite();
  const favicon = site.faviconUrl || "/assets/logo.svg";
  const isSvg = favicon.endsWith(".svg");
  return /* @__PURE__ */ jsxs("html", {
    lang: "pt-BR",
    children: [/* @__PURE__ */ jsxs("head", {
      children: [/* @__PURE__ */ jsx("meta", {
        charSet: "utf-8"
      }), /* @__PURE__ */ jsx("meta", {
        name: "viewport",
        content: "width=device-width, initial-scale=1"
      }), /* @__PURE__ */ jsx("meta", {
        name: "theme-color",
        content: "#101014"
      }), site.seo.googleVerification ? /* @__PURE__ */ jsx("meta", {
        name: "google-site-verification",
        content: site.seo.googleVerification
      }) : null, /* @__PURE__ */ jsx("link", {
        rel: "icon",
        href: favicon,
        type: isSvg ? "image/svg+xml" : void 0
      }), /* @__PURE__ */ jsx("link", {
        rel: "apple-touch-icon",
        href: favicon
      }), /* @__PURE__ */ jsx("link", {
        rel: "alternate",
        type: "application/rss+xml",
        title: site.siteName,
        href: "/feed.xml"
      }), /* @__PURE__ */ jsx(Meta, {}), /* @__PURE__ */ jsx(Links, {}), site.siteUrl ? /* @__PURE__ */ jsx("script", {
        type: "application/ld+json",
        dangerouslySetInnerHTML: {
          __html: JSON.stringify(organizationJsonLd({
            siteName: site.siteName,
            siteUrl: site.siteUrl,
            logoUrl: site.logoUrl || "/assets/logo.svg",
            description: site.seo.description ?? "",
            social: site.social.map((item) => item.url),
            organizationName: site.seo.organizationName,
            foundingDate: site.seo.foundingDate
          }))
        }
      }) : null]
    }), /* @__PURE__ */ jsxs("body", {
      children: [children, /* @__PURE__ */ jsx(ScrollRestoration, {}), /* @__PURE__ */ jsx(Scripts, {})]
    })]
  });
}
const root = UNSAFE_withComponentProps(function App() {
  return /* @__PURE__ */ jsx(Outlet, {});
});
const ErrorBoundary = UNSAFE_withErrorBoundaryProps(function ErrorBoundary2() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const message = isRouteErrorResponse(error) ? error.data : error instanceof Error ? error.message : "Erro inesperado.";
  return /* @__PURE__ */ jsxs("div", {
    className: "shell",
    children: [/* @__PURE__ */ jsx(Header, {
      user: null
    }), /* @__PURE__ */ jsx("main", {
      className: "main",
      children: /* @__PURE__ */ jsxs("div", {
        className: "wrap",
        children: [/* @__PURE__ */ jsxs("p", {
          className: "ntv-label",
          style: {
            color: "var(--ntv-gray-500)"
          },
          children: ["Erro ", status]
        }), /* @__PURE__ */ jsx("h1", {
          className: "post__title",
          children: status === 404 ? "Página não encontrada" : "Algo deu errado"
        }), /* @__PURE__ */ jsx("p", {
          className: "post__subtitle",
          children: message
        }), /* @__PURE__ */ jsx("a", {
          className: "ntv-btn",
          href: "/",
          children: "Voltar para a home"
        })]
      })
    }), /* @__PURE__ */ jsx(Footer, {})]
  });
});
const route0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ErrorBoundary,
  Layout,
  default: root,
  links,
  loader: loader$h
}, Symbol.toStringTag, { value: "Module" }));
function formatPrice(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}
function formatDate(value) {
  if (!value)
    return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime()))
    return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(d);
}
function formatDateTime(value) {
  if (!value)
    return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime()))
    return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
}
function timeAgo(value) {
  if (!value)
    return "";
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 6e4);
  if (min < 1)
    return "agora";
  if (min < 60)
    return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24)
    return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30)
    return `há ${days} d`;
  return formatDate(d);
}
const PROFANITY = [
  "arrombado",
  "babaca",
  "bosta",
  "buceta",
  "cacete",
  "caralho",
  "corno",
  "cuzao",
  "desgracado",
  "escroto",
  "fdp",
  "filho da puta",
  "foda",
  "fodase",
  "foder",
  "merda",
  "otario",
  "pau no cu",
  "piranha",
  "porra",
  "puta",
  "putaria",
  "puto",
  "retardado",
  "safado",
  "vagabundo",
  "vadia",
  "viado",
  "xoxota"
];
const POLITICS = [
  "bolsonaro",
  "bolsonarista",
  "lula",
  "lulista",
  "petista",
  "partido dos trabalhadores",
  "psdb",
  "psol",
  "mdb",
  "partido liberal",
  "planalto",
  "congresso nacional",
  "camara dos deputados",
  "senado federal",
  "deputado federal",
  "senador",
  "ministro do stf",
  "supremo tribunal federal",
  "stf",
  "tse",
  "impeachment",
  "urna eletronica",
  "voto impresso",
  "comunista",
  "comunismo",
  "fascista",
  "fascismo",
  "ditadura militar",
  "golpe militar",
  "esquerdista",
  "direitista",
  "eleicoes presidenciais",
  "candidato a presidente"
];
const LEET = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
  "!": "i"
};
function normalizeForModeration(input) {
  return input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[0135734@$!]/g, (char) => LEET[char] ?? char).replace(/(.)\1{2,}/g, "$1").replace(/\s+/g, " ").trim();
}
const squash = (input) => input.replace(/[^a-z]/g, "");
function findTerm(text, terms) {
  const squashed = squash(text);
  for (const term of terms) {
    if (term.includes(" ")) {
      if (text.includes(term))
        return term;
      continue;
    }
    if (new RegExp(`(^|[^a-z])${term}([^a-z]|$)`).test(text))
      return term;
    if (term.length >= 5 && squashed.includes(term))
      return term;
  }
  return void 0;
}
const MESSAGES = {
  profanity: "Seu comentário tem palavras de baixo calão. Reescreva sem xingamento.",
  politics: "Aqui a gente fala de Vasco. Comentários sobre política brasileira não são publicados."
};
function moderateComment(text) {
  const normalized = normalizeForModeration(text);
  const profanity = findTerm(normalized, PROFANITY);
  if (profanity) {
    return { allowed: false, category: "profanity", term: profanity, message: MESSAGES.profanity };
  }
  const politics = findTerm(normalized, POLITICS);
  if (politics) {
    return { allowed: false, category: "politics", term: politics, message: MESSAGES.politics };
  }
  return { allowed: true };
}
({
  profanity: PROFANITY.length,
  politics: POLITICS.length
});
function Media({ src, alt, className }) {
  if (src) return /* @__PURE__ */ jsx("img", { className, src, alt, loading: "lazy" });
  return /* @__PURE__ */ jsx("div", { className, "aria-hidden": true, children: /* @__PURE__ */ jsx("span", { style: { display: "none" }, children: alt }) });
}
function HeroCard({ post: post2, lead }) {
  var _a;
  return /* @__PURE__ */ jsxs(
    Link,
    {
      to: `/noticia/${post2.slug}`,
      className: `hero__card ${lead ? "hero__card--lead" : "hero__card--sub"}`,
      children: [
        post2.coverImage ? /* @__PURE__ */ jsx("img", { className: "hero__media", src: post2.coverImage, alt: "" }) : /* @__PURE__ */ jsx("div", { className: "hero__placeholder", children: "FOTO" }),
        /* @__PURE__ */ jsx("span", { className: "hero__overlay" }),
        /* @__PURE__ */ jsxs("div", { className: "hero__content", children: [
          /* @__PURE__ */ jsx("span", { className: "hero__badge", children: post2.category }),
          /* @__PURE__ */ jsx("h2", { className: "hero__title", children: post2.title }),
          /* @__PURE__ */ jsxs("p", { className: "hero__meta", children: [
            post2.credit ?? ((_a = post2.author) == null ? void 0 : _a.name) ?? "Redação NTV",
            " · ",
            timeAgo(post2.publishedAt)
          ] })
        ] })
      ]
    }
  );
}
function TeamCard({ post: post2 }) {
  var _a;
  return /* @__PURE__ */ jsxs(Link, { to: `/noticia/${post2.slug}`, className: "teamcard", children: [
    /* @__PURE__ */ jsx(Media, { src: post2.coverImage, alt: post2.title, className: "teamcard__thumb" }),
    /* @__PURE__ */ jsx("span", { className: "teamcard__seal", children: /* @__PURE__ */ jsx("span", { className: "ntv-badge", children: "Equipe" }) }),
    /* @__PURE__ */ jsx("h3", { className: "teamcard__title", children: post2.title }),
    /* @__PURE__ */ jsxs("p", { className: "ntv-meta", children: [
      ((_a = post2.author) == null ? void 0 : _a.name) ?? "Redação NTV",
      " · ",
      timeAgo(post2.publishedAt)
    ] })
  ] });
}
function NewsRow({ post: post2 }) {
  return /* @__PURE__ */ jsxs("article", { className: "newsitem", children: [
    /* @__PURE__ */ jsx(Media, { src: post2.coverImage, alt: post2.title, className: "newsitem__thumb" }),
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("h3", { className: "newsitem__title", children: /* @__PURE__ */ jsx(Link, { to: `/noticia/${post2.slug}`, children: post2.title }) }),
      /* @__PURE__ */ jsxs("p", { className: "ntv-meta", children: [
        timeAgo(post2.publishedAt),
        post2.credit ? ` · ${post2.credit}` : post2.author ? ` · ${post2.author.name}` : ""
      ] })
    ] })
  ] });
}
const shortDate = (iso) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(iso));
function ClubStatsWidget({ stats }) {
  if (!stats) return null;
  return /* @__PURE__ */ jsxs("section", { className: "widget", children: [
    /* @__PURE__ */ jsx("h2", { className: "widget__title", children: "Estatísticas do clube" }),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "baseline", gap: 10 }, children: [
      /* @__PURE__ */ jsxs("strong", { style: { fontSize: 30, fontWeight: 900, color: "var(--ntv-ink)" }, children: [
        stats.position,
        "º"
      ] }),
      /* @__PURE__ */ jsxs("span", { className: "ntv-meta", children: [
        "no Brasileirão · ",
        stats.points,
        " pts"
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "statgrid", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("strong", { children: stats.played }),
        /* @__PURE__ */ jsx("span", { children: "J" })
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("strong", { children: stats.wins }),
        /* @__PURE__ */ jsx("span", { children: "V" })
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("strong", { children: stats.draws }),
        /* @__PURE__ */ jsx("span", { children: "E" })
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("strong", { children: stats.losses }),
        /* @__PURE__ */ jsx("span", { children: "D" })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "bar", children: /* @__PURE__ */ jsx("div", { className: "bar__fill", style: { width: `${stats.efficiency}%` } }) }),
    /* @__PURE__ */ jsxs("p", { className: "ntv-meta", style: { marginTop: 6 }, children: [
      stats.efficiency,
      "% de aproveitamento"
    ] })
  ] });
}
function LastMatchesWidget({ matches }) {
  if (!matches.length) return null;
  return /* @__PURE__ */ jsxs("section", { className: "widget", children: [
    /* @__PURE__ */ jsx("h2", { className: "widget__title", children: "Últimos 5 jogos" }),
    /* @__PURE__ */ jsx("div", { className: "formline", children: matches.map((m) => /* @__PURE__ */ jsx("span", { className: `formdot formdot--${m.result ?? "D"}`, title: m.opponent, children: m.result === "W" ? "V" : m.result === "D" ? "E" : "D" }, m.id)) }),
    matches.map((m) => /* @__PURE__ */ jsxs("div", { className: "matchrow", children: [
      /* @__PURE__ */ jsx("span", { className: "matchrow__date", children: shortDate(m.date) }),
      /* @__PURE__ */ jsx("span", { children: m.opponent }),
      /* @__PURE__ */ jsxs("strong", { style: { marginLeft: "auto" }, children: [
        m.scoreFor,
        "–",
        m.scoreAgainst
      ] })
    ] }, m.id))
  ] });
}
function NextMatchesWidget({ matches }) {
  if (!matches.length) return null;
  return /* @__PURE__ */ jsxs("section", { className: "widget", children: [
    /* @__PURE__ */ jsx("h2", { className: "widget__title", children: "Próximos 5 jogos" }),
    matches.map((m) => /* @__PURE__ */ jsxs("div", { className: "matchrow matchrow--next", children: [
      /* @__PURE__ */ jsx("span", { className: "matchrow__date", children: shortDate(m.date) }),
      /* @__PURE__ */ jsxs("span", { style: { flex: 1, minWidth: 0 }, children: [
        m.opponent,
        /* @__PURE__ */ jsx("br", {}),
        /* @__PURE__ */ jsx("span", { className: "ntv-meta", children: m.competition }),
        m.ticketUrl ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("br", {}),
          /* @__PURE__ */ jsx(
            "a",
            {
              className: "matchrow__ticket",
              href: m.ticketUrl,
              target: "_blank",
              rel: "noopener noreferrer",
              children: "Comprar ingresso ↗"
            }
          )
        ] }) : null
      ] }),
      /* @__PURE__ */ jsx("span", { className: "matchrow__venue", children: m.venue === "home" ? "Casa" : "Fora" })
    ] }, m.id))
  ] });
}
function MarketWidget({ polls }) {
  const fetcher = useFetcher();
  if (!polls.length) return null;
  return /* @__PURE__ */ jsxs("section", { className: "widget widget--dark", children: [
    /* @__PURE__ */ jsx("h2", { className: "widget__title", children: "Mercado da Bola · Especulações" }),
    polls.slice(0, 5).map((poll) => {
      var _a, _b;
      const voted = poll.myVote ?? (((_a = fetcher.data) == null ? void 0 : _a.id) === poll.id ? fetcher.data.myVote : null);
      const percent = (((_b = fetcher.data) == null ? void 0 : _b.id) === poll.id ? fetcher.data.goodPercent : null) ?? poll.goodPercent ?? 0;
      return /* @__PURE__ */ jsxs("div", { className: "pollrow", children: [
        /* @__PURE__ */ jsxs("div", { className: "pollrow__head", children: [
          poll.player.photo ? /* @__PURE__ */ jsx("img", { className: "pollrow__photo", src: poll.player.photo, alt: "", loading: "lazy" }) : null,
          /* @__PURE__ */ jsxs("div", { style: { minWidth: 0 }, children: [
            /* @__PURE__ */ jsx("div", { className: "pollrow__name", children: poll.player.name }),
            /* @__PURE__ */ jsxs("span", { className: "ntv-meta", children: [
              [poll.player.position, poll.player.club].filter(Boolean).join(" · "),
              poll.probability ? ` · ${poll.probability}% provável` : ""
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "bar", children: /* @__PURE__ */ jsx("div", { className: "bar__fill", style: { width: `${percent}%` } }) }),
        /* @__PURE__ */ jsxs("div", { className: "pollrow__legend", children: [
          /* @__PURE__ */ jsxs("span", { children: [
            percent,
            "% aprova"
          ] }),
          /* @__PURE__ */ jsxs("span", { children: [
            poll.totalVotes,
            " voto(s)"
          ] })
        ] }),
        voted ? /* @__PURE__ */ jsxs("p", { className: "pollrow__voted", children: [
          "Você ",
          voted === "good" ? "aprovou" : "reprovou",
          " esta contratação."
        ] }) : /* @__PURE__ */ jsxs(fetcher.Form, { method: "post", action: "/api/votar", className: "pollrow__actions", children: [
          /* @__PURE__ */ jsx("input", { type: "hidden", name: "pollId", value: poll.id }),
          /* @__PURE__ */ jsx("button", { className: "votebtn votebtn--yes", name: "choice", value: "good", children: "Aprovo" }),
          /* @__PURE__ */ jsx("button", { className: "votebtn votebtn--no", name: "choice", value: "bad", children: "Reprovo" })
        ] })
      ] }, poll.id);
    }),
    /* @__PURE__ */ jsx(Link, { className: "ntv-btn widget__cta", to: "/mercado", children: "Ver todas as especulações" })
  ] });
}
function SigningsWidget({ signings }) {
  if (!(signings == null ? void 0 : signings.length)) return null;
  return /* @__PURE__ */ jsxs("section", { className: "widget", children: [
    /* @__PURE__ */ jsx("h2", { className: "widget__title", children: "Últimas contratações" }),
    /* @__PURE__ */ jsx("ul", { className: "signings", children: signings.slice(0, 5).map((signing) => /* @__PURE__ */ jsxs("li", { className: "signing", children: [
      signing.photo ? /* @__PURE__ */ jsx("img", { className: "signing__photo", src: signing.photo, alt: "", loading: "lazy" }) : /* @__PURE__ */ jsx("span", { className: "signing__photo signing__photo--empty", "aria-hidden": true }),
      /* @__PURE__ */ jsxs("span", { style: { minWidth: 0 }, children: [
        /* @__PURE__ */ jsx("strong", { className: "signing__name", children: signing.playerName }),
        /* @__PURE__ */ jsx("span", { className: "ntv-meta", children: [signing.position, signing.club].filter(Boolean).join(" · ") || "Reforço" })
      ] }),
      signing.fee ? /* @__PURE__ */ jsx("span", { className: "signing__fee", children: signing.fee }) : null
    ] }, signing.id)) })
  ] });
}
function YouTubeWidget({
  videos,
  channelUrl
}) {
  const [latest, ...previous] = videos ?? [];
  return /* @__PURE__ */ jsxs("section", { className: "widget", children: [
    /* @__PURE__ */ jsx("h2", { className: "widget__title", children: "No YouTube" }),
    latest ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("a", { className: "ytcard", href: latest.url, target: "_blank", rel: "noopener noreferrer", children: [
        /* @__PURE__ */ jsxs("span", { className: "ytcard__thumb", children: [
          latest.thumbnail ? /* @__PURE__ */ jsx("img", { src: latest.thumbnail, alt: "", loading: "lazy" }) : null,
          /* @__PURE__ */ jsx("span", { className: "ytcard__play", "aria-hidden": true, children: "▶" })
        ] }),
        /* @__PURE__ */ jsx("span", { className: "ytcard__title", children: latest.title }),
        /* @__PURE__ */ jsx("span", { className: "ntv-meta", children: timeAgo(latest.publishedAt) })
      ] }),
      previous.length ? /* @__PURE__ */ jsx("ul", { className: "ytlist", children: previous.map((video) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx("a", { href: video.url, target: "_blank", rel: "noopener noreferrer", children: video.title }) }, video.id)) }) : null
    ] }) : /* @__PURE__ */ jsx("p", { className: "ntv-meta", style: { marginBottom: 12 }, children: "Nenhum vídeo sincronizado ainda." }),
    /* @__PURE__ */ jsx(
      "a",
      {
        className: "ntv-btn ntv-btn--outline",
        style: { marginTop: 12 },
        href: channelUrl ?? "https://www.youtube.com/@natorcidavascaino",
        target: "_blank",
        rel: "noopener noreferrer",
        children: "Ver o canal"
      }
    )
  ] });
}
function AdWidget({ ads }) {
  const fetcher = useFetcher();
  if (!(ads == null ? void 0 : ads.length)) return null;
  return /* @__PURE__ */ jsx(Fragment, { children: ads.map((ad) => /* @__PURE__ */ jsxs("section", { className: "widget widget--ad", children: [
    /* @__PURE__ */ jsx("span", { className: "adslot__tag", children: "Publicidade" }),
    /* @__PURE__ */ jsx(
      "a",
      {
        className: "adslot",
        href: ad.targetUrl,
        target: "_blank",
        rel: "noopener sponsored",
        onClick: () => fetcher.submit({ id: ad.id }, { method: "post", action: "/api/clique-anuncio" }),
        children: ad.imageUrl ? /* @__PURE__ */ jsx("img", { src: ad.imageUrl, alt: ad.title, loading: "lazy" }) : /* @__PURE__ */ jsx("span", { className: "adslot__fallback", children: ad.title })
      }
    ),
    ad.advertiser ? /* @__PURE__ */ jsx("span", { className: "ntv-meta", children: ad.advertiser }) : null
  ] }, ad.id)) });
}
function ShopWidget({ products }) {
  if (!products.length) return null;
  return /* @__PURE__ */ jsxs("section", { className: "widget", children: [
    /* @__PURE__ */ jsx("h2", { className: "widget__title", children: "Loja NTV" }),
    products.map((p) => /* @__PURE__ */ jsxs(
      "a",
      {
        className: "shopmini",
        href: p.externalUrl,
        target: "_blank",
        rel: "noopener sponsored",
        children: [
          p.imageUrl ? /* @__PURE__ */ jsx("img", { src: p.imageUrl, alt: "" }) : /* @__PURE__ */ jsx("span", { className: "ph" }),
          /* @__PURE__ */ jsxs("span", { children: [
            /* @__PURE__ */ jsx("span", { className: "shopmini__title", children: p.title }),
            /* @__PURE__ */ jsx("br", {}),
            /* @__PURE__ */ jsx("span", { className: "shopmini__price", children: formatPrice(p.price) })
          ] })
        ]
      },
      p.id
    )),
    /* @__PURE__ */ jsx(
      Link,
      {
        className: "ntv-btn ntv-btn--outline",
        style: { marginTop: 12 },
        to: "/loja",
        children: "Ver a loja"
      }
    )
  ] });
}
function Sidebar({
  data: data2,
  latestPosts,
  youtubeChannelUrl
}) {
  return /* @__PURE__ */ jsxs("aside", { className: "sidebar", children: [
    (latestPosts == null ? void 0 : latestPosts.length) ? /* @__PURE__ */ jsxs("section", { className: "widget", children: [
      /* @__PURE__ */ jsx("h2", { className: "widget__title", children: "Últimas postagens" }),
      /* @__PURE__ */ jsx("div", { className: "newslist", style: { borderTop: 0 }, children: latestPosts.slice(0, 6).map((post2) => /* @__PURE__ */ jsx(NewsRow, { post: post2 }, post2.id)) })
    ] }) : null,
    /* @__PURE__ */ jsx(ClubStatsWidget, { stats: data2.clubStats }),
    /* @__PURE__ */ jsx(LastMatchesWidget, { matches: data2.lastMatches }),
    /* @__PURE__ */ jsx(NextMatchesWidget, { matches: data2.nextMatches }),
    /* @__PURE__ */ jsx(MarketWidget, { polls: data2.activePolls }),
    /* @__PURE__ */ jsx(SigningsWidget, { signings: data2.signings }),
    /* @__PURE__ */ jsx(YouTubeWidget, { videos: data2.latestVideos, channelUrl: youtubeChannelUrl }),
    /* @__PURE__ */ jsx(AdWidget, { ads: data2.ads }),
    /* @__PURE__ */ jsx(ShopWidget, { products: data2.shopHighlights })
  ] });
}
const meta$b = ({
  matches
}) => pageMeta({
  matches,
  path: "/",
  title: "NTV News — Notícias do Vasco da Gama",
  description: "O portal do torcedor vascaíno: notícias, mercado da bola, tabela, chaveamento das copas e a Loja NTV."
});
async function loader$g({
  request
}) {
  const data2 = await gql(HOME_QUERY, {
    variables: {
      latestLimit: 12
    },
    request
  });
  return data2;
}
const PAGE_SIZE$2 = 12;
const home = UNSAFE_withComponentProps(function HomeRoute() {
  var _a;
  const {
    home: home2,
    me
  } = useLoaderData();
  const site = useSite();
  const [extra, setExtra] = useState([]);
  const fetcher = useFetcher();
  useEffect(() => {
    var _a2, _b;
    const incoming = (_b = (_a2 = fetcher.data) == null ? void 0 : _a2.posts) == null ? void 0 : _b.items;
    if (incoming == null ? void 0 : incoming.length) setExtra((prev) => [...prev, ...incoming]);
  }, [fetcher.data]);
  const latest = [...home2.latest.items, ...extra];
  const hasMore = fetcher.data ? fetcher.data.posts.hasMore : home2.latest.hasMore;
  const [lead, ...rest] = home2.featured;
  return /* @__PURE__ */ jsxs("div", {
    className: "shell",
    children: [/* @__PURE__ */ jsx(Header, {
      user: me
    }), /* @__PURE__ */ jsx(Ticker, {
      headline: home2.ticker
    }), /* @__PURE__ */ jsx("main", {
      className: "main",
      children: /* @__PURE__ */ jsxs("div", {
        className: "wrap columns",
        children: [/* @__PURE__ */ jsxs("div", {
          children: [lead ? /* @__PURE__ */ jsxs("section", {
            className: "hero",
            children: [/* @__PURE__ */ jsx(HeroCard, {
              post: lead,
              lead: true
            }), rest.slice(0, 2).map((post2) => /* @__PURE__ */ jsx(HeroCard, {
              post: post2
            }, post2.id))]
          }) : null, home2.teamPosts.length ? /* @__PURE__ */ jsxs("section", {
            className: "section",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "section__head",
              children: [/* @__PURE__ */ jsx("span", {
                className: "section__rule"
              }), /* @__PURE__ */ jsx("h2", {
                className: "section__title",
                children: "Leo Lacerda & equipe"
              })]
            }), /* @__PURE__ */ jsx("div", {
              className: "teamgrid",
              children: home2.teamPosts.map((post2) => /* @__PURE__ */ jsx(TeamCard, {
                post: post2
              }, post2.id))
            })]
          }) : null, /* @__PURE__ */ jsxs("section", {
            className: "section",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "section__head",
              children: [/* @__PURE__ */ jsx("span", {
                className: "section__rule"
              }), /* @__PURE__ */ jsx("h2", {
                className: "section__title",
                children: "Últimas notícias"
              }), /* @__PURE__ */ jsxs("span", {
                className: "section__more",
                children: [home2.latest.total, " publicações"]
              })]
            }), /* @__PURE__ */ jsx("div", {
              className: "newslist",
              children: latest.map((post2) => /* @__PURE__ */ jsx(NewsRow, {
                post: post2
              }, post2.id))
            }), hasMore ? /* @__PURE__ */ jsx("button", {
              type: "button",
              className: "ntv-btn ntv-btn--outline loadmore",
              disabled: fetcher.state !== "idle",
              onClick: () => fetcher.load(`/api/ultimas?offset=${latest.length}&limit=${PAGE_SIZE$2}`),
              children: fetcher.state === "idle" ? "Ver mais notícias" : "Carregando…"
            }) : null]
          })]
        }), /* @__PURE__ */ jsx(Sidebar, {
          data: home2,
          youtubeChannelUrl: (_a = site.social.find((s) => s.network === "youtube")) == null ? void 0 : _a.url
        })]
      })
    }), /* @__PURE__ */ jsx(Footer, {
      siteName: site.siteName,
      social: site.social,
      ads: site.footerAds
    })]
  });
});
const route1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: home,
  loader: loader$g,
  meta: meta$b
}, Symbol.toStringTag, { value: "Module" }));
const WIDTH = 1080;
const HEIGHT = 1920;
const PADDING = 72;
const INK = "#101014";
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    image.src = src;
  });
}
function drawCover(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}
function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}
async function buildStoryCard(input) {
  var _a;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");
  if ((_a = document.fonts) == null ? void 0 : _a.ready) {
    try {
      await document.fonts.load("800 64px Archivo");
      await document.fonts.ready;
    } catch {
    }
  }
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const photoHeight = 1180;
  if (input.imageUrl) {
    try {
      const proxied = `${input.apiUrl}/image-proxy?url=${encodeURIComponent(input.imageUrl)}`;
      drawCover(ctx, await loadImage(proxied), 0, 0, WIDTH, photoHeight);
    } catch {
    }
  }
  const gradient = ctx.createLinearGradient(0, photoHeight - 620, 0, photoHeight);
  gradient.addColorStop(0, "rgba(16,16,20,0)");
  gradient.addColorStop(1, INK);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, photoHeight - 620, WIDTH, 620);
  let cursorY = photoHeight + 40;
  ctx.font = "800 30px Archivo, sans-serif";
  const label = input.category.toUpperCase();
  const labelWidth = ctx.measureText(label).width;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(PADDING, cursorY - 46, labelWidth + 40, 62);
  ctx.fillStyle = INK;
  ctx.fillText(label, PADDING + 20, cursorY - 4);
  cursorY += 78;
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 76px Archivo, sans-serif";
  const lines = wrapText(ctx, input.title, WIDTH - PADDING * 2).slice(0, 6);
  for (const line of lines) {
    ctx.fillText(line, PADDING, cursorY);
    cursorY += 90;
  }
  if (input.credit) {
    ctx.fillStyle = "#8a8a92";
    ctx.font = "500 30px Archivo, sans-serif";
    ctx.fillText(input.credit, PADDING, cursorY + 16);
  }
  try {
    const logo = await loadImage("/assets/logo.svg");
    const logoHeight = 64;
    const logoWidth = logo.width / logo.height * logoHeight;
    ctx.save();
    ctx.filter = "invert(1)";
    ctx.drawImage(logo, PADDING, HEIGHT - 150, logoWidth, logoHeight);
    ctx.restore();
  } catch {
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 54px Archivo, sans-serif";
    ctx.fillText("NTV NEWS", PADDING, HEIGHT - 100);
  }
  ctx.fillStyle = "#8a8a92";
  ctx.font = "700 28px Archivo, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(input.siteLabel ?? "ntvnews.com.br", WIDTH - PADDING, HEIGHT - 104);
  ctx.textAlign = "left";
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Não foi possível gerar a imagem.")),
      "image/png"
    );
  });
}
const ICONS = {
  facebook: /* @__PURE__ */ jsx("path", { d: "M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.5-3.9 3.77-3.9 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12Z" }),
  instagram: /* @__PURE__ */ jsx("path", { d: "M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07Zm0 5.18a4.66 4.66 0 1 0 0 9.32 4.66 4.66 0 0 0 0-9.32Zm0 7.69a3.03 3.03 0 1 1 0-6.06 3.03 3.03 0 0 1 0 6.06Zm5.93-7.87a1.09 1.09 0 1 1-2.18 0 1.09 1.09 0 0 1 2.18 0Z" }),
  whatsapp: /* @__PURE__ */ jsx("path", { d: "M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.86 1.21 3.06c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35ZM12.05 21.8h-.01a9.8 9.8 0 0 1-4.99-1.37l-.36-.21-3.71.97.99-3.62-.23-.37a9.78 9.78 0 0 1-1.5-5.22c0-5.4 4.4-9.8 9.81-9.8a9.75 9.75 0 0 1 6.93 2.88 9.73 9.73 0 0 1 2.87 6.93c0 5.4-4.4 9.8-9.8 9.8Zm8.34-18.14A11.66 11.66 0 0 0 12.05 0C5.6 0 .35 5.25.35 11.7c0 2.06.54 4.07 1.56 5.85L.25 24l6.6-1.73a11.66 11.66 0 0 0 5.2 1.24h.01c6.45 0 11.7-5.25 11.7-11.7 0-3.13-1.22-6.07-3.43-8.28Z" })
};
function Icon({ name }) {
  return /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "currentColor", "aria-hidden": true, focusable: "false", children: ICONS[name] });
}
function ShareButtons(share) {
  const [storyOpen, setStoryOpen] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);
  function openWindow(target) {
    window.open(target, "_blank", "noopener,noreferrer,width=660,height=580");
  }
  async function shareInstagram() {
    if (canNativeShare) {
      try {
        await navigator.share({ title: share.title, url: share.url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    setStoryOpen(true);
  }
  return /* @__PURE__ */ jsxs("div", { className: "share", children: [
    /* @__PURE__ */ jsx("span", { className: "share__label", children: "Compartilhar" }),
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        className: "share__btn",
        "aria-label": "Compartilhar no Facebook",
        title: "Facebook",
        onClick: () => openWindow(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(share.url)}`),
        children: /* @__PURE__ */ jsx(Icon, { name: "facebook" })
      }
    ),
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        className: "share__btn",
        "aria-label": "Compartilhar no Instagram",
        title: "Instagram",
        onClick: shareInstagram,
        children: /* @__PURE__ */ jsx(Icon, { name: "instagram" })
      }
    ),
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        className: "share__btn",
        "aria-label": "Compartilhar no WhatsApp",
        title: "WhatsApp",
        onClick: () => openWindow(
          `https://api.whatsapp.com/send?text=${encodeURIComponent(`${share.title} ${share.url}`)}`
        ),
        children: /* @__PURE__ */ jsx(Icon, { name: "whatsapp" })
      }
    ),
    storyOpen ? /* @__PURE__ */ jsx(StoryModal, { share, onClose: () => setStoryOpen(false) }) : null
  ] });
}
function StoryModal({ share, onClose }) {
  const [preview, setPreview] = useState(null);
  const [blob, setBlob] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    buildStoryCard({
      title: share.title,
      category: share.category,
      credit: share.coverCredit,
      imageUrl: share.coverImage,
      apiUrl: share.apiUrl
    }).then((generated) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(generated);
      setBlob(generated);
      setPreview(objectUrl);
    }).catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Falha ao gerar a imagem."));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [share]);
  function download() {
    if (!blob) return;
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "ntv-news-story.png";
    anchor.click();
    URL.revokeObjectURL(href);
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2600);
    } catch {
      setError("Não foi possível copiar. Copie da barra de endereço.");
    }
  }
  return /* @__PURE__ */ jsx("div", { className: "backdrop", role: "dialog", "aria-modal": "true", "aria-label": "Compartilhar no Instagram", onClick: onClose, children: /* @__PURE__ */ jsxs("div", { className: "modal story", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxs("div", { className: "modal__head", children: [
      "Compartilhar no Instagram",
      /* @__PURE__ */ jsx("button", { className: "modal__close", onClick: onClose, "aria-label": "Fechar", children: "✕" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "modal__body", children: [
      /* @__PURE__ */ jsx("div", { className: "story__preview", children: preview ? /* @__PURE__ */ jsx("img", { src: preview, alt: "Prévia do card para o story" }) : error ? /* @__PURE__ */ jsx("p", { className: "alert", children: error }) : /* @__PURE__ */ jsx("p", { className: "ntv-meta", children: "Gerando o card…" }) }),
      /* @__PURE__ */ jsxs("ol", { className: "story__steps", children: [
        /* @__PURE__ */ jsx("li", { children: "Baixe o card abaixo." }),
        /* @__PURE__ */ jsx("li", { children: "Poste no seu story e use o sticker de link." }),
        /* @__PURE__ */ jsx("li", { children: "Cole o link do post — ele já vai copiado." })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "story__actions", children: [
        /* @__PURE__ */ jsx("button", { className: "ntv-btn", onClick: download, disabled: !blob, children: "Baixar card" }),
        /* @__PURE__ */ jsx("button", { className: "ntv-btn ntv-btn--outline", onClick: copyLink, children: copied ? "Link copiado ✓" : "Copiar link" })
      ] }),
      /* @__PURE__ */ jsx("p", { className: "modal__note", children: "O Instagram não permite publicar link de terceiro direto do navegador — este é o caminho oficial. No celular, o botão abre a folha de compartilhamento do sistema." })
    ] })
  ] }) });
}
const MAX_LENGTH = 1500;
function CommentForm({
  postSlug,
  user,
  parentId,
  placeholder,
  autoFocus,
  onCancel,
  onCreated
}) {
  var _a;
  const fetcher = useFetcher();
  const formRef = useRef(null);
  const [draft, setDraft] = useState("");
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    var _a2;
    const data2 = fetcher.data;
    if ((data2 == null ? void 0 : data2.ok) && data2.comment) {
      onCreated(data2.comment, parentId);
      setDraft("");
      setPreview(null);
      (_a2 = formRef.current) == null ? void 0 : _a2.reset();
    }
  }, [fetcher.data]);
  function onDraftChange(value) {
    setDraft(value);
    if (value.trim().length < 3) return setPreview(null);
    const verdict = moderateComment(value);
    setPreview(verdict.allowed ? null : verdict.message ?? null);
  }
  const sending = fetcher.state !== "idle";
  const serverError = ((_a = fetcher.data) == null ? void 0 : _a.ok) === false ? fetcher.data.error : null;
  return /* @__PURE__ */ jsxs(
    fetcher.Form,
    {
      ref: formRef,
      method: "post",
      action: "/api/comentar",
      className: parentId ? "comments__form comments__form--reply" : "comments__form",
      children: [
        /* @__PURE__ */ jsx("input", { type: "hidden", name: "postSlug", value: postSlug }),
        /* @__PURE__ */ jsx("input", { type: "hidden", name: "intent", value: "create" }),
        parentId ? /* @__PURE__ */ jsx("input", { type: "hidden", name: "parentId", value: parentId }) : null,
        /* @__PURE__ */ jsxs("div", { className: "comments__composer", children: [
          /* @__PURE__ */ jsx(Avatar, { name: user.name, url: user.avatarUrl, size: parentId ? 32 : 40 }),
          /* @__PURE__ */ jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [
            /* @__PURE__ */ jsx(
              "textarea",
              {
                className: "ntv-textarea",
                name: "body",
                rows: parentId ? 2 : 3,
                maxLength: MAX_LENGTH,
                placeholder,
                value: draft,
                autoFocus,
                onChange: (e) => onDraftChange(e.target.value),
                required: true
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "comments__formfoot", children: [
              /* @__PURE__ */ jsxs("span", { className: "ntv-meta", children: [
                draft.length,
                "/",
                MAX_LENGTH,
                " · sem palavrão e sem política"
              ] }),
              onCancel ? /* @__PURE__ */ jsx("button", { type: "button", className: "linkbtn", onClick: onCancel, children: "Cancelar" }) : null,
              /* @__PURE__ */ jsx("button", { className: "ntv-btn", disabled: sending || Boolean(preview) || !draft.trim(), children: sending ? "Enviando…" : parentId ? "Responder" : "Comentar" })
            ] })
          ] })
        ] }),
        preview ? /* @__PURE__ */ jsx("p", { className: "alert", children: preview }) : null,
        serverError && !preview ? /* @__PURE__ */ jsx("p", { className: "alert", children: serverError }) : null
      ]
    }
  );
}
function CommentNode({
  comment,
  postSlug,
  user,
  isReply,
  replyingId,
  onReplyToggle,
  onCreated,
  onRemoved
}) {
  var _a;
  const remover = useFetcher();
  useEffect(() => {
    var _a2;
    if ((_a2 = remover.data) == null ? void 0 : _a2.removedId) onRemoved(remover.data.removedId);
  }, [remover.data]);
  const held = comment.status !== "published";
  return /* @__PURE__ */ jsxs("li", { className: `comment ${held ? "comment--held" : ""}`, children: [
    /* @__PURE__ */ jsx(Avatar, { name: comment.author.name, url: comment.author.avatarUrl, size: isReply ? 30 : 36 }),
    /* @__PURE__ */ jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [
      /* @__PURE__ */ jsxs("div", { className: "comment__head", children: [
        /* @__PURE__ */ jsx("strong", { className: "comment__name", children: comment.author.name }),
        comment.replyingTo ? /* @__PURE__ */ jsxs("span", { className: "comment__replyingto", children: [
          "respondendo a ",
          comment.replyingTo
        ] }) : null,
        /* @__PURE__ */ jsx("span", { className: "ntv-meta", children: timeAgo(comment.createdAt) }),
        held ? /* @__PURE__ */ jsx("span", { className: "ntv-badge ntv-badge--warning", children: "Não publicado" }) : null,
        comment.mine ? /* @__PURE__ */ jsxs(remover.Form, { method: "post", action: "/api/comentar", style: { marginLeft: "auto" }, children: [
          /* @__PURE__ */ jsx("input", { type: "hidden", name: "intent", value: "remove" }),
          /* @__PURE__ */ jsx("input", { type: "hidden", name: "id", value: comment.id }),
          /* @__PURE__ */ jsx("button", { className: "linkbtn", type: "submit", children: "Excluir" })
        ] }) : null
      ] }),
      /* @__PURE__ */ jsx("p", { className: "comment__body", children: comment.body }),
      held ? /* @__PURE__ */ jsx("p", { className: "ntv-meta", children: "Este comentário não passou na moderação e só é visível para você." }) : /* @__PURE__ */ jsx("div", { className: "comment__actions", children: user ? /* @__PURE__ */ jsx(
        "button",
        {
          className: "linkbtn",
          onClick: () => onReplyToggle(replyingId === comment.id ? null : comment.id),
          children: replyingId === comment.id ? "Fechar" : "Responder"
        }
      ) : /* @__PURE__ */ jsx(Link, { className: "linkbtn", to: "/entrar?motivo=comentario", children: "Responder" }) }),
      user && replyingId === comment.id ? /* @__PURE__ */ jsx(
        CommentForm,
        {
          postSlug,
          user,
          parentId: comment.id,
          autoFocus: true,
          placeholder: `Responder a ${comment.author.name}…`,
          onCancel: () => onReplyToggle(null),
          onCreated
        }
      ) : null,
      ((_a = comment.replies) == null ? void 0 : _a.length) ? /* @__PURE__ */ jsx("ol", { className: "comments__list comments__list--replies", children: comment.replies.map((reply) => /* @__PURE__ */ jsx(
        CommentNode,
        {
          comment: reply,
          postSlug,
          user,
          isReply: true,
          replyingId,
          onReplyToggle,
          onCreated,
          onRemoved
        },
        reply.id
      )) }) : null
    ] })
  ] });
}
function Comments({
  postSlug,
  user,
  initial,
  total
}) {
  const location = useLocation();
  const [items, setItems] = useState(initial);
  const [count, setCount] = useState(total);
  const [replyingId, setReplyingId] = useState(null);
  useEffect(() => {
    setItems(initial);
    setCount(total);
  }, [initial, total]);
  function handleCreated(comment, parentId) {
    setCount((value) => value + 1);
    setReplyingId(null);
    if (!parentId) {
      setItems((prev) => [{ ...comment, replies: [] }, ...prev]);
      return;
    }
    const rootId = comment.parentId ?? parentId;
    setItems(
      (prev) => prev.map(
        (root2) => root2.id === rootId ? { ...root2, replies: [...root2.replies ?? [], comment] } : root2
      )
    );
  }
  function handleRemoved(id) {
    setItems(
      (prev) => prev.filter((root2) => root2.id !== id).map((root2) => ({ ...root2, replies: (root2.replies ?? []).filter((r) => r.id !== id) }))
    );
    setCount((value) => Math.max(0, value - 1));
  }
  return /* @__PURE__ */ jsxs("section", { className: "comments", id: "comentarios", children: [
    /* @__PURE__ */ jsxs("div", { className: "section__head", children: [
      /* @__PURE__ */ jsx("span", { className: "section__rule" }),
      /* @__PURE__ */ jsxs("h2", { className: "section__title", children: [
        "Comentários ",
        count ? /* @__PURE__ */ jsx("span", { className: "comments__count", children: count }) : null
      ] })
    ] }),
    user ? /* @__PURE__ */ jsx(
      CommentForm,
      {
        postSlug,
        user,
        placeholder: "Comente sobre a notícia…",
        onCreated: handleCreated
      }
    ) : /* @__PURE__ */ jsxs("div", { className: "comments__login", children: [
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Entre na sua conta para comentar." }),
        /* @__PURE__ */ jsx("br", {}),
        /* @__PURE__ */ jsx("span", { className: "ntv-meta", children: "É a mesma conta da Loja NTV — vale para comentários e enquetes." })
      ] }),
      /* @__PURE__ */ jsx(
        Link,
        {
          className: "ntv-btn",
          to: `/entrar?voltar=${encodeURIComponent(`${location.pathname}#comentarios`)}`,
          children: "Entrar"
        }
      ),
      /* @__PURE__ */ jsx(Link, { className: "ntv-btn ntv-btn--outline", to: "/inscricao", children: "Criar conta" })
    ] }),
    /* @__PURE__ */ jsx("ol", { className: "comments__list", children: items.map((comment) => /* @__PURE__ */ jsx(
      CommentNode,
      {
        comment,
        postSlug,
        user,
        replyingId,
        onReplyToggle: setReplyingId,
        onCreated: handleCreated,
        onRemoved: handleRemoved
      },
      comment.id
    )) }),
    !items.length ? /* @__PURE__ */ jsx("p", { className: "ntv-meta", style: { padding: "16px 0" }, children: "Nenhum comentário ainda. Seja o primeiro." }) : null
  ] });
}
const meta$a = ({
  data: loaded
}) => {
  var _a, _b, _c;
  const post2 = loaded == null ? void 0 : loaded.post;
  if (!post2) return [{
    title: "Notícia não encontrada — NTV News"
  }];
  const description = ((_a = post2.seo) == null ? void 0 : _a.description) ?? post2.subtitle ?? post2.excerpt ?? post2.title;
  const image = post2.coverImage;
  const keywords = ((_b = post2.seo) == null ? void 0 : _b.keywords) ?? [];
  return [
    {
      title: `${post2.title} — NTV News`
    },
    {
      name: "description",
      content: description
    },
    {
      tagName: "link",
      rel: "canonical",
      href: loaded.canonicalUrl
    },
    // Open Graph — é o que o rastreador do Facebook/WhatsApp lê ao montar o card.
    {
      property: "og:site_name",
      content: "NTV News"
    },
    {
      property: "og:type",
      content: "article"
    },
    {
      property: "og:locale",
      content: "pt_BR"
    },
    {
      property: "og:url",
      content: loaded.canonicalUrl
    },
    {
      property: "og:title",
      content: post2.title
    },
    {
      property: "og:description",
      content: description
    },
    ...image ? [{
      property: "og:image",
      content: image
    }, {
      property: "og:image:alt",
      content: post2.title
    }, {
      property: "og:image:width",
      content: "1200"
    }, {
      property: "og:image:height",
      content: "630"
    }] : [],
    ...post2.publishedAt ? [{
      property: "article:published_time",
      content: post2.publishedAt
    }] : [],
    {
      property: "article:modified_time",
      content: post2.updatedAt
    },
    {
      property: "article:section",
      content: post2.category
    },
    ...post2.tags.map((tag) => ({
      property: "article:tag",
      content: tag
    })),
    ...keywords.length ? [{
      name: "keywords",
      content: keywords.join(", ")
    }] : [],
    {
      name: "robots",
      content: ((_c = post2.seo) == null ? void 0 : _c.noindex) ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
    },
    ...geoMeta(post2.geo),
    {
      name: "twitter:card",
      content: image ? "summary_large_image" : "summary"
    },
    {
      name: "twitter:title",
      content: post2.title
    },
    {
      name: "twitter:description",
      content: description
    },
    ...image ? [{
      name: "twitter:image",
      content: image
    }] : []
  ];
};
async function loader$f({
  request,
  params
}) {
  const result = await gql(POST_QUERY, {
    variables: {
      slug: params.slug
    },
    request
  });
  if (!result.post) throw data("Notícia não encontrada.", {
    status: 404
  });
  const requestUrl = new URL(request.url);
  const env = getEnv();
  const origin = env.PUBLIC_SITE_URL || requestUrl.origin;
  return {
    ...result,
    canonicalUrl: `${origin}/noticia/${result.post.slug}`,
    apiUrl: env.PUBLIC_GRAPHQL_URL.replace(/\/graphql\/?$/, "")
  };
}
const post = UNSAFE_withComponentProps(function PostRoute() {
  var _a, _b, _c, _d, _e, _f, _g;
  const {
    post: post2,
    comments,
    articleAds,
    latestPosts,
    home: home2,
    me,
    canonicalUrl,
    apiUrl
  } = useLoaderData();
  const site = useSite();
  if (!post2) return null;
  return /* @__PURE__ */ jsxs("div", {
    className: "shell",
    children: [/* @__PURE__ */ jsx(Header, {
      user: me
    }), /* @__PURE__ */ jsxs("main", {
      className: "main",
      children: [/* @__PURE__ */ jsx("script", {
        type: "application/ld+json",
        dangerouslySetInnerHTML: {
          __html: JSON.stringify(articleJsonLd({
            siteUrl: site.siteUrl || new URL(canonicalUrl).origin,
            description: site.seo.description ?? "",
            social: site.social.map((item) => item.url)
          }, {
            title: post2.title,
            description: ((_a = post2.seo) == null ? void 0 : _a.description) ?? post2.subtitle ?? post2.title,
            slug: post2.slug,
            image: post2.coverImage,
            publishedAt: post2.publishedAt,
            updatedAt: post2.updatedAt,
            category: post2.category,
            keywords: ((_b = post2.seo) == null ? void 0 : _b.keywords) ?? [],
            authorName: (_c = post2.author) == null ? void 0 : _c.name,
            sourceName: post2.source.name,
            sourceUrl: post2.source.url
          }))
        }
      }), /* @__PURE__ */ jsxs("div", {
        className: "wrap columns",
        children: [/* @__PURE__ */ jsxs("article", {
          children: [/* @__PURE__ */ jsxs("nav", {
            className: "breadcrumb",
            children: [/* @__PURE__ */ jsx(Link, {
              to: "/",
              children: "Início"
            }), " · ", post2.category]
          }), /* @__PURE__ */ jsx("span", {
            className: "ntv-badge",
            children: post2.category
          }), /* @__PURE__ */ jsx("h1", {
            className: "post__title",
            children: post2.title
          }), post2.subtitle ? /* @__PURE__ */ jsx("p", {
            className: "post__subtitle",
            children: post2.subtitle
          }) : null, /* @__PURE__ */ jsxs("div", {
            className: "byline",
            children: [/* @__PURE__ */ jsx(Avatar, {
              name: ((_d = post2.author) == null ? void 0 : _d.name) ?? "NTV",
              url: (_e = post2.author) == null ? void 0 : _e.avatarUrl,
              size: 40
            }), /* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsxs("strong", {
                style: {
                  color: "var(--ntv-ink)",
                  fontSize: 14
                },
                children: [((_f = post2.author) == null ? void 0 : _f.name) ?? post2.source.name ?? "Redação NTV", " ", post2.author && post2.author.role !== "reader" ? /* @__PURE__ */ jsx("span", {
                  className: "ntv-badge",
                  style: {
                    marginLeft: 4
                  },
                  children: "Equipe"
                }) : null]
              }), /* @__PURE__ */ jsxs("p", {
                className: "ntv-meta",
                style: {
                  marginTop: 2
                },
                children: ["Publicado em ", formatDateTime(post2.publishedAt), post2.updatedAt !== post2.publishedAt ? ` · atualizado em ${formatDateTime(post2.updatedAt)}` : "", post2.credit ? ` · ${post2.credit}` : ""]
              })]
            }), /* @__PURE__ */ jsx("div", {
              className: "byline__actions",
              children: /* @__PURE__ */ jsx(ShareButtons, {
                title: post2.title,
                category: post2.category,
                coverImage: post2.coverImage,
                coverCredit: post2.coverCredit,
                url: canonicalUrl,
                apiUrl
              })
            })]
          }), post2.coverImage ? /* @__PURE__ */ jsx("img", {
            className: "post__cover",
            src: post2.coverImage,
            alt: ""
          }) : /* @__PURE__ */ jsx("div", {
            className: "post__cover",
            "aria-hidden": true
          }), post2.coverCredit ? /* @__PURE__ */ jsx("p", {
            className: "post__credit",
            children: post2.coverCredit
          }) : null, /* @__PURE__ */ jsx("div", {
            className: "post__body",
            dangerouslySetInnerHTML: {
              __html: post2.body
            }
          }), articleAds.length ? /* @__PURE__ */ jsx("a", {
            className: "adslot adslot--in-article",
            href: articleAds[0].targetUrl,
            target: "_blank",
            rel: "noopener sponsored",
            children: articleAds[0].imageUrl ? /* @__PURE__ */ jsx("img", {
              src: articleAds[0].imageUrl,
              alt: articleAds[0].title
            }) : /* @__PURE__ */ jsx("span", {
              className: "adslot__fallback",
              children: articleAds[0].title
            })
          }) : null, post2.tags.length ? /* @__PURE__ */ jsx("div", {
            className: "tags",
            children: post2.tags.map((tag) => /* @__PURE__ */ jsx("span", {
              className: "tag",
              children: tag
            }, tag))
          }) : null, post2.source.type === "rss" && post2.source.url ? /* @__PURE__ */ jsxs("p", {
            className: "ntv-meta",
            style: {
              marginBottom: 24
            },
            children: ["Matéria original:", " ", /* @__PURE__ */ jsx("a", {
              href: post2.source.url,
              target: "_blank",
              rel: "noopener noreferrer",
              style: {
                color: "var(--ntv-link-ext)"
              },
              children: post2.source.name
            })]
          }) : null, post2.author ? /* @__PURE__ */ jsxs("section", {
            className: "authorbox",
            children: [/* @__PURE__ */ jsx(Avatar, {
              name: post2.author.name,
              url: post2.author.avatarUrl,
              size: 48
            }), /* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("h3", {
                children: post2.author.name
              }), /* @__PURE__ */ jsx("p", {
                style: {
                  margin: "0 0 12px",
                  fontSize: 13,
                  lineHeight: 1.5
                },
                children: post2.author.bio ?? "Time de reportagem do NTV News."
              }), /* @__PURE__ */ jsx("a", {
                className: "ntv-btn",
                style: {
                  background: "#fff",
                  color: "var(--ntv-ink)",
                  borderColor: "#fff"
                },
                href: "https://youtube.com/@natorcidavascainos",
                target: "_blank",
                rel: "noopener noreferrer",
                children: "Seguir"
              })]
            })]
          }) : null, /* @__PURE__ */ jsx(Comments, {
            postSlug: post2.slug,
            user: me,
            initial: comments.items,
            total: comments.total
          })]
        }), /* @__PURE__ */ jsx(Sidebar, {
          data: home2,
          latestPosts: latestPosts.items,
          youtubeChannelUrl: (_g = site.social.find((s) => s.network === "youtube")) == null ? void 0 : _g.url
        })]
      })]
    }), /* @__PURE__ */ jsx(Footer, {
      siteName: site.siteName,
      social: site.social,
      ads: site.footerAds
    })]
  });
});
const route2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: post,
  loader: loader$f,
  meta: meta$a
}, Symbol.toStringTag, { value: "Module" }));
const PAGE_SIZE$1 = 25;
function pageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = /* @__PURE__ */ new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) out.push("…");
    out.push(page);
    previous = page;
  }
  return out;
}
function Paginator({ page, total }) {
  const [params] = useSearchParams();
  if (total <= 1) return null;
  const href = (target) => {
    const next = new URLSearchParams(params);
    if (target <= 1) next.delete("pagina");
    else next.set("pagina", String(target));
    const query = next.toString();
    return query ? `?${query}` : "";
  };
  return /* @__PURE__ */ jsxs("nav", { className: "pager", "aria-label": "Paginação", children: [
    /* @__PURE__ */ jsx(
      Link,
      {
        className: `pager__step ${page <= 1 ? "is-disabled" : ""}`,
        to: href(page - 1),
        "aria-disabled": page <= 1,
        preventScrollReset: false,
        children: "‹ Anterior"
      }
    ),
    /* @__PURE__ */ jsx("span", { className: "pager__pages", children: pageNumbers(page, total).map(
      (item, index) => item === "…" ? /* @__PURE__ */ jsx("span", { className: "pager__gap", children: "…" }, `gap-${index}`) : /* @__PURE__ */ jsx(
        Link,
        {
          to: href(item),
          className: `pager__page ${item === page ? "is-current" : ""}`,
          "aria-current": item === page ? "page" : void 0,
          children: item
        },
        item
      )
    ) }),
    /* @__PURE__ */ jsx(
      Link,
      {
        className: `pager__step ${page >= total ? "is-disabled" : ""}`,
        to: href(page + 1),
        "aria-disabled": page >= total,
        children: "Próxima ›"
      }
    )
  ] });
}
function NewsListPage({
  title,
  subtitle,
  items,
  total,
  page,
  pageCount,
  user,
  children,
  empty
}) {
  const site = useSite();
  return /* @__PURE__ */ jsxs("div", { className: "shell", children: [
    /* @__PURE__ */ jsx(Header, { user }),
    /* @__PURE__ */ jsxs("main", { className: "main", children: [
      site.siteUrl && items.length ? /* @__PURE__ */ jsx(
        "script",
        {
          type: "application/ld+json",
          dangerouslySetInnerHTML: {
            __html: JSON.stringify(
              itemListJsonLd(
                {
                  siteUrl: site.siteUrl,
                  description: site.seo.description ?? "",
                  social: site.social.map((s) => s.url)
                },
                items,
                title
              )
            )
          }
        }
      ) : null,
      /* @__PURE__ */ jsxs("div", { className: "wrap", children: [
        /* @__PURE__ */ jsxs("div", { className: "section__head", children: [
          /* @__PURE__ */ jsx("span", { className: "section__rule" }),
          /* @__PURE__ */ jsx("h1", { className: "section__title", children: title }),
          total ? /* @__PURE__ */ jsxs("span", { className: "section__more", children: [
            total.toLocaleString("pt-BR"),
            " ",
            total === 1 ? "publicação" : "publicações"
          ] }) : null
        ] }),
        subtitle ? /* @__PURE__ */ jsx("p", { className: "listpage__subtitle", children: subtitle }) : null,
        children,
        items.length ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("div", { className: "newslist", children: items.map((post2) => /* @__PURE__ */ jsx(NewsRow, { post: post2 }, post2.id)) }),
          /* @__PURE__ */ jsx(Paginator, { page, total: pageCount })
        ] }) : empty ?? /* @__PURE__ */ jsx("p", { className: "ntv-meta listpage__empty", children: "Nada por aqui ainda." })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Footer, { siteName: site.siteName, social: site.social, ads: site.footerAds })
  ] });
}
const meta$9 = ({
  matches
}) => pageMeta({
  matches,
  path: "/noticias",
  title: "Notícias do Vasco",
  description: "Todas as notícias do Vasco da Gama publicadas no NTV News, atualizadas o dia todo."
});
async function loader$e({
  request
}) {
  const page = Math.max(1, Number(new URL(request.url).searchParams.get("pagina") ?? 1));
  const data2 = await gql(NEWS_LIST_QUERY, {
    request,
    variables: {
      filter: {},
      limit: PAGE_SIZE$1,
      offset: (page - 1) * PAGE_SIZE$1
    }
  });
  return {
    ...data2,
    page
  };
}
const noticias = UNSAFE_withComponentProps(function NoticiasRoute() {
  const {
    posts,
    me,
    page
  } = useLoaderData();
  return /* @__PURE__ */ jsx(NewsListPage, {
    title: "Notícias",
    items: posts.items,
    total: posts.total,
    page,
    pageCount: Math.ceil(posts.total / PAGE_SIZE$1),
    user: me
  });
});
const route3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: noticias,
  loader: loader$e,
  meta: meta$9
}, Symbol.toStringTag, { value: "Module" }));
const CATEGORY = "NTV Exclusivo";
const meta$8 = ({
  matches
}) => pageMeta({
  matches,
  path: "/ntv-exclusivo",
  title: "NTV Exclusivo",
  description: "Apuração própria da equipe do NTV News sobre o Vasco da Gama — sem agregação."
});
async function loader$d({
  request
}) {
  const page = Math.max(1, Number(new URL(request.url).searchParams.get("pagina") ?? 1));
  const data2 = await gql(NEWS_LIST_QUERY, {
    request,
    variables: {
      filter: {
        category: CATEGORY
      },
      limit: PAGE_SIZE$1,
      offset: (page - 1) * PAGE_SIZE$1
    }
  });
  return {
    ...data2,
    page
  };
}
const exclusivo = UNSAFE_withComponentProps(function ExclusivoRoute() {
  const {
    posts,
    me,
    page
  } = useLoaderData();
  return /* @__PURE__ */ jsx(NewsListPage, {
    title: "NTV Exclusivo",
    subtitle: "Apuração própria da equipe — sem agregação de outras fontes.",
    items: posts.items,
    total: posts.total,
    page,
    pageCount: Math.ceil(posts.total / PAGE_SIZE$1),
    user: me,
    empty: /* @__PURE__ */ jsx("p", {
      className: "ntv-meta listpage__empty",
      children: 'Nenhuma matéria exclusiva publicada ainda. Elas aparecem aqui assim que a equipe publicar com a categoria "NTV Exclusivo".'
    })
  });
});
const route4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: exclusivo,
  loader: loader$d,
  meta: meta$8
}, Symbol.toStringTag, { value: "Module" }));
const meta$7 = ({
  matches
}) => pageMeta({
  matches,
  path: "/tabela",
  title: "Tabela e chaveamento",
  description: "Classificação do Vasco no Brasileirão e o chaveamento completo da Copa do Brasil e da Sul-Americana."
});
async function loader$c({
  request
}) {
  return gql(STANDINGS_QUERY, {
    request
  });
}
function zoneOf(position, size) {
  if (size < 20) return "";
  if (position <= 4) return "zone--libertadores";
  if (position <= 6) return "zone--pre";
  if (position <= 12) return "zone--sula";
  if (position > size - 4) return "zone--rebaixamento";
  return "";
}
const tieDate = (iso) => iso ? new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit"
}).format(new Date(iso)) : null;
function BracketView({
  bracket,
  standalone
}) {
  const rounds = [...bracket.rounds].reverse();
  return /* @__PURE__ */ jsxs("section", {
    className: standalone ? "" : "section",
    style: standalone ? void 0 : {
      marginTop: 48
    },
    children: [!standalone ? /* @__PURE__ */ jsxs("div", {
      className: "section__head",
      children: [/* @__PURE__ */ jsx("span", {
        className: "section__rule"
      }), /* @__PURE__ */ jsx("h2", {
        className: "section__title",
        children: "Chaveamento"
      })]
    }) : /* @__PURE__ */ jsx("h2", {
      className: "table__title",
      children: bracket.competition
    }), rounds.map((round) => /* @__PURE__ */ jsxs("div", {
      className: "bracket__round",
      children: [/* @__PURE__ */ jsx("h3", {
        className: "bracket__phase",
        children: round.name
      }), /* @__PURE__ */ jsx("div", {
        className: "bracket__ties",
        children: round.ties.map((tie, index) => /* @__PURE__ */ jsxs("div", {
          className: `tie ${tie.highlight ? "tie--highlight" : ""}`,
          children: [/* @__PURE__ */ jsx("span", {
            className: "tie__team tie__team--home",
            children: tie.home
          }), /* @__PURE__ */ jsx("span", {
            className: "tie__score",
            children: tie.score ?? tieDate(tie.date) ?? "×"
          }), /* @__PURE__ */ jsx("span", {
            className: "tie__team",
            children: tie.away
          })]
        }, `${round.name}-${index}`))
      })]
    }, round.name)), /* @__PURE__ */ jsxs("p", {
      className: "ntv-meta table__source",
      children: [bracket.lastSyncAt ? `Atualizado em ${formatDateTime(bracket.lastSyncAt)} · ` : "", "dados do Transfermarkt"]
    })]
  });
}
const tabela = UNSAFE_withComponentProps(function TabelaRoute() {
  var _a;
  const {
    standings,
    brackets,
    me
  } = useLoaderData();
  const site = useSite();
  const tabs = [...standings.map((standing) => ({
    kind: "standing",
    key: standing.key,
    label: standing.competition,
    standing
  })), ...brackets.filter((bracket2) => !standings.some((standing) => standing.key === bracket2.key)).map((bracket2) => ({
    kind: "bracket",
    key: bracket2.key,
    label: bracket2.competition,
    bracket: bracket2
  }))];
  const [params] = useSearchParams();
  const active = params.get("competicao") ?? ((_a = tabs[0]) == null ? void 0 : _a.key) ?? "";
  const tab = tabs.find((item) => item.key === active) ?? tabs[0];
  const current = (tab == null ? void 0 : tab.kind) === "standing" ? tab.standing : null;
  const bracket = (tab == null ? void 0 : tab.kind) === "bracket" ? tab.bracket : brackets.find((item) => item.key === (tab == null ? void 0 : tab.key)) ?? null;
  return /* @__PURE__ */ jsxs("div", {
    className: "shell",
    children: [/* @__PURE__ */ jsx(Header, {
      user: me
    }), /* @__PURE__ */ jsx("main", {
      className: "main",
      children: /* @__PURE__ */ jsxs("div", {
        className: "wrap",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "section__head",
          children: [/* @__PURE__ */ jsx("span", {
            className: "section__rule"
          }), /* @__PURE__ */ jsx("h1", {
            className: "section__title",
            children: "Tabela"
          })]
        }), tabs.length > 1 ? /* @__PURE__ */ jsx("div", {
          className: "chips",
          role: "tablist",
          "aria-label": "Competições",
          children: tabs.map((item) => /* @__PURE__ */ jsx(Link, {
            to: `?competicao=${item.key}`,
            role: "tab",
            className: "chip",
            "aria-selected": item.key === (tab == null ? void 0 : tab.key),
            "aria-pressed": item.key === (tab == null ? void 0 : tab.key),
            preventScrollReset: true,
            children: item.label
          }, item.key))
        }) : null, current ? /* @__PURE__ */ jsxs(Fragment, {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "table__title",
            children: current.competition
          }), /* @__PURE__ */ jsx("div", {
            className: "tablewrap",
            children: /* @__PURE__ */ jsxs("table", {
              className: "standings",
              children: [/* @__PURE__ */ jsx("thead", {
                children: /* @__PURE__ */ jsxs("tr", {
                  children: [/* @__PURE__ */ jsx("th", {
                    className: "standings__pos",
                    children: "#"
                  }), /* @__PURE__ */ jsx("th", {
                    className: "standings__team",
                    children: "Time"
                  }), /* @__PURE__ */ jsx("th", {
                    children: "P"
                  }), /* @__PURE__ */ jsx("th", {
                    children: "J"
                  }), /* @__PURE__ */ jsx("th", {
                    className: "standings__wide",
                    children: "V"
                  }), /* @__PURE__ */ jsx("th", {
                    className: "standings__wide",
                    children: "E"
                  }), /* @__PURE__ */ jsx("th", {
                    className: "standings__wide",
                    children: "D"
                  }), /* @__PURE__ */ jsx("th", {
                    className: "standings__wide",
                    children: "GP"
                  }), /* @__PURE__ */ jsx("th", {
                    className: "standings__wide",
                    children: "GC"
                  }), /* @__PURE__ */ jsx("th", {
                    children: "SG"
                  })]
                })
              }), /* @__PURE__ */ jsx("tbody", {
                children: current.rows.map((row) => /* @__PURE__ */ jsxs("tr", {
                  className: `${row.highlight ? "is-highlight" : ""} ${zoneOf(row.position, current.rows.length)}`,
                  children: [/* @__PURE__ */ jsx("td", {
                    className: "standings__pos",
                    children: row.position
                  }), /* @__PURE__ */ jsx("td", {
                    className: "standings__team",
                    children: row.team
                  }), /* @__PURE__ */ jsx("td", {
                    children: /* @__PURE__ */ jsx("strong", {
                      children: row.points
                    })
                  }), /* @__PURE__ */ jsx("td", {
                    children: row.played
                  }), /* @__PURE__ */ jsx("td", {
                    className: "standings__wide",
                    children: row.wins
                  }), /* @__PURE__ */ jsx("td", {
                    className: "standings__wide",
                    children: row.draws
                  }), /* @__PURE__ */ jsx("td", {
                    className: "standings__wide",
                    children: row.losses
                  }), /* @__PURE__ */ jsx("td", {
                    className: "standings__wide",
                    children: row.goalsFor
                  }), /* @__PURE__ */ jsx("td", {
                    className: "standings__wide",
                    children: row.goalsAgainst
                  }), /* @__PURE__ */ jsx("td", {
                    children: row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff
                  })]
                }, `${row.position}-${row.team}`))
              })]
            })
          }), current.rows.length >= 20 ? /* @__PURE__ */ jsxs("ul", {
            className: "table__legend",
            children: [/* @__PURE__ */ jsxs("li", {
              children: [/* @__PURE__ */ jsx("span", {
                className: "dot zone--libertadores"
              }), " Libertadores"]
            }), /* @__PURE__ */ jsxs("li", {
              children: [/* @__PURE__ */ jsx("span", {
                className: "dot zone--pre"
              }), " Pré-Libertadores"]
            }), /* @__PURE__ */ jsxs("li", {
              children: [/* @__PURE__ */ jsx("span", {
                className: "dot zone--sula"
              }), " Sul-Americana"]
            }), /* @__PURE__ */ jsxs("li", {
              children: [/* @__PURE__ */ jsx("span", {
                className: "dot zone--rebaixamento"
              }), " Rebaixamento"]
            })]
          }) : null, /* @__PURE__ */ jsxs("p", {
            className: "ntv-meta table__source",
            children: [current.lastSyncAt ? `Atualizado em ${formatDateTime(current.lastSyncAt)}` : "", current.sourceUrl ? " · dados do Transfermarkt" : ""]
          })]
        }) : null, bracket ? /* @__PURE__ */ jsx(BracketView, {
          bracket,
          standalone: !current
        }) : null, !current && !bracket ? /* @__PURE__ */ jsx("p", {
          className: "ntv-meta listpage__empty",
          children: "Nenhuma competição sincronizada ainda. O admin atualiza em Jogos → Sincronizar."
        }) : null]
      })
    }), /* @__PURE__ */ jsx(Footer, {
      siteName: site.siteName,
      social: site.social,
      ads: site.footerAds
    })]
  });
});
const route5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: tabela,
  loader: loader$c,
  meta: meta$7
}, Symbol.toStringTag, { value: "Module" }));
const SORTS = [{
  key: "fonte",
  label: "Ordem do mercado"
}, {
  key: "aprovacao",
  label: "Mais aprovados"
}, {
  key: "votos",
  label: "Mais votados"
}, {
  key: "valor",
  label: "Maior valor"
}];
const meta$6 = ({
  matches
}) => pageMeta({
  matches,
  path: "/mercado",
  title: "Mercado da Bola",
  description: "Todas as especulações de contratação do Vasco na janela atual. Vote se aprova ou reprova cada nome."
});
async function loader$b({
  request
}) {
  return gql(MARKET_QUERY, {
    request
  });
}
function feeToNumber(fee) {
  var _a, _b;
  if (!fee) return 0;
  const value = Number((_b = (_a = /([\d.,]+)/.exec(fee)) == null ? void 0 : _a[1]) == null ? void 0 : _b.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(value)) return 0;
  if (/mi/i.test(fee)) return value * 1e6;
  if (/mil/i.test(fee)) return value * 1e3;
  return value;
}
function RumourCard({
  rumour
}) {
  var _a, _b;
  const fetcher = useFetcher();
  const fresh = ((_a = fetcher.data) == null ? void 0 : _a.id) === rumour.id ? fetcher.data : null;
  const voted = rumour.myVote ?? (fresh == null ? void 0 : fresh.myVote) ?? null;
  const percent = (fresh == null ? void 0 : fresh.goodPercent) ?? rumour.goodPercent ?? 0;
  const votes = voted && !rumour.myVote ? rumour.totalVotes + 1 : rumour.totalVotes;
  return /* @__PURE__ */ jsxs("article", {
    className: "rumour",
    children: [/* @__PURE__ */ jsxs("div", {
      className: "rumour__head",
      children: [rumour.player.photo ? /* @__PURE__ */ jsx("img", {
        className: "rumour__photo",
        src: rumour.player.photo,
        alt: "",
        loading: "lazy"
      }) : /* @__PURE__ */ jsx("span", {
        className: "rumour__photo rumour__photo--empty",
        "aria-hidden": true
      }), /* @__PURE__ */ jsxs("div", {
        style: {
          minWidth: 0
        },
        children: [/* @__PURE__ */ jsx("h2", {
          className: "rumour__name",
          children: rumour.player.name
        }), /* @__PURE__ */ jsx("p", {
          className: "ntv-meta",
          children: [rumour.player.position, rumour.player.club].filter(Boolean).join(" · ") || "—"
        })]
      }), rumour.probability != null ? /* @__PURE__ */ jsxs("span", {
        className: "rumour__odds",
        title: "Probabilidade estimada pela fonte",
        children: [rumour.probability, "%"]
      }) : null]
    }), rumour.fee ? /* @__PURE__ */ jsxs("p", {
      className: "rumour__fee",
      children: ["Valor especulado: ", rumour.fee]
    }) : null, /* @__PURE__ */ jsx("div", {
      className: "bar",
      children: /* @__PURE__ */ jsx("div", {
        className: "bar__fill",
        style: {
          width: `${percent}%`
        }
      })
    }), /* @__PURE__ */ jsxs("div", {
      className: "rumour__legend",
      children: [/* @__PURE__ */ jsxs("span", {
        children: [/* @__PURE__ */ jsxs("strong", {
          children: [percent, "%"]
        }), " aprova"]
      }), /* @__PURE__ */ jsxs("span", {
        children: [votes, " ", votes === 1 ? "voto" : "votos"]
      })]
    }), voted ? /* @__PURE__ */ jsxs("p", {
      className: "rumour__voted",
      children: ["Você ", voted === "good" ? "aprovou" : "reprovou", " esta contratação."]
    }) : /* @__PURE__ */ jsxs(fetcher.Form, {
      method: "post",
      action: "/api/votar",
      className: "rumour__actions",
      children: [/* @__PURE__ */ jsx("input", {
        type: "hidden",
        name: "pollId",
        value: rumour.id
      }), /* @__PURE__ */ jsx("button", {
        className: "ntv-btn",
        name: "choice",
        value: "good",
        children: "Aprovo"
      }), /* @__PURE__ */ jsx("button", {
        className: "ntv-btn ntv-btn--outline",
        name: "choice",
        value: "bad",
        children: "Reprovo"
      })]
    }), ((_b = fetcher.data) == null ? void 0 : _b.error) ? /* @__PURE__ */ jsx("p", {
      className: "alert",
      children: fetcher.data.error
    }) : null]
  });
}
const mercado = UNSAFE_withComponentProps(function MercadoRoute() {
  var _a;
  const {
    polls,
    signings,
    settings,
    me
  } = useLoaderData();
  const site = useSite();
  const [sort, setSort] = useState("fonte");
  const ordered = useMemo(() => {
    const list = [...polls];
    if (sort === "aprovacao") {
      list.sort((a, b) => {
        if (!a.totalVotes && !b.totalVotes) return 0;
        if (!a.totalVotes) return 1;
        if (!b.totalVotes) return -1;
        return (b.goodPercent ?? 0) - (a.goodPercent ?? 0);
      });
    }
    if (sort === "votos") list.sort((a, b) => b.totalVotes - a.totalVotes);
    if (sort === "valor") list.sort((a, b) => feeToNumber(b.fee) - feeToNumber(a.fee));
    return list;
  }, [polls, sort]);
  const totalVotes = polls.reduce((sum, poll) => sum + poll.totalVotes, 0);
  const voted = polls.filter((poll) => poll.myVote).length;
  return /* @__PURE__ */ jsxs("div", {
    className: "shell",
    children: [/* @__PURE__ */ jsx(Header, {
      user: me
    }), /* @__PURE__ */ jsx("main", {
      className: "main",
      children: /* @__PURE__ */ jsxs("div", {
        className: "wrap",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "section__head",
          children: [/* @__PURE__ */ jsx("span", {
            className: "section__rule"
          }), /* @__PURE__ */ jsx("h1", {
            className: "section__title",
            children: "Mercado da Bola"
          }), /* @__PURE__ */ jsxs("span", {
            className: "section__more",
            children: [polls.length, " especulações"]
          })]
        }), /* @__PURE__ */ jsx("p", {
          className: "listpage__subtitle",
          children: "Todos os nomes especulados no Vasco na janela atual. Vote se aprova ou reprova cada contratação — o resultado é o que a torcida acha, não a probabilidade do negócio sair."
        }), /* @__PURE__ */ jsxs("section", {
          className: "market__stats",
          children: [/* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("strong", {
              children: polls.length
            }), /* @__PURE__ */ jsx("span", {
              children: "nomes na janela"
            })]
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("strong", {
              children: totalVotes.toLocaleString("pt-BR")
            }), /* @__PURE__ */ jsx("span", {
              children: "votos da torcida"
            })]
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("strong", {
              children: signings.length
            }), /* @__PURE__ */ jsx("span", {
              children: "já confirmados"
            })]
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsxs("strong", {
              children: [voted, "/", polls.length]
            }), /* @__PURE__ */ jsx("span", {
              children: "você já votou"
            })]
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "market__toolbar",
          children: [/* @__PURE__ */ jsx("label", {
            className: "ntv-meta",
            htmlFor: "ordenar",
            children: "Ordenar por"
          }), /* @__PURE__ */ jsx("select", {
            id: "ordenar",
            className: "ntv-select",
            value: sort,
            onChange: (e) => setSort(e.target.value),
            children: SORTS.map((option) => /* @__PURE__ */ jsx("option", {
              value: option.key,
              children: option.label
            }, option.key))
          })]
        }), ordered.length ? /* @__PURE__ */ jsx("div", {
          className: "market__grid",
          children: ordered.map((rumour) => /* @__PURE__ */ jsx(RumourCard, {
            rumour
          }, rumour.id))
        }) : /* @__PURE__ */ jsx("p", {
          className: "ntv-meta listpage__empty",
          children: "Nenhuma especulação na janela atual. O admin atualiza em Jogos → Sincronizar."
        }), signings.length ? /* @__PURE__ */ jsxs("section", {
          className: "section",
          style: {
            marginTop: 48
          },
          children: [/* @__PURE__ */ jsxs("div", {
            className: "section__head",
            children: [/* @__PURE__ */ jsx("span", {
              className: "section__rule"
            }), /* @__PURE__ */ jsx("h2", {
              className: "section__title",
              children: "Já confirmados na temporada"
            })]
          }), /* @__PURE__ */ jsx("div", {
            className: "market__signings",
            children: signings.map((signing) => /* @__PURE__ */ jsxs("div", {
              className: "signing",
              children: [signing.photo ? /* @__PURE__ */ jsx("img", {
                className: "signing__photo",
                src: signing.photo,
                alt: "",
                loading: "lazy"
              }) : /* @__PURE__ */ jsx("span", {
                className: "signing__photo signing__photo--empty",
                "aria-hidden": true
              }), /* @__PURE__ */ jsxs("span", {
                style: {
                  minWidth: 0
                },
                children: [/* @__PURE__ */ jsx("strong", {
                  className: "signing__name",
                  children: signing.playerName
                }), /* @__PURE__ */ jsx("span", {
                  className: "ntv-meta",
                  children: [signing.position, signing.club].filter(Boolean).join(" · ") || "Reforço"
                })]
              }), signing.fee ? /* @__PURE__ */ jsx("span", {
                className: "signing__fee",
                children: signing.fee
              }) : null]
            }, signing.id))
          })]
        }) : null, /* @__PURE__ */ jsxs("p", {
          className: "ntv-meta table__source",
          children: [((_a = settings.matches) == null ? void 0 : _a.lastSyncAt) ? `Atualizado em ${formatDateTime(settings.matches.lastSyncAt)} · ` : "", "especulações e transferências do Transfermarkt"]
        })]
      })
    }), /* @__PURE__ */ jsx(Footer, {
      siteName: site.siteName,
      social: site.social,
      ads: site.footerAds
    })]
  });
});
const route6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: mercado,
  loader: loader$b,
  meta: meta$6
}, Symbol.toStringTag, { value: "Module" }));
const meta$5 = ({
  matches
}) => pageMeta({
  matches,
  path: "/busca",
  title: "Busca",
  description: "Busque notícias do Vasco no NTV News.",
  noindex: true
});
async function loader$a({
  request
}) {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim();
  const page = Math.max(1, Number(params.get("pagina") ?? 1));
  if (!q) {
    return {
      q,
      page,
      searchPosts: {
        total: 0,
        hasMore: false,
        fallback: false,
        items: []
      },
      me: null
    };
  }
  const data2 = await gql(SEARCH_QUERY, {
    request,
    variables: {
      q,
      limit: PAGE_SIZE$1,
      offset: (page - 1) * PAGE_SIZE$1
    }
  });
  return {
    ...data2,
    q,
    page
  };
}
const busca = UNSAFE_withComponentProps(function BuscaRoute() {
  const {
    searchPosts,
    me,
    q,
    page
  } = useLoaderData();
  return /* @__PURE__ */ jsxs(NewsListPage, {
    title: q ? `Busca: ${q}` : "Busca",
    items: searchPosts.items,
    total: searchPosts.total,
    page,
    pageCount: Math.ceil(searchPosts.total / PAGE_SIZE$1),
    user: me,
    empty: q ? /* @__PURE__ */ jsxs("p", {
      className: "ntv-meta listpage__empty",
      children: ["Nada encontrado para ", /* @__PURE__ */ jsx("strong", {
        children: q
      }), ". Tente outro termo ou o nome do jogador."]
    }) : /* @__PURE__ */ jsx("p", {
      className: "ntv-meta listpage__empty",
      children: "Digite algo para buscar nas notícias."
    }),
    children: [/* @__PURE__ */ jsxs(Form, {
      method: "get",
      className: "searchbar",
      role: "search",
      children: [/* @__PURE__ */ jsx("input", {
        className: "ntv-input",
        type: "search",
        name: "q",
        defaultValue: q,
        placeholder: "Buscar notícias, jogadores, competições…",
        "aria-label": "Buscar"
      }), /* @__PURE__ */ jsx("button", {
        className: "ntv-btn",
        children: "Buscar"
      })]
    }), q && searchPosts.fallback && searchPosts.total > 0 ? /* @__PURE__ */ jsx("p", {
      className: "ntv-meta listpage__note",
      children: "Sem resultado exato — mostrando notícias que mencionam o termo."
    }) : null]
  });
});
const route7 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: busca,
  loader: loader$a,
  meta: meta$5
}, Symbol.toStringTag, { value: "Module" }));
const PAGE_SIZE = 12;
const meta$4 = ({
  matches
}) => pageMeta({
  matches,
  path: "/loja",
  title: "Loja NTV",
  description: "Camisas, acessórios e produtos do Vasco com link direto para o marketplace."
});
async function loader$9({
  request
}) {
  const url = new URL(request.url);
  const p = url.searchParams;
  const num = (key) => p.get(key) ? Number(p.get(key)) : void 0;
  return gql(SHOP_QUERY, {
    request,
    variables: {
      filter: {
        category: p.get("categoria") || void 0,
        marketplace: p.get("marketplace") || void 0,
        minPrice: num("min"),
        maxPrice: num("max"),
        search: p.get("q") || void 0
      },
      sort: p.get("ordenar") || "recent",
      limit: PAGE_SIZE,
      offset: Number(p.get("offset") ?? 0)
    }
  });
}
function BuyButton({
  product
}) {
  const fetcher = useFetcher();
  if (product.soldOut) {
    return /* @__PURE__ */ jsx("button", {
      className: "ntv-btn product__buy",
      disabled: true,
      children: "Indisponível"
    });
  }
  return /* @__PURE__ */ jsx("a", {
    className: "ntv-btn product__buy",
    href: product.externalUrl,
    target: "_blank",
    rel: "noopener sponsored",
    onClick: () => fetcher.submit({
      id: product.id
    }, {
      method: "post",
      action: "/api/clique-loja"
    }),
    children: "Comprar ↗"
  });
}
function ProductCard({
  product
}) {
  return /* @__PURE__ */ jsxs("article", {
    className: `product ${product.soldOut ? "product--out" : ""}`,
    children: [product.imageUrl ? /* @__PURE__ */ jsx("img", {
      className: "product__media",
      src: product.imageUrl,
      alt: ""
    }) : /* @__PURE__ */ jsx("div", {
      className: "product__media",
      "aria-hidden": true
    }), /* @__PURE__ */ jsxs("div", {
      className: "product__body",
      children: [/* @__PURE__ */ jsxs("div", {
        style: {
          display: "flex",
          gap: 6
        },
        children: [product.highlighted ? /* @__PURE__ */ jsx("span", {
          className: "ntv-badge",
          children: "Destaque"
        }) : null, product.soldOut ? /* @__PURE__ */ jsx("span", {
          className: "ntv-badge ntv-badge--mute",
          children: "Esgotado"
        }) : null]
      }), /* @__PURE__ */ jsx("h3", {
        className: "product__title",
        children: product.title
      }), /* @__PURE__ */ jsx("span", {
        className: "product__price",
        children: formatPrice(product.price)
      }), /* @__PURE__ */ jsx("span", {
        className: "product__market",
        children: product.marketplace
      }), /* @__PURE__ */ jsx(BuyButton, {
        product
      })]
    })]
  });
}
const loja = UNSAFE_withComponentProps(function LojaRoute() {
  const {
    products,
    me
  } = useLoaderData();
  const site = useSite();
  const [params, setParams] = useSearchParams();
  const submit = useSubmit();
  const fetcher = useFetcher();
  const [extra, setExtra] = useState([]);
  const [drawer, setDrawer] = useState(false);
  useEffect(() => setExtra([]), [params.toString()]);
  useEffect(() => {
    var _a, _b;
    const incoming = (_b = (_a = fetcher.data) == null ? void 0 : _a.products) == null ? void 0 : _b.items;
    if (incoming == null ? void 0 : incoming.length) setExtra((prev) => [...prev, ...incoming]);
  }, [fetcher.data]);
  const items = [...products.items, ...extra];
  const hasMore = fetcher.data ? fetcher.data.products.hasMore : products.hasMore;
  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (!value || next.get(key) === value) next.delete(key);
    else next.set(key, value);
    next.delete("offset");
    setParams(next, {
      preventScrollReset: true
    });
  };
  const loadMore = () => {
    const next = new URLSearchParams(params);
    next.set("offset", String(items.length));
    fetcher.load(`/loja?${next.toString()}`);
  };
  const filters = /* @__PURE__ */ jsxs(Fragment, {
    children: [/* @__PURE__ */ jsxs("section", {
      className: "widget",
      children: [/* @__PURE__ */ jsx("h2", {
        className: "widget__title",
        children: "Categoria"
      }), products.categories.map((c) => /* @__PURE__ */ jsxs("label", {
        className: "checkline",
        style: {
          margin: "6px 0"
        },
        children: [/* @__PURE__ */ jsx("input", {
          type: "checkbox",
          checked: params.get("categoria") === c.value,
          onChange: () => setFilter("categoria", c.value)
        }), /* @__PURE__ */ jsx("span", {
          style: {
            flex: 1
          },
          children: c.value
        }), /* @__PURE__ */ jsx("span", {
          className: "ntv-meta",
          children: c.count
        })]
      }, c.value))]
    }), /* @__PURE__ */ jsxs("section", {
      className: "widget",
      children: [/* @__PURE__ */ jsx("h2", {
        className: "widget__title",
        children: "Preço"
      }), /* @__PURE__ */ jsxs(Form, {
        onChange: (e) => submit(e.currentTarget, {
          preventScrollReset: true
        }),
        style: {
          display: "flex",
          gap: 8
        },
        children: [[...params.entries()].filter(([k]) => !["min", "max", "offset"].includes(k)).map(([k, v]) => /* @__PURE__ */ jsx("input", {
          type: "hidden",
          name: k,
          value: v
        }, k)), /* @__PURE__ */ jsx("input", {
          className: "ntv-input",
          type: "number",
          name: "min",
          placeholder: String(Math.floor(products.priceRange.min)),
          defaultValue: params.get("min") ?? "",
          "aria-label": "Preço mínimo"
        }), /* @__PURE__ */ jsx("input", {
          className: "ntv-input",
          type: "number",
          name: "max",
          placeholder: String(Math.ceil(products.priceRange.max)),
          defaultValue: params.get("max") ?? "",
          "aria-label": "Preço máximo"
        })]
      })]
    }), /* @__PURE__ */ jsxs("section", {
      className: "widget",
      children: [/* @__PURE__ */ jsx("h2", {
        className: "widget__title",
        children: "Marketplace"
      }), products.marketplaces.map((m) => /* @__PURE__ */ jsxs("label", {
        className: "checkline",
        style: {
          margin: "6px 0"
        },
        children: [/* @__PURE__ */ jsx("input", {
          type: "checkbox",
          checked: params.get("marketplace") === m.value,
          onChange: () => setFilter("marketplace", m.value)
        }), /* @__PURE__ */ jsx("span", {
          style: {
            flex: 1
          },
          children: m.value
        }), /* @__PURE__ */ jsx("span", {
          className: "ntv-meta",
          children: m.count
        })]
      }, m.value))]
    }), /* @__PURE__ */ jsx("button", {
      type: "button",
      className: "ntv-btn ntv-btn--outline",
      style: {
        width: "100%"
      },
      onClick: () => setParams(new URLSearchParams(), {
        preventScrollReset: true
      }),
      children: "Limpar filtros"
    })]
  });
  return /* @__PURE__ */ jsxs("div", {
    className: "shell",
    children: [/* @__PURE__ */ jsx(Header, {
      user: me
    }), /* @__PURE__ */ jsx("main", {
      className: "main",
      children: /* @__PURE__ */ jsxs("div", {
        className: "wrap",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "section__head",
          children: [/* @__PURE__ */ jsx("span", {
            className: "section__rule"
          }), /* @__PURE__ */ jsx("h1", {
            className: "section__title",
            children: "Loja NTV"
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "shop",
          children: [/* @__PURE__ */ jsx("div", {
            className: "filters sidebar",
            children: filters
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsxs("div", {
              className: "chips",
              children: [/* @__PURE__ */ jsx("button", {
                type: "button",
                className: "chip",
                "aria-pressed": !params.get("categoria"),
                onClick: () => setFilter("categoria", null),
                children: "Tudo"
              }), products.categories.map((c) => /* @__PURE__ */ jsx("button", {
                type: "button",
                className: "chip",
                "aria-pressed": params.get("categoria") === c.value,
                onClick: () => setFilter("categoria", c.value),
                children: c.value
              }, c.value)), /* @__PURE__ */ jsx("button", {
                type: "button",
                className: "chip",
                onClick: () => setDrawer(true),
                children: "☰ Filtrar"
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "shop__toolbar",
              children: [/* @__PURE__ */ jsxs("span", {
                children: [products.total, " produtos"]
              }), /* @__PURE__ */ jsxs("select", {
                className: "ntv-select",
                "aria-label": "Ordenar",
                value: params.get("ordenar") ?? "recent",
                onChange: (e) => setFilter("ordenar", e.target.value),
                children: [/* @__PURE__ */ jsx("option", {
                  value: "recent",
                  children: "Mais recentes"
                }), /* @__PURE__ */ jsx("option", {
                  value: "price_asc",
                  children: "Menor preço"
                }), /* @__PURE__ */ jsx("option", {
                  value: "price_desc",
                  children: "Maior preço"
                }), /* @__PURE__ */ jsx("option", {
                  value: "title",
                  children: "A–Z"
                })]
              })]
            }), /* @__PURE__ */ jsx("div", {
              className: "productgrid",
              children: items.map((product) => /* @__PURE__ */ jsx(ProductCard, {
                product
              }, product.id))
            }), hasMore ? /* @__PURE__ */ jsx("button", {
              type: "button",
              className: "ntv-btn ntv-btn--outline loadmore",
              disabled: fetcher.state !== "idle",
              onClick: loadMore,
              children: fetcher.state === "idle" ? "Carregar mais produtos" : "Carregando…"
            }) : null]
          })]
        })]
      })
    }), drawer ? /* @__PURE__ */ jsx("div", {
      className: "backdrop",
      onClick: () => setDrawer(false),
      children: /* @__PURE__ */ jsxs("div", {
        className: "modal",
        style: {
          maxHeight: "80vh",
          overflowY: "auto"
        },
        onClick: (e) => e.stopPropagation(),
        children: [/* @__PURE__ */ jsxs("div", {
          className: "modal__head",
          children: ["Filtrar", /* @__PURE__ */ jsx("button", {
            className: "modal__close",
            onClick: () => setDrawer(false),
            "aria-label": "Fechar",
            children: "✕"
          })]
        }), /* @__PURE__ */ jsx("div", {
          className: "modal__body sidebar",
          children: filters
        })]
      })
    }) : null, /* @__PURE__ */ jsx(Footer, {
      siteName: site.siteName,
      social: site.social,
      ads: site.footerAds
    })]
  });
});
const route8 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: loja,
  loader: loader$9,
  meta: meta$4
}, Symbol.toStringTag, { value: "Module" }));
const MAX_BYTES = 2 * 1024 * 1024;
function AvatarUpload({
  apiUrl,
  name = "avatarUrl",
  initial,
  size = 88
}) {
  const input = useRef(null);
  const [preview, setPreview] = useState(initial ?? null);
  const [url, setUrl] = useState(initial ?? "");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  async function onPick(file) {
    setError(null);
    if (file.size > MAX_BYTES) return setError("Arquivo maior que 2 MB.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return setError("Envie JPG ou PNG.");
    }
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`${apiUrl}/upload`, { method: "POST", body });
      const payload = await response.json();
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "Falha no upload.");
      setUrl(payload.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no upload.");
      setPreview(initial ?? null);
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ jsxs("div", { className: "avatarpick", children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        className: "avatarpick__circle",
        style: { width: size, height: size },
        onClick: () => {
          var _a;
          return (_a = input.current) == null ? void 0 : _a.click();
        },
        "aria-label": "Enviar foto de perfil",
        children: [
          preview ? /* @__PURE__ */ jsx("img", { src: preview, alt: "" }) : /* @__PURE__ */ jsx("span", { style: { fontSize: 22 }, children: "👤" }),
          /* @__PURE__ */ jsx("span", { className: "avatarpick__cam", "aria-hidden": true, children: "📷" })
        ]
      }
    ),
    /* @__PURE__ */ jsx(
      "input",
      {
        ref: input,
        type: "file",
        accept: "image/jpeg,image/png,image/webp",
        hidden: true,
        onChange: (e) => {
          var _a;
          const file = (_a = e.target.files) == null ? void 0 : _a[0];
          if (file) void onPick(file);
        }
      }
    ),
    /* @__PURE__ */ jsx("input", { type: "hidden", name, value: url }),
    /* @__PURE__ */ jsx("span", { className: "field__hint", children: busy ? "Enviando…" : "JPG ou PNG, até 2 MB" }),
    error ? /* @__PURE__ */ jsx("span", { className: "alert", children: error }) : null
  ] });
}
function PasswordField({
  name,
  label,
  autoComplete = "current-password"
}) {
  const [show, setShow] = useState(false);
  return /* @__PURE__ */ jsxs("div", { className: "field", children: [
    /* @__PURE__ */ jsx("label", { htmlFor: name, children: label }),
    /* @__PURE__ */ jsxs("div", { className: "password", children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          id: name,
          className: "ntv-input",
          type: show ? "text" : "password",
          name,
          autoComplete,
          required: true,
          minLength: 6
        }
      ),
      /* @__PURE__ */ jsx("button", { type: "button", onClick: () => setShow((v) => !v), children: show ? "Ocultar" : "Mostrar" })
    ] })
  ] });
}
const meta$3 = () => [{
  title: "Criar conta — NTV News"
}];
function loader$8() {
  return {
    apiUrl: getEnv().PUBLIC_GRAPHQL_URL.replace(/\/graphql\/?$/, "")
  };
}
async function action$7({
  request
}) {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const avatarUrl = String(form.get("avatarUrl") ?? "");
  const newsletter = form.get("newsletter") === "on";
  if (!name || !email || password.length < 6) {
    return {
      error: "Preencha nome, e-mail e uma senha de ao menos 6 caracteres."
    };
  }
  try {
    const {
      signup
    } = await gql(SIGNUP_MUTATION, {
      variables: {
        name,
        email,
        password,
        newsletter
      }
    });
    if (avatarUrl) {
      await gql(UPDATE_PROFILE_MUTATION, {
        variables: {
          input: {
            avatarUrl
          }
        },
        token: signup.token
      });
    }
    return commitWithToken(request, signup.token, "/perfil");
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível criar a conta."
    };
  }
}
const inscricao = UNSAFE_withComponentProps(function InscricaoRoute() {
  const {
    apiUrl
  } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  return /* @__PURE__ */ jsxs("div", {
    className: "shell",
    children: [/* @__PURE__ */ jsx(Header, {
      user: null
    }), /* @__PURE__ */ jsxs("div", {
      className: "authpage",
      children: [/* @__PURE__ */ jsxs("aside", {
        className: "authpage__aside",
        children: [/* @__PURE__ */ jsx("h2", {
          style: {
            color: "#fff",
            fontSize: 30,
            lineHeight: 1.15,
            margin: "0 0 12px"
          },
          children: "Tudo sobre o Vasco, no seu ritmo."
        }), /* @__PURE__ */ jsx("p", {
          style: {
            fontSize: 15,
            lineHeight: 1.6,
            margin: 0
          },
          children: "Crie sua conta para votar nas enquetes do Mercado da Bola, salvar preferências e receber a newsletter do NTV News."
        })]
      }), /* @__PURE__ */ jsxs("main", {
        className: "authpage__form",
        children: [/* @__PURE__ */ jsx("h1", {
          className: "post__title",
          style: {
            fontSize: 26
          },
          children: "Criar conta"
        }), (actionData == null ? void 0 : actionData.error) ? /* @__PURE__ */ jsx("p", {
          className: "alert",
          children: actionData.error
        }) : null, /* @__PURE__ */ jsxs(Form, {
          method: "post",
          children: [/* @__PURE__ */ jsx(AvatarUpload, {
            apiUrl
          }), /* @__PURE__ */ jsxs("div", {
            className: "field",
            children: [/* @__PURE__ */ jsx("label", {
              htmlFor: "name",
              children: "Nome"
            }), /* @__PURE__ */ jsx("input", {
              id: "name",
              className: "ntv-input",
              name: "name",
              required: true,
              autoComplete: "name"
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "field",
            children: [/* @__PURE__ */ jsx("label", {
              htmlFor: "email",
              children: "E-mail"
            }), /* @__PURE__ */ jsx("input", {
              id: "email",
              className: "ntv-input",
              type: "email",
              name: "email",
              required: true,
              autoComplete: "email"
            })]
          }), /* @__PURE__ */ jsx(PasswordField, {
            name: "password",
            label: "Senha",
            autoComplete: "new-password"
          }), /* @__PURE__ */ jsxs("label", {
            className: "checkline",
            children: [/* @__PURE__ */ jsx("input", {
              type: "checkbox",
              name: "newsletter",
              defaultChecked: true
            }), /* @__PURE__ */ jsx("span", {
              children: "Quero receber a newsletter com os destaques da semana."
            })]
          }), /* @__PURE__ */ jsx("button", {
            className: "ntv-btn",
            style: {
              width: "100%"
            },
            disabled: navigation.state !== "idle",
            children: navigation.state === "idle" ? "Criar conta" : "Criando…"
          })]
        }), /* @__PURE__ */ jsxs("p", {
          className: "field__hint",
          style: {
            marginTop: 16,
            textAlign: "center"
          },
          children: ["Já tem conta? ", /* @__PURE__ */ jsx(Link, {
            to: "/entrar",
            children: "Entrar"
          })]
        })]
      })]
    })]
  });
});
const route9 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$7,
  default: inscricao,
  loader: loader$8,
  meta: meta$3
}, Symbol.toStringTag, { value: "Module" }));
const meta$2 = () => [{
  title: "Entrar — NTV News"
}];
async function action$6({
  request
}) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const redirectTo = String(form.get("redirectTo") || "/perfil");
  try {
    const {
      login
    } = await gql(LOGIN_MUTATION, {
      variables: {
        email,
        password
      }
    });
    return commitWithToken(request, login.token, redirectTo);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível entrar."
    };
  }
}
const entrar = UNSAFE_withComponentProps(function EntrarRoute() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const [params] = useSearchParams();
  return /* @__PURE__ */ jsxs("div", {
    className: "shell",
    children: [/* @__PURE__ */ jsx(Header, {
      user: null
    }), /* @__PURE__ */ jsxs("div", {
      className: "authpage",
      children: [/* @__PURE__ */ jsxs("aside", {
        className: "authpage__aside",
        children: [/* @__PURE__ */ jsx("h2", {
          style: {
            color: "#fff",
            fontSize: 30,
            lineHeight: 1.15,
            margin: "0 0 12px"
          },
          children: "Bem-vindo de volta."
        }), /* @__PURE__ */ jsx("p", {
          style: {
            fontSize: 15,
            lineHeight: 1.6,
            margin: 0
          },
          children: "Entre para votar nas enquetes e gerenciar suas preferências."
        })]
      }), /* @__PURE__ */ jsxs("main", {
        className: "authpage__form",
        children: [/* @__PURE__ */ jsx("h1", {
          className: "post__title",
          style: {
            fontSize: 26
          },
          children: "Entrar"
        }), params.get("motivo") === "enquete" ? /* @__PURE__ */ jsx("p", {
          className: "alert",
          children: "Entre na sua conta para votar na enquete."
        }) : null, (actionData == null ? void 0 : actionData.error) ? /* @__PURE__ */ jsx("p", {
          className: "alert",
          children: actionData.error
        }) : null, /* @__PURE__ */ jsxs(Form, {
          method: "post",
          children: [/* @__PURE__ */ jsx("input", {
            type: "hidden",
            name: "redirectTo",
            value: params.get("voltar") ?? "/perfil"
          }), /* @__PURE__ */ jsxs("div", {
            className: "field",
            children: [/* @__PURE__ */ jsx("label", {
              htmlFor: "email",
              children: "E-mail"
            }), /* @__PURE__ */ jsx("input", {
              id: "email",
              className: "ntv-input",
              type: "email",
              name: "email",
              required: true,
              autoComplete: "email"
            })]
          }), /* @__PURE__ */ jsx(PasswordField, {
            name: "password",
            label: "Senha"
          }), /* @__PURE__ */ jsx("button", {
            className: "ntv-btn",
            style: {
              width: "100%"
            },
            disabled: navigation.state !== "idle",
            children: navigation.state === "idle" ? "Entrar" : "Entrando…"
          })]
        }), /* @__PURE__ */ jsxs("p", {
          className: "field__hint",
          style: {
            marginTop: 16,
            textAlign: "center"
          },
          children: ["Ainda não tem conta? ", /* @__PURE__ */ jsx(Link, {
            to: "/inscricao",
            children: "Inscreva-se"
          })]
        })]
      })]
    })]
  });
});
const route10 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$6,
  default: entrar,
  meta: meta$2
}, Symbol.toStringTag, { value: "Module" }));
const CHANGE_PASSWORD = (
  /* GraphQL */
  `
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(currentPassword: $currentPassword, newPassword: $newPassword)
  }
`
);
const meta$1 = () => [{
  title: "Meu perfil — NTV News"
}];
async function loader$7({
  request
}) {
  if (!await getToken(request)) throw redirect("/entrar?voltar=/perfil");
  const data2 = await gql(ME_QUERY, {
    request
  });
  if (!data2.me) throw redirect("/entrar?voltar=/perfil");
  return {
    ...data2,
    apiUrl: getEnv().PUBLIC_GRAPHQL_URL.replace(/\/graphql\/?$/, "")
  };
}
async function action$5({
  request
}) {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "profile");
  try {
    if (intent === "password") {
      await gql(CHANGE_PASSWORD, {
        request,
        variables: {
          currentPassword: String(form.get("currentPassword") ?? ""),
          newPassword: String(form.get("newPassword") ?? "")
        }
      });
      return {
        ok: "Senha alterada."
      };
    }
    await gql(UPDATE_PROFILE_MUTATION, {
      request,
      variables: {
        input: {
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          ...form.get("avatarUrl") ? {
            avatarUrl: String(form.get("avatarUrl"))
          } : {},
          preferences: {
            newsletter: form.get("newsletter") === "on",
            matchAlerts: form.get("matchAlerts") === "on",
            shopNews: form.get("shopNews") === "on"
          }
        }
      }
    });
    return {
      ok: "Alterações salvas."
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível salvar."
    };
  }
}
function Toggle({
  name,
  label,
  defaultChecked
}) {
  return /* @__PURE__ */ jsxs("label", {
    className: "toggle",
    children: [/* @__PURE__ */ jsx("span", {
      className: "toggle__label",
      children: label
    }), /* @__PURE__ */ jsx("input", {
      type: "checkbox",
      name,
      defaultChecked
    }), /* @__PURE__ */ jsx("span", {
      className: "toggle__track"
    })]
  });
}
const perfil = UNSAFE_withComponentProps(function PerfilRoute() {
  const {
    me,
    apiUrl
  } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  if (!me) return null;
  return /* @__PURE__ */ jsxs("div", {
    className: "shell",
    children: [/* @__PURE__ */ jsx(Header, {
      user: me
    }), /* @__PURE__ */ jsx("main", {
      className: "main",
      children: /* @__PURE__ */ jsxs("div", {
        className: "wrap",
        style: {
          maxWidth: 760
        },
        children: [/* @__PURE__ */ jsxs("section", {
          className: "widget",
          style: {
            display: "flex",
            gap: 16,
            alignItems: "center"
          },
          children: [/* @__PURE__ */ jsx(Avatar, {
            name: me.name,
            url: me.avatarUrl,
            size: 96
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("h1", {
              style: {
                margin: 0,
                fontSize: 22,
                color: "var(--ntv-ink)"
              },
              children: me.name
            }), /* @__PURE__ */ jsx("p", {
              className: "ntv-meta",
              children: me.email
            })]
          }), /* @__PURE__ */ jsx(Form, {
            method: "post",
            action: "/sair",
            style: {
              marginLeft: "auto"
            },
            children: /* @__PURE__ */ jsx("button", {
              className: "ntv-btn ntv-btn--outline",
              children: "Sair"
            })
          })]
        }), (actionData == null ? void 0 : actionData.ok) ? /* @__PURE__ */ jsx("p", {
          className: "alert alert--ok",
          children: actionData.ok
        }) : null, (actionData == null ? void 0 : actionData.error) ? /* @__PURE__ */ jsx("p", {
          className: "alert",
          children: actionData.error
        }) : null, /* @__PURE__ */ jsxs(Form, {
          method: "post",
          className: "widget",
          style: {
            marginTop: 16
          },
          children: [/* @__PURE__ */ jsx("h2", {
            className: "widget__title",
            children: "Dados da conta"
          }), /* @__PURE__ */ jsx(AvatarUpload, {
            apiUrl,
            initial: me.avatarUrl,
            size: 72
          }), /* @__PURE__ */ jsxs("div", {
            className: "field",
            children: [/* @__PURE__ */ jsx("label", {
              htmlFor: "name",
              children: "Nome"
            }), /* @__PURE__ */ jsx("input", {
              id: "name",
              className: "ntv-input",
              name: "name",
              defaultValue: me.name
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "field",
            children: [/* @__PURE__ */ jsx("label", {
              htmlFor: "email",
              children: "E-mail"
            }), /* @__PURE__ */ jsx("input", {
              id: "email",
              className: "ntv-input",
              type: "email",
              name: "email",
              defaultValue: me.email
            })]
          }), /* @__PURE__ */ jsx("h2", {
            className: "widget__title",
            style: {
              marginTop: 24
            },
            children: "Preferências"
          }), /* @__PURE__ */ jsx(Toggle, {
            name: "newsletter",
            label: "Newsletter semanal",
            defaultChecked: me.preferences.newsletter
          }), /* @__PURE__ */ jsx(Toggle, {
            name: "matchAlerts",
            label: "Alertas de jogo",
            defaultChecked: me.preferences.matchAlerts
          }), /* @__PURE__ */ jsx(Toggle, {
            name: "shopNews",
            label: "Novidades da Loja NTV",
            defaultChecked: me.preferences.shopNews
          }), /* @__PURE__ */ jsx("button", {
            className: "ntv-btn",
            style: {
              width: "100%",
              marginTop: 20
            },
            disabled: navigation.state !== "idle",
            children: "Salvar alterações"
          })]
        }), /* @__PURE__ */ jsxs(Form, {
          method: "post",
          className: "widget",
          style: {
            marginTop: 16
          },
          children: [/* @__PURE__ */ jsx("input", {
            type: "hidden",
            name: "intent",
            value: "password"
          }), /* @__PURE__ */ jsx("h2", {
            className: "widget__title",
            children: "Alterar senha"
          }), /* @__PURE__ */ jsxs("div", {
            className: "field",
            children: [/* @__PURE__ */ jsx("label", {
              htmlFor: "currentPassword",
              children: "Senha atual"
            }), /* @__PURE__ */ jsx("input", {
              id: "currentPassword",
              className: "ntv-input",
              type: "password",
              name: "currentPassword",
              required: true
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "field",
            children: [/* @__PURE__ */ jsx("label", {
              htmlFor: "newPassword",
              children: "Nova senha"
            }), /* @__PURE__ */ jsx("input", {
              id: "newPassword",
              className: "ntv-input",
              type: "password",
              name: "newPassword",
              minLength: 6,
              required: true
            })]
          }), /* @__PURE__ */ jsx("button", {
            className: "ntv-btn ntv-btn--outline",
            children: "Alterar senha"
          })]
        }), /* @__PURE__ */ jsxs("section", {
          className: "widget",
          style: {
            marginTop: 16
          },
          children: [/* @__PURE__ */ jsx("h2", {
            className: "widget__title",
            children: "Minhas enquetes"
          }), me.pollVotes.length ? me.pollVotes.map((vote) => /* @__PURE__ */ jsxs("div", {
            className: "matchrow",
            children: [/* @__PURE__ */ jsx("span", {
              style: {
                fontWeight: 700
              },
              children: vote.playerName
            }), /* @__PURE__ */ jsx("span", {
              className: `ntv-badge ${vote.choice === "good" ? "ntv-badge--success" : "ntv-badge--mute"}`,
              style: {
                marginLeft: "auto"
              },
              children: vote.choice === "good" ? "Bom reforço" : "Péssimo negócio"
            }), /* @__PURE__ */ jsx("span", {
              className: "ntv-meta",
              children: formatDate(vote.votedAt)
            })]
          }, vote.pollId)) : /* @__PURE__ */ jsx("p", {
            className: "ntv-meta",
            children: "Você ainda não votou em nenhuma enquete."
          })]
        })]
      })
    }), /* @__PURE__ */ jsx(Footer, {})]
  });
});
const route11 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$5,
  default: perfil,
  loader: loader$7,
  meta: meta$1
}, Symbol.toStringTag, { value: "Module" }));
const action$4 = ({
  request
}) => logout(request);
const loader$6 = ({
  request
}) => logout(request);
const route12 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$4,
  loader: loader$6
}, Symbol.toStringTag, { value: "Module" }));
async function loader$5({
  request
}) {
  const url = new URL(request.url);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 12), 30);
  return gql(LATEST_PAGE_QUERY, {
    variables: {
      limit,
      offset
    },
    request
  });
}
const route13 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$5
}, Symbol.toStringTag, { value: "Module" }));
async function action$3({
  request
}) {
  const form = await request.formData();
  const pollId = String(form.get("pollId") ?? "");
  const choice = String(form.get("choice") ?? "");
  if (!pollId || !["good", "bad"].includes(choice)) {
    return {
      error: "Voto inválido."
    };
  }
  const voter = await getVoterId(request);
  const init = voter.isNew ? {
    headers: {
      "Set-Cookie": await voterCookie.serialize(voter.id)
    }
  } : void 0;
  try {
    const result = await gql(VOTE_MUTATION, {
      variables: {
        pollId,
        choice
      },
      request,
      voterId: voter.id
    });
    return data(result.votePoll, init);
  } catch (error) {
    return data({
      error: error instanceof Error ? error.message : "Não foi possível votar."
    }, init);
  }
}
const route14 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$3
}, Symbol.toStringTag, { value: "Module" }));
async function action$2({
  request
}) {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "create");
  try {
    if (intent === "remove") {
      const id = String(form.get("id") ?? "");
      await gql(REMOVE_COMMENT_MUTATION, {
        variables: {
          id
        },
        request
      });
      return {
        removedId: id
      };
    }
    const data2 = await gql(ADD_COMMENT_MUTATION, {
      request,
      variables: {
        postSlug: String(form.get("postSlug") ?? ""),
        body: String(form.get("body") ?? ""),
        parentId: form.get("parentId") ? String(form.get("parentId")) : null
      }
    });
    return data2.addComment;
  } catch (error) {
    if (error instanceof GraphQLRequestError && error.code === "UNAUTHENTICATED") {
      throw redirect("/entrar?motivo=comentario");
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível comentar."
    };
  }
}
const route15 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$2
}, Symbol.toStringTag, { value: "Module" }));
async function action$1({
  request
}) {
  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  if (!id) return {
    ok: false
  };
  try {
    await gql(TRACK_CLICK_MUTATION, {
      variables: {
        id
      },
      request
    });
  } catch {
  }
  return {
    ok: true
  };
}
const route16 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$1
}, Symbol.toStringTag, { value: "Module" }));
const TRACK_AD_CLICK = (
  /* GraphQL */
  `
  mutation TrackAdClick($id: ID!) {
    trackAdClick(id: $id)
  }
`
);
async function action({
  request
}) {
  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  if (!id) return {
    ok: false
  };
  try {
    await gql(TRACK_AD_CLICK, {
      variables: {
        id
      },
      request
    });
  } catch {
  }
  return {
    ok: true
  };
}
const route17 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action
}, Symbol.toStringTag, { value: "Module" }));
const ADVERTISE_QUERY = (
  /* GraphQL */
  `
  query Advertise {
    settings {
      siteName
      url
    }
    home(latestLimit: 1) {
      latest {
        total
      }
    }
    me {
      id
      name
      avatarUrl
    }
  }
`
);
const FORMATS = [{
  name: "Barra lateral",
  spec: "300×250 ou 300×600 px",
  where: "Home e páginas de notícia, ao lado do conteúdo",
  placement: "sidebar"
}, {
  name: "Dentro da matéria",
  spec: "728×90 px (desktop) · 320×100 px (mobile)",
  where: "Entre os parágrafos, no meio da leitura",
  placement: "in_article"
}, {
  name: "Rodapé",
  spec: "970×250 px",
  where: "Fim de todas as páginas",
  placement: "footer"
}, {
  name: "Loja NTV",
  spec: "300×250 px",
  where: "Grade de produtos da Loja",
  placement: "shop"
}];
const meta = ({
  matches
}) => pageMeta({
  matches,
  path: "/anuncie",
  title: "Anuncie no NTV News",
  description: "Formatos, especificações e contato comercial para anunciar no maior portal do torcedor vascaíno."
});
async function loader$4({
  request
}) {
  return gql(ADVERTISE_QUERY, {
    request
  });
}
const anuncie = UNSAFE_withComponentProps(function AnuncieRoute() {
  const {
    settings,
    home: home2,
    me
  } = useLoaderData();
  const site = useSite();
  return /* @__PURE__ */ jsxs("div", {
    className: "shell",
    children: [/* @__PURE__ */ jsx(Header, {
      user: me
    }), /* @__PURE__ */ jsx("main", {
      className: "main",
      children: /* @__PURE__ */ jsxs("div", {
        className: "wrap",
        style: {
          maxWidth: 860
        },
        children: [/* @__PURE__ */ jsxs("div", {
          className: "section__head",
          children: [/* @__PURE__ */ jsx("span", {
            className: "section__rule"
          }), /* @__PURE__ */ jsxs("h1", {
            className: "section__title",
            children: ["Anuncie no ", settings.siteName]
          })]
        }), /* @__PURE__ */ jsx("p", {
          className: "post__subtitle",
          children: "O portal do torcedor vascaíno. Sua marca ao lado da cobertura diária do clube — notícias, mercado da bola, tabela e a Loja NTV."
        }), /* @__PURE__ */ jsxs("section", {
          className: "advertise__numbers",
          children: [/* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("strong", {
              children: home2.latest.total.toLocaleString("pt-BR")
            }), /* @__PURE__ */ jsx("span", {
              children: "notícias publicadas"
            })]
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("strong", {
              children: "Diário"
            }), /* @__PURE__ */ jsx("span", {
              children: "cobertura da equipe + agregação"
            })]
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("strong", {
              children: "Mobile-first"
            }), /* @__PURE__ */ jsx("span", {
              children: "a maior parte do público vem do celular"
            })]
          })]
        }), /* @__PURE__ */ jsx("h2", {
          className: "section__title",
          style: {
            margin: "32px 0 14px"
          },
          children: "Formatos disponíveis"
        }), /* @__PURE__ */ jsx("div", {
          className: "advertise__grid",
          children: FORMATS.map((format) => /* @__PURE__ */ jsxs("article", {
            className: "widget",
            children: [/* @__PURE__ */ jsx("h3", {
              className: "widget__title",
              children: format.name
            }), /* @__PURE__ */ jsx("p", {
              style: {
                margin: "0 0 8px",
                fontSize: 14,
                fontWeight: 700
              },
              children: format.spec
            }), /* @__PURE__ */ jsx("p", {
              className: "ntv-meta",
              children: format.where
            })]
          }, format.placement))
        }), /* @__PURE__ */ jsxs("section", {
          className: "widget",
          style: {
            marginTop: 24
          },
          children: [/* @__PURE__ */ jsx("h2", {
            className: "widget__title",
            children: "Como funciona"
          }), /* @__PURE__ */ jsxs("ol", {
            style: {
              margin: 0,
              paddingLeft: 20,
              fontSize: 14.5,
              lineHeight: 1.7
            },
            children: [/* @__PURE__ */ jsx("li", {
              children: "Você envia a peça no formato acima e o link de destino."
            }), /* @__PURE__ */ jsx("li", {
              children: "A equipe cadastra a campanha com data de início e fim."
            }), /* @__PURE__ */ jsx("li", {
              children: "Você recebe o relatório de impressões e cliques do período."
            })]
          }), /* @__PURE__ */ jsx("p", {
            className: "ntv-meta",
            style: {
              marginTop: 12
            },
            children: "As peças são hospedadas pelo próprio portal — sem rede de terceiros, sem script externo e sem rastreador de outra empresa nas páginas."
          })]
        }), /* @__PURE__ */ jsxs("section", {
          className: "advertise__cta",
          children: [/* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("strong", {
              children: "Quer anunciar?"
            }), /* @__PURE__ */ jsx("p", {
              className: "ntv-meta",
              style: {
                margin: "4px 0 0"
              },
              children: "Fale com a equipe comercial e receba a tabela de preços."
            })]
          }), /* @__PURE__ */ jsx("a", {
            className: "ntv-btn",
            href: `mailto:comercial@${hostOf(settings.url)}`,
            children: "Falar com o comercial"
          })]
        })]
      })
    }), /* @__PURE__ */ jsx(Footer, {
      siteName: site.siteName,
      social: site.social,
      ads: site.footerAds
    })]
  });
});
function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "ntvnews.com.br";
  }
}
const route18 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: anuncie,
  loader: loader$4,
  meta
}, Symbol.toStringTag, { value: "Module" }));
async function loader$3({
  request
}) {
  const origin = getEnv().PUBLIC_SITE_URL || new URL(request.url).origin;
  const body = `User-agent: *
Allow: /

Disallow: /api/
Disallow: /perfil
Disallow: /sair
Disallow: /busca

# Rastreadores de IA de terceiros: conteúdo é da redação.
User-agent: GPTBot
Disallow: /

User-agent: CCBot
Disallow: /

Sitemap: ${origin}/sitemap.xml
Sitemap: ${origin}/sitemap-news.xml
`;
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600"
    }
  });
}
const route19 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$3
}, Symbol.toStringTag, { value: "Module" }));
const STATIC_PAGES = [{
  path: "/",
  changefreq: "hourly",
  priority: "1.0"
}, {
  path: "/noticias",
  changefreq: "hourly",
  priority: "0.9"
}, {
  path: "/ntv-exclusivo",
  changefreq: "daily",
  priority: "0.8"
}, {
  path: "/tabela",
  changefreq: "daily",
  priority: "0.7"
}, {
  path: "/mercado",
  changefreq: "daily",
  priority: "0.7"
}, {
  path: "/loja",
  changefreq: "weekly",
  priority: "0.6"
}, {
  path: "/anuncie",
  changefreq: "monthly",
  priority: "0.3"
}];
async function loader$2({
  request
}) {
  const origin = getEnv().PUBLIC_SITE_URL || new URL(request.url).origin;
  const {
    sitemapPosts
  } = await gql(SITEMAP_QUERY, {
    request,
    variables: {
      limit: 5e3
    }
  });
  const urls = [...STATIC_PAGES.map((page) => `  <url>
    <loc>${origin}${page.path}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`), ...sitemapPosts.map((post2) => {
    const image = post2.coverImage ? `
    <image:image>
      <image:loc>${escapeXml(post2.coverImage)}</image:loc>
      <image:title>${escapeXml(post2.title)}</image:title>
    </image:image>` : "";
    return `  <url>
    <loc>${origin}/noticia/${escapeXml(post2.slug)}</loc>
    <lastmod>${new Date(post2.updatedAt).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${image}
  </url>`;
  })];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join("\n")}
</urlset>`;
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=1800"
    }
  });
}
const route20 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$2
}, Symbol.toStringTag, { value: "Module" }));
const WINDOW_MS = 48 * 60 * 60 * 1e3;
async function loader$1({
  request
}) {
  const origin = getEnv().PUBLIC_SITE_URL || new URL(request.url).origin;
  const {
    sitemapPosts
  } = await gql(SITEMAP_QUERY, {
    request,
    variables: {
      limit: 500
    }
  });
  const recent = sitemapPosts.filter((post2) => post2.publishedAt && Date.now() - new Date(post2.publishedAt).getTime() < WINDOW_MS);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${recent.map((post2) => `  <url>
    <loc>${origin}/noticia/${escapeXml(post2.slug)}</loc>
    <news:news>
      <news:publication>
        <news:name>NTV News</news:name>
        <news:language>pt</news:language>
      </news:publication>
      <news:publication_date>${new Date(post2.publishedAt).toISOString()}</news:publication_date>
      <news:title>${escapeXml(post2.title)}</news:title>
      ${post2.keywords.length ? `<news:keywords>${escapeXml(post2.keywords.join(", "))}</news:keywords>` : ""}
    </news:news>
  </url>`).join("\n")}
</urlset>`;
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=600"
    }
  });
}
const route21 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$1
}, Symbol.toStringTag, { value: "Module" }));
async function loader({
  request
}) {
  const origin = getEnv().PUBLIC_SITE_URL || new URL(request.url).origin;
  const {
    sitemapPosts
  } = await gql(SITEMAP_QUERY, {
    request,
    variables: {
      limit: 50
    }
  });
  const items = sitemapPosts.map((post2) => `    <item>
      <title>${escapeXml(post2.title)}</title>
      <link>${origin}/noticia/${escapeXml(post2.slug)}</link>
      <guid isPermaLink="true">${origin}/noticia/${escapeXml(post2.slug)}</guid>
      <category>${escapeXml(post2.category)}</category>
      <description>${escapeXml(post2.excerpt ?? post2.title)}</description>
      ${post2.publishedAt ? `<pubDate>${new Date(post2.publishedAt).toUTCString()}</pubDate>` : ""}
      ${post2.coverImage ? `<enclosure url="${escapeXml(post2.coverImage)}" type="image/jpeg" />` : ""}
    </item>`).join("\n");
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
      "cache-control": "public, max-age=900"
    }
  });
}
const route22 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-Bm2j0UvL.js", "imports": ["/assets/chunk-62JRHF6Z-B5TpE77o.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": true, "module": "/assets/root-Dn7q2nEA.js", "imports": ["/assets/chunk-62JRHF6Z-B5TpE77o.js", "/assets/Header-B7N4083b.js", "/assets/seo-D7A2sLjM.js", "/assets/Footer-D1J0Mmcc.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/home": { "id": "routes/home", "parentId": "root", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/home-KGvKxzXi.js", "imports": ["/assets/chunk-62JRHF6Z-B5TpE77o.js", "/assets/Header-B7N4083b.js", "/assets/Footer-D1J0Mmcc.js", "/assets/PostCards-Dxqh12W_.js", "/assets/Sidebar-DwfM4ho9.js", "/assets/seo-D7A2sLjM.js", "/assets/moderation-BP675NkU.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/post": { "id": "routes/post", "parentId": "root", "path": "noticia/:slug", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/post-BrWqw37g.js", "imports": ["/assets/chunk-62JRHF6Z-B5TpE77o.js", "/assets/moderation-BP675NkU.js", "/assets/Header-B7N4083b.js", "/assets/Footer-D1J0Mmcc.js", "/assets/seo-D7A2sLjM.js", "/assets/Sidebar-DwfM4ho9.js", "/assets/PostCards-Dxqh12W_.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/noticias": { "id": "routes/noticias", "parentId": "root", "path": "noticias", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/noticias-gLrQohq0.js", "imports": ["/assets/chunk-62JRHF6Z-B5TpE77o.js", "/assets/NewsListPage-BIBWoSUH.js", "/assets/seo-D7A2sLjM.js", "/assets/Header-B7N4083b.js", "/assets/Footer-D1J0Mmcc.js", "/assets/PostCards-Dxqh12W_.js", "/assets/moderation-BP675NkU.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/exclusivo": { "id": "routes/exclusivo", "parentId": "root", "path": "ntv-exclusivo", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/exclusivo-FoEer5ds.js", "imports": ["/assets/chunk-62JRHF6Z-B5TpE77o.js", "/assets/NewsListPage-BIBWoSUH.js", "/assets/seo-D7A2sLjM.js", "/assets/Header-B7N4083b.js", "/assets/Footer-D1J0Mmcc.js", "/assets/PostCards-Dxqh12W_.js", "/assets/moderation-BP675NkU.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/tabela": { "id": "routes/tabela", "parentId": "root", "path": "tabela", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/tabela-DFDEUk5R.js", "imports": ["/assets/chunk-62JRHF6Z-B5TpE77o.js", "/assets/moderation-BP675NkU.js", "/assets/Header-B7N4083b.js", "/assets/Footer-D1J0Mmcc.js", "/assets/seo-D7A2sLjM.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/mercado": { "id": "routes/mercado", "parentId": "root", "path": "mercado", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/mercado-85Va9wZB.js", "imports": ["/assets/chunk-62JRHF6Z-B5TpE77o.js", "/assets/moderation-BP675NkU.js", "/assets/Header-B7N4083b.js", "/assets/Footer-D1J0Mmcc.js", "/assets/seo-D7A2sLjM.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/busca": { "id": "routes/busca", "parentId": "root", "path": "busca", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/busca-xOV2E2c-.js", "imports": ["/assets/chunk-62JRHF6Z-B5TpE77o.js", "/assets/NewsListPage-BIBWoSUH.js", "/assets/seo-D7A2sLjM.js", "/assets/Header-B7N4083b.js", "/assets/Footer-D1J0Mmcc.js", "/assets/PostCards-Dxqh12W_.js", "/assets/moderation-BP675NkU.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/loja": { "id": "routes/loja", "parentId": "root", "path": "loja", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/loja-BJ1C8gBE.js", "imports": ["/assets/chunk-62JRHF6Z-B5TpE77o.js", "/assets/moderation-BP675NkU.js", "/assets/Header-B7N4083b.js", "/assets/Footer-D1J0Mmcc.js", "/assets/seo-D7A2sLjM.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/inscricao": { "id": "routes/inscricao", "parentId": "root", "path": "inscricao", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/inscricao-A0KS_0Ne.js", "imports": ["/assets/chunk-62JRHF6Z-B5TpE77o.js", "/assets/Header-B7N4083b.js", "/assets/AvatarUpload-gQQ_AV-_.js", "/assets/PasswordField-CiKW9dC1.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/entrar": { "id": "routes/entrar", "parentId": "root", "path": "entrar", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/entrar-CzMTj0c0.js", "imports": ["/assets/chunk-62JRHF6Z-B5TpE77o.js", "/assets/Header-B7N4083b.js", "/assets/PasswordField-CiKW9dC1.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/perfil": { "id": "routes/perfil", "parentId": "root", "path": "perfil", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/perfil-BA98KEuH.js", "imports": ["/assets/chunk-62JRHF6Z-B5TpE77o.js", "/assets/moderation-BP675NkU.js", "/assets/Header-B7N4083b.js", "/assets/Footer-D1J0Mmcc.js", "/assets/AvatarUpload-gQQ_AV-_.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/sair": { "id": "routes/sair", "parentId": "root", "path": "sair", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/sair-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.ultimas": { "id": "routes/api.ultimas", "parentId": "root", "path": "api/ultimas", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/api.ultimas-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.votar": { "id": "routes/api.votar", "parentId": "root", "path": "api/votar", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/api.votar-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.comentar": { "id": "routes/api.comentar", "parentId": "root", "path": "api/comentar", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/api.comentar-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.clique-loja": { "id": "routes/api.clique-loja", "parentId": "root", "path": "api/clique-loja", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/api.clique-loja-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.clique-anuncio": { "id": "routes/api.clique-anuncio", "parentId": "root", "path": "api/clique-anuncio", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/api.clique-anuncio-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/anuncie": { "id": "routes/anuncie", "parentId": "root", "path": "anuncie", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/anuncie-ORSh5Z-Z.js", "imports": ["/assets/chunk-62JRHF6Z-B5TpE77o.js", "/assets/Header-B7N4083b.js", "/assets/Footer-D1J0Mmcc.js", "/assets/seo-D7A2sLjM.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/robots": { "id": "routes/robots", "parentId": "root", "path": "robots.txt", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/robots-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/sitemap": { "id": "routes/sitemap", "parentId": "root", "path": "sitemap.xml", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/sitemap-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/sitemap-news": { "id": "routes/sitemap-news", "parentId": "root", "path": "sitemap-news.xml", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/sitemap-news-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/feed": { "id": "routes/feed", "parentId": "root", "path": "feed.xml", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/feed-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 } }, "url": "/assets/manifest-7dc57c36.js", "version": "7dc57c36", "sri": void 0 };
const assetsBuildDirectory = "build/client";
const basename = "/";
const future = { "unstable_optimizeDeps": false, "v8_passThroughRequests": false, "v8_trailingSlashAwareDataRequests": false, "unstable_previewServerPrerendering": false, "v8_middleware": false, "v8_splitRouteModules": false, "v8_viteEnvironmentApi": false };
const ssr = true;
const isSpaMode = false;
const prerender = [];
const routeDiscovery = { "mode": "lazy", "manifestPath": "/__manifest" };
const publicPath = "/";
const entry = { module: entryServer };
const routes = {
  "root": {
    id: "root",
    parentId: void 0,
    path: "",
    index: void 0,
    caseSensitive: void 0,
    module: route0
  },
  "routes/home": {
    id: "routes/home",
    parentId: "root",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route1
  },
  "routes/post": {
    id: "routes/post",
    parentId: "root",
    path: "noticia/:slug",
    index: void 0,
    caseSensitive: void 0,
    module: route2
  },
  "routes/noticias": {
    id: "routes/noticias",
    parentId: "root",
    path: "noticias",
    index: void 0,
    caseSensitive: void 0,
    module: route3
  },
  "routes/exclusivo": {
    id: "routes/exclusivo",
    parentId: "root",
    path: "ntv-exclusivo",
    index: void 0,
    caseSensitive: void 0,
    module: route4
  },
  "routes/tabela": {
    id: "routes/tabela",
    parentId: "root",
    path: "tabela",
    index: void 0,
    caseSensitive: void 0,
    module: route5
  },
  "routes/mercado": {
    id: "routes/mercado",
    parentId: "root",
    path: "mercado",
    index: void 0,
    caseSensitive: void 0,
    module: route6
  },
  "routes/busca": {
    id: "routes/busca",
    parentId: "root",
    path: "busca",
    index: void 0,
    caseSensitive: void 0,
    module: route7
  },
  "routes/loja": {
    id: "routes/loja",
    parentId: "root",
    path: "loja",
    index: void 0,
    caseSensitive: void 0,
    module: route8
  },
  "routes/inscricao": {
    id: "routes/inscricao",
    parentId: "root",
    path: "inscricao",
    index: void 0,
    caseSensitive: void 0,
    module: route9
  },
  "routes/entrar": {
    id: "routes/entrar",
    parentId: "root",
    path: "entrar",
    index: void 0,
    caseSensitive: void 0,
    module: route10
  },
  "routes/perfil": {
    id: "routes/perfil",
    parentId: "root",
    path: "perfil",
    index: void 0,
    caseSensitive: void 0,
    module: route11
  },
  "routes/sair": {
    id: "routes/sair",
    parentId: "root",
    path: "sair",
    index: void 0,
    caseSensitive: void 0,
    module: route12
  },
  "routes/api.ultimas": {
    id: "routes/api.ultimas",
    parentId: "root",
    path: "api/ultimas",
    index: void 0,
    caseSensitive: void 0,
    module: route13
  },
  "routes/api.votar": {
    id: "routes/api.votar",
    parentId: "root",
    path: "api/votar",
    index: void 0,
    caseSensitive: void 0,
    module: route14
  },
  "routes/api.comentar": {
    id: "routes/api.comentar",
    parentId: "root",
    path: "api/comentar",
    index: void 0,
    caseSensitive: void 0,
    module: route15
  },
  "routes/api.clique-loja": {
    id: "routes/api.clique-loja",
    parentId: "root",
    path: "api/clique-loja",
    index: void 0,
    caseSensitive: void 0,
    module: route16
  },
  "routes/api.clique-anuncio": {
    id: "routes/api.clique-anuncio",
    parentId: "root",
    path: "api/clique-anuncio",
    index: void 0,
    caseSensitive: void 0,
    module: route17
  },
  "routes/anuncie": {
    id: "routes/anuncie",
    parentId: "root",
    path: "anuncie",
    index: void 0,
    caseSensitive: void 0,
    module: route18
  },
  "routes/robots": {
    id: "routes/robots",
    parentId: "root",
    path: "robots.txt",
    index: void 0,
    caseSensitive: void 0,
    module: route19
  },
  "routes/sitemap": {
    id: "routes/sitemap",
    parentId: "root",
    path: "sitemap.xml",
    index: void 0,
    caseSensitive: void 0,
    module: route20
  },
  "routes/sitemap-news": {
    id: "routes/sitemap-news",
    parentId: "root",
    path: "sitemap-news.xml",
    index: void 0,
    caseSensitive: void 0,
    module: route21
  },
  "routes/feed": {
    id: "routes/feed",
    parentId: "root",
    path: "feed.xml",
    index: void 0,
    caseSensitive: void 0,
    module: route22
  }
};
const allowedActionOrigins = false;
export {
  allowedActionOrigins,
  serverManifest as assets,
  assetsBuildDirectory,
  basename,
  entry,
  future,
  isSpaMode,
  prerender,
  publicPath,
  routeDiscovery,
  routes,
  ssr
};
