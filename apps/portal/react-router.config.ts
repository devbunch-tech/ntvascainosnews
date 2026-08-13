import type { Config } from "@react-router/dev/config";
import { hydrogenPreset } from "@shopify/hydrogen/react-router-preset";

export default {
  // O preset oficial do Hydrogen define appDirectory: "app", buildDirectory: "dist",
  // ssr: true e as flags que o Oxygen exige (v8_middleware, v8_splitRouteModules).
  // Ele também bloqueia o que o CLI do Hydrogen não suporta: basename, prerender,
  // serverBundles, buildEnd e subResourceIntegrity.
  presets: [hydrogenPreset()],
} satisfies Config;
