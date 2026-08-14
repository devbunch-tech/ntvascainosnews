import { type RouteConfig, index, route } from "@react-router/dev/routes";
import { hydrogenRoutes } from "@shopify/hydrogen";

// `hydrogenRoutes` acrescenta as rotas virtuais do Hydrogen em dev
// (GraphiQL em /graphiql e o Subrequest Profiler em /subrequest-profiler).
export default hydrogenRoutes([
  index("routes/home.tsx"),
  route("noticia/:slug", "routes/post.tsx"),
  route("noticias", "routes/noticias.tsx"),
  route("ntv-exclusivo", "routes/exclusivo.tsx"),
  route("tabela", "routes/tabela.tsx"),
  route("mercado", "routes/mercado.tsx"),
  route("busca", "routes/busca.tsx"),
  route("loja", "routes/loja.tsx"),
  route("inscricao", "routes/inscricao.tsx"),
  route("entrar", "routes/entrar.tsx"),
  route("perfil", "routes/perfil.tsx"),
  route("sair", "routes/sair.tsx"),
  route("api/ultimas", "routes/api.ultimas.tsx"),
  route("api/votar", "routes/api.votar.tsx"),
  route("api/comentar", "routes/api.comentar.tsx"),
  route("api/clique-loja", "routes/api.clique-loja.tsx"),
  route("api/clique-anuncio", "routes/api.clique-anuncio.tsx"),
  route("anuncie", "routes/anuncie.tsx"),
  route("robots.txt", "routes/robots.tsx"),
  // O Oxygen reserva o caminho exato /sitemap.xml e responde 404 antes de chegar
  // no worker (header `oxygen-static-page: 404`), então o índice é servido aqui.
  route("sitemap-index.xml", "routes/sitemap.tsx"),
  route("sitemap-news.xml", "routes/sitemap-news.tsx"),
  route("feed.xml", "routes/feed.tsx"),
]) satisfies RouteConfig;
