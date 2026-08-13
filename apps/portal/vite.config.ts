import { hydrogen } from "@shopify/hydrogen/vite";
import { oxygen } from "@shopify/mini-oxygen/vite";
import { reactRouter } from "@react-router/dev/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vite";

export default defineConfig({
  // A ordem importa: hydrogen() e oxygen() precisam vir antes do reactRouter().
  // O oxygen() troca o servidor Node do Vite pelo mini-oxygen, que executa o
  // `server.ts` no mesmo runtime de Workers usado em produção.
  plugins: [hydrogen(), oxygen(), reactRouter(), tsconfigPaths()],
  server: {
    port: 3001,
  },
  ssr: {
    // O bundle de servidor precisa ser Worker-safe: nada de APIs de Node aqui.
    noExternal: ["@ntv/shared"],
    optimizeDeps: {
      // `entry.server.tsx` usa o entrypoint de Web Streams do React, que é CJS:
      // sem pré-bundle o workerd quebra com "require is not defined".
      include: ["react-dom/server"],
    },
  },
  build: {
    assetsInlineLimit: 0,
  },
});
