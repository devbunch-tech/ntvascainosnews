import { useRouteLoaderData } from "react-router";
import { resolveSidebarWidgets } from "@ntv/shared";
import type { SocialNetwork } from "~/components/SocialIcons";

/**
 * Dados globais do site (nome, redes do rodapé, anúncios de rodapé).
 *
 * Fica **fora do `root.tsx` de propósito**: o root importa `Header`/`Footer`, e
 * se esses componentes importassem o root de volta para pegar o hook, o Vite SSR
 * quebraria com "dependency module is not yet fully initialized" — dependência
 * circular. Este módulo não importa nada do root; só lê o loader dele pelo id.
 */

export interface SiteData {
  settings: {
    siteName: string;
    logoUrl?: string | null;
    faviconUrl?: string | null;
    url?: string | null;
    seo?: {
      title?: string | null;
      description?: string | null;
      keywords?: string[] | null;
      googleVerification?: string | null;
      organizationName?: string | null;
      foundingDate?: string | null;
      ogImage?: string | null;
    } | null;
    socialAccounts: Record<string, { url?: string | null } | null>;
    sidebar?: { widgets?: { key: string; visible: boolean }[] | null } | null;
  };
  footerAds: { id: string; title: string; imageUrl?: string | null; targetUrl: string }[];
}

export interface SiteContext {
  siteName: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  siteUrl: string;
  seo: NonNullable<SiteData["settings"]["seo"]>;
  social: { network: SocialNetwork; url: string }[];
  footerAds: SiteData["footerAds"];
  /** Widgets da sidebar já na ordem configurada, invisíveis removidos. */
  sidebarWidgets: string[];
}

/**
 * Descarta URL de asset que aponta para máquina de desenvolvimento.
 *
 * O `/upload` devolve a URL absoluta montada com `PUBLIC_API_URL`, e o que for
 * enviado rodando local grava `http://localhost:4010/...` no banco. Se esse
 * banco for o de produção — foi o que aconteceu com o favicon — o site entra no
 * ar com asset quebrado, e o navegador de quem visita não tem localhost nenhum
 * para resolver. Melhor cair no padrão do que emitir link morto.
 */
export function publicAsset(url?: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?\//i.test(url)) return null;
  return url;
}

/** Valores neutros quando o loader do root falhou — o portal não pode cair por isso. */
export function useSite(): SiteContext {
  const data = useRouteLoaderData("root") as SiteData | null | undefined;
  const accounts = data?.settings?.socialAccounts ?? {};
  const seo = data?.settings?.seo ?? {};

  return {
    siteName: data?.settings?.siteName ?? "NTV News",
    logoUrl: publicAsset(data?.settings?.logoUrl),
    faviconUrl: publicAsset(data?.settings?.faviconUrl),
    siteUrl: data?.settings?.url ?? "",
    // O og:image entra no card do WhatsApp e do X; localhost ali é card vazio.
    seo: { ...seo, ogImage: publicAsset(seo.ogImage) },
    // O mesmo resolvedor da API roda aqui: se as configurações não vierem, o
    // portal cai na ordem padrão em vez de renderizar sidebar vazia.
    sidebarWidgets: resolveSidebarWidgets(data?.settings?.sidebar?.widgets)
      .filter((widget) => widget.visible)
      .map((widget) => widget.key),
    footerAds: data?.footerAds ?? [],
    social: Object.entries(accounts)
      .filter(([, value]) => Boolean(value?.url))
      .map(([network, value]) => ({
        network: network as SocialNetwork,
        url: value!.url as string,
      })),
  };
}
