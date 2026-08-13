/** Ponte de variáveis de ambiente entre Node (dev) e Oxygen (produção).
 *
 *  No Oxygen não existe `process.env`: as vars chegam no 2º argumento de
 *  `fetch(request, env, ctx)`. O `server.ts` publica esse objeto em
 *  `globalThis.__NTV_ENV` antes de tratar a request, e tudo aqui lê daí. */

export interface PortalEnv {
  PUBLIC_GRAPHQL_URL: string;
  SESSION_SECRET: string;
  /** Origem pública do portal — usada em og:url/canonical. */
  PUBLIC_SITE_URL: string;
  PUBLIC_STORE_DOMAIN?: string;
  PUBLIC_STOREFRONT_API_TOKEN?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __NTV_ENV: Record<string, string | undefined> | undefined;
}

/** `process` só existe no runtime Node; no Oxygen ele é ausente — por isso o
 *  acesso é indireto, sem declarar o global (os tipos do Worker já o reservam). */
function nodeEnv(): Record<string, string | undefined> | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
}

export function setEnv(env: Record<string, string | undefined>) {
  globalThis.__NTV_ENV = env;
}

export function getEnv(): PortalEnv {
  const source = globalThis.__NTV_ENV ?? nodeEnv() ?? {};
  return {
    PUBLIC_GRAPHQL_URL: source.PUBLIC_GRAPHQL_URL ?? "http://localhost:4010/graphql",
    SESSION_SECRET: source.SESSION_SECRET ?? "dev-session-secret",
    PUBLIC_SITE_URL: source.PUBLIC_SITE_URL ?? "",
    PUBLIC_STORE_DOMAIN: source.PUBLIC_STORE_DOMAIN,
    PUBLIC_STOREFRONT_API_TOKEN: source.PUBLIC_STOREFRONT_API_TOKEN,
  };
}
