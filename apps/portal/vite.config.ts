import { reactRouter } from "@react-router/dev/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    reactRouter(),
    tsconfigPaths(),
    // Ao migrar para Oxygen, acrescentar aqui (ver docs/shopify-oxygen.md):
    //   import { hydrogen } from "@shopify/hydrogen/vite";
    //   import { oxygen } from "@shopify/mini-oxygen/vite";
    //   plugins: [hydrogen(), oxygen(), reactRouter(), tsconfigPaths()]
  ],
  server: {
    port: 3001,
  },
  ssr: {
    // O bundle de servidor precisa ser Worker-safe: nada de APIs de Node aqui.
    noExternal: ["@ntv/shared"],
  },
  build: {
    assetsInlineLimit: 0,
  },
});
