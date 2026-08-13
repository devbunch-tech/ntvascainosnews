import { useRouteLoaderData } from "react-router";
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
}

/** Valores neutros quando o loader do root falhou — o portal não pode cair por isso. */
export function useSite(): SiteContext {
  const data = useRouteLoaderData("root") as SiteData | null | undefined;
  const accounts = data?.settings?.socialAccounts ?? {};

  return {
    siteName: data?.settings?.siteName ?? "NTV News",
    logoUrl: data?.settings?.logoUrl ?? null,
    faviconUrl: data?.settings?.faviconUrl ?? null,
    siteUrl: data?.settings?.url ?? "",
    seo: data?.settings?.seo ?? {},
    footerAds: data?.footerAds ?? [],
    social: Object.entries(accounts)
      .filter(([, value]) => Boolean(value?.url))
      .map(([network, value]) => ({
        network: network as SocialNetwork,
        url: value!.url as string,
      })),
  };
}
