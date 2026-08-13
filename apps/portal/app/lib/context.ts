import { createHydrogenContext } from "@shopify/hydrogen";
import { AppSession } from "./hydrogen-session.server";

/** Monta o contexto do Hydrogen para cada request.
 *
 *  Com `v8_middleware` (ligado pelo hydrogenPreset), os loaders leem via
 *  `context.get(hydrogenContext.storefront)` — ou pelos acessos diretos
 *  `context.storefront` / `context.cart`, que o provider também expõe.
 *
 *  O cliente GraphQL da nossa API (`app/lib/graphql.server.ts`) continua
 *  independente disto: a Storefront API atende a Loja NTV, a API própria
 *  atende o conteúdo editorial. */
export async function createAppLoadContext(
  request: Request,
  env: Env,
  executionContext: ExecutionContext,
) {
  const session = await AppSession.init(request, [env.SESSION_SECRET]);

  return createHydrogenContext({
    env,
    request,
    cache: await caches.open("hydrogen"),
    waitUntil: executionContext.waitUntil.bind(executionContext),
    session,
    i18n: { language: "PT_BR", country: "BR" },
  });
}
