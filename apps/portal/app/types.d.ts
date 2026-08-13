/** React 18 não publica tipos para o entrypoint de Web Streams,
 *  que é o usado pelo runtime do Oxygen. */
declare module "react-dom/server.browser" {
  export { renderToReadableStream } from "react-dom/server";
}
