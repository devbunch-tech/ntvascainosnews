import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
} from "react-router";
import type { LinksFunction, LoaderFunctionArgs } from "react-router";
import { gql } from "./lib/graphql.server";
import { SITE_QUERY } from "./lib/queries";
import type { SiteData } from "./lib/site";
import { useSite } from "./lib/site";
import { organizationJsonLd } from "./lib/seo";
import tokens from "@ntv/shared/tokens.css?url";
import portal from "./styles/portal.css?url";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  // Pré-conexão ao CDN das fotos do RSS: economiza o handshake na primeira imagem.
  { rel: "preconnect", href: "https://s2-ge.glbimg.com", crossOrigin: "anonymous" },
  { rel: "stylesheet", href: tokens },
  { rel: "stylesheet", href: portal },
];

/** O loader do root abastece o `useSite()` de `~/lib/site`. */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    return await gql<SiteData>(SITE_QUERY, { request });
  } catch {
    // O portal não pode cair só porque as configurações não vieram.
    return null;
  }
}

export function Layout({ children }: { children: React.ReactNode }) {
  const site = useSite();

  // Favicon enviado no admin; sem ele, o logotipo serve de ícone.
  const favicon = site.faviconUrl || "/assets/logo.svg";
  const isSvg = favicon.endsWith(".svg");

  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#101014" />

        {/* Widget de embed do X — converte o <blockquote class="twitter-tweet">
            que a ingestão de posts do X grava no corpo da notícia. */}
        <script async src="https://platform.twitter.com/widgets.js" charSet="utf-8" />

        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-YG17SVXP11" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());

gtag('config', 'G-YG17SVXP11');`,
          }}
        />

        {site.seo.googleVerification ? (
          <meta name="google-site-verification" content={site.seo.googleVerification} />
        ) : null}

        <link rel="icon" href={favicon} type={isSvg ? "image/svg+xml" : undefined} />
        <link rel="apple-touch-icon" href={favicon} />
        <link rel="alternate" type="application/rss+xml" title={site.siteName} href="/feed.xml" />

        <Meta />
        <Links />

        {/* Organização + WebSite: alimenta o Knowledge Panel e a caixa de busca. */}
        {site.siteUrl ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                organizationJsonLd({
                  siteName: site.siteName,
                  siteUrl: site.siteUrl,
                  logoUrl: site.logoUrl || "/assets/logo.svg",
                  description: site.seo.description ?? "",
                  social: site.social.map((item) => item.url),
                  organizationName: site.seo.organizationName,
                  foundingDate: site.seo.foundingDate,
                }),
              ),
            }}
          />
        ) : null}
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const message = isRouteErrorResponse(error)
    ? error.data
    : error instanceof Error
      ? error.message
      : "Erro inesperado.";

  return (
    <div className="shell">
      <Header user={null} />
      <main className="main">
        <div className="wrap">
          <p className="ntv-label" style={{ color: "var(--ntv-gray-500)" }}>
            Erro {status}
          </p>
          <h1 className="post__title">
            {status === 404 ? "Página não encontrada" : "Algo deu errado"}
          </h1>
          <p className="post__subtitle">{message}</p>
          <a className="ntv-btn" href="/">
            Voltar para a home
          </a>
        </div>
      </main>
      <Footer />
    </div>
  );
}
