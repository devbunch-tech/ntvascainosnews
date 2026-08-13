/** Reservado para declarações de módulo do portal.
 *
 *  O shim de `react-dom/server.browser` saiu junto com o React 18: no React 19
 *  o `renderToReadableStream` já é tipado em `react-dom/server`, e é de lá que
 *  o `entry.server.tsx` importa (a condição `workerd` resolve para o build edge). */
export {};
