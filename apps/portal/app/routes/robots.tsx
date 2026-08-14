import type { LoaderFunctionArgs } from "react-router";
import { getEnv } from "~/lib/env.server";

/**
 * robots.txt. Aponta os dois sitemaps e barra o que não deve ser rastreado:
 * rotas de API, área logada e a busca (conteúdo duplicado infinito).
 */
export async function loader({ request }: LoaderFunctionArgs) {
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

Sitemap: ${origin}/sitemap-index.xml
Sitemap: ${origin}/sitemap-news.xml
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
