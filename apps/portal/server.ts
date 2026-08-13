/**
 * Entry do worker no Oxygen (runtime de Workers, V8 isolates).
 *
 * Em dev, o `mini-oxygen` executa este mesmo arquivo — então o que roda local
 * é o que roda em produção. O build de servidor chega pelo módulo virtual do
 * React Router, não por um caminho em `dist/`.
 */
import { createRequestHandler } from "@shopify/hydrogen/oxygen";
import { storefrontRedirect } from "@shopify/hydrogen";
// módulo virtual gerado pelo plugin do React Router
import * as remixBuild from "virtual:react-router/server-build";
import { createAppLoadContext } from "./app/lib/context";
import { setEnv } from "./app/lib/env.server";

export default {
  async fetch(
    request: Request,
    env: Env,
    executionContext: ExecutionContext,
  ): Promise<Response> {
    // Oxygen entrega as env vars por request; publicamos para os módulos *.server.
    setEnv(env as unknown as Record<string, string | undefined>);

    try {
      const appLoadContext = await createAppLoadContext(request, env, executionContext);

      const handleRequest = createRequestHandler({
        build: remixBuild,
        mode: import.meta.env.MODE,
        getLoadContext: () => appLoadContext,
      });

      const response = await handleRequest(request);

      if (appLoadContext.session.isPending) {
        response.headers.set("Set-Cookie", await appLoadContext.session.commit());
      }

      // 404 pode ser um redirect cadastrado no admin da Shopify (URL Redirects).
      if (response.status === 404) {
        return storefrontRedirect({
          request,
          response,
          storefront: appLoadContext.storefront,
        });
      }

      return response;
    } catch (error) {
      console.error(error);
      return new Response("Erro interno", { status: 500 });
    }
  },
};
