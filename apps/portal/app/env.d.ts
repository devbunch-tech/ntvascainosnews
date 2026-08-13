/// <reference types="@shopify/oxygen-workers-types" />
import type { HydrogenEnv, HydrogenSessionData } from "@shopify/hydrogen";

declare global {
  /** Variáveis que o Oxygen injeta por request (2º argumento do `fetch`).
   *  As da Shopify vêm de `HydrogenEnv`; as nossas ficam listadas aqui. */
  interface Env extends HydrogenEnv {
    /** URL pública da apps/api — o portal só fala GraphQL por HTTP com ela. */
    PUBLIC_GRAPHQL_URL: string;
    /** Origem pública do portal, usada em og:url/canonical. */
    PUBLIC_SITE_URL: string;
  }
}

declare module "react-router" {
  interface SessionData extends HydrogenSessionData {}
}
