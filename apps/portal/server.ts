/**
 * Entry de servidor no formato Oxygen (Cloudflare Workers).
 *
 * Em dev com `react-router dev`, o Vite serve o app e este arquivo não é usado.
 * Ao migrar para o Oxygen (ver docs/shopify-oxygen.md), este vira o entry
 * declarado em `oxygen.config.ts` / `shopify.app.toml` — a assinatura
 * `fetch(request, env, executionContext)` já é a que o Oxygen chama.
 */
import { createRequestHandler } from "react-router";
import { setEnv } from "./app/lib/env.server";

// @ts-expect-error — gerado por `react-router build`
import * as build from "./build/server/index.js";

const handleRequest = createRequestHandler(build, globalThis.process?.env.NODE_ENV);

export default {
  async fetch(
    request: Request,
    env: Record<string, string | undefined>,
    executionContext: { waitUntil(promise: Promise<unknown>): void },
  ): Promise<Response> {
    // Oxygen entrega as env vars por request; publicamos para os módulos *.server.
    setEnv(env);

    try {
      return await handleRequest(request, {
        env,
        waitUntil: executionContext.waitUntil.bind(executionContext),
      });
    } catch (error) {
      console.error(error);
      return new Response("Erro interno", { status: 500 });
    }
  },
};
