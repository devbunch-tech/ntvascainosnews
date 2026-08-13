import type { Config } from "@react-router/dev/config";

export default {
  // SSR ligado: é o que o Oxygen executa em produção.
  ssr: true,
  // Hydrogen 2025+ é construído sobre React Router 7 em framework mode —
  // este arquivo é o mesmo que o template do Hydrogen usa.
  appDirectory: "app",
  buildDirectory: "build",
} satisfies Config;
