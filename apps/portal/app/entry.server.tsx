import { renderToReadableStream } from "react-dom/server.browser";
import { ServerRouter, type EntryContext } from "react-router";
import { isbot } from "isbot";

/** `renderToReadableStream` (Web Streams) em vez de `renderToPipeableStream` (Node):
 *  é o caminho compatível com o runtime do Oxygen. */
export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
) {
  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {
      signal: request.signal,
      onError(error: unknown) {
        // eslint-disable-next-line no-console
        console.error(error);
        responseStatusCode = 500;
      },
    },
  );

  if (isbot(request.headers.get("user-agent") ?? "")) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html; charset=utf-8");
  return new Response(body, { headers: responseHeaders, status: responseStatusCode });
}
