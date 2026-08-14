/**
 * Casos de referência das regras que rodam sem banco: geração de SEO, caminhos
 * de arquivo e a resolução da sidebar configurável.
 *
 * Uso: npm run seo:check
 */
import {
  buildPostSeo,
  buildDescription,
  buildKeywords,
  categoryPath,
  tagPath,
  resolveSidebarWidgets,
  resolveAdLimit,
  SIDEBAR_WIDGETS,
} from "@ntv/shared";
import { normalizeSigningName } from "../jobs/market.js";

const post = {
  title: "Vasco anuncia a contratação do volante Santiago Sosa",
  subtitle: "Argentino de 26 anos chega por empréstimo de uma temporada com opção de compra.",
  body: "<p>O Vasco acertou a contratação...</p>",
  tags: ["mercado da bola", "reforço"],
  category: "Mercado da Bola",
};

const seo = buildPostSeo(post);
console.log("descrição:", seo.description);
console.log("tamanho:", seo.description.length, "(ideal ≤ 158)");
console.log("keywords:", seo.keywords.join(", "));
console.log("geo:", seo.geo.placename, "|", seo.geo.position);

let ok = 0;
const checks: [string, boolean][] = [
  ["descrição usa o subtítulo", seo.description.startsWith("Argentino de 26 anos")],
  ["descrição dentro do limite", seo.description.length <= 158],
  ["keywords começam pelas tags", seo.keywords[0] === "mercado da bola"],
  // A tag "mercado da bola" e a categoria são a mesma palavra: o dedupe é
  // insensível a caixa e mantém só a primeira. Por isso a comparação em minúsculas.
  [
    "keywords incluem a categoria",
    seo.keywords.some((k) => k.toLowerCase() === "mercado da bola"),
  ],
  ["keywords pegam o nome próprio", seo.keywords.some((k) => /Santiago Sosa/i.test(k))],
  ["keywords incluem a marca", seo.keywords.includes("Vasco da Gama")],
  ["keywords no teto de 12", seo.keywords.length <= 12],
  ["geo aponta São Januário", seo.geo.position.startsWith("-22.89")],
  [
    "corpo longo é cortado com reticências",
    buildDescription({ title: "t", body: "<p>" + "palavra ".repeat(80) + "</p>" }).endsWith("…"),
  ],
  ["campo manual tem prioridade", buildPostSeo(post, { description: "Manual" }).description === "Manual"],
  ["sem tags ainda gera keywords", buildKeywords({ title: "Vasco vence o Flamengo" }).length > 0],

  // Arquivos de categoria e tag: o rótulo do banco vira URL, e a rota resolve
  // de volta comparando slugs. Se estas duas funções divergirem do que a rota
  // espera, todo link interno da matéria cai em 404.
  ["categoria vira caminho", categoryPath("Mercado da Bola") === "/categoria/mercado-da-bola"],
  ["tag perde acento no caminho", tagPath("São Januário") === "/tag/sao-januario"],
  ["caminho ignora caixa", tagPath("VASCO DA GAMA") === tagPath("Vasco da Gama")],
  ["pontuação não vaza para a URL", tagPath("Sub-20: base") === "/tag/sub-20-base"],

  // Sidebar configurável: este resolvedor decide o que o visitante vê. Um erro
  // aqui some com widget no site sem ninguém ter mexido na configuração.
  [
    "sem configuração usa a ordem padrão",
    resolveSidebarWidgets(null).map((w) => w.key).join() ===
      SIDEBAR_WIDGETS.map((w) => w.key).join(),
  ],
  ["sem configuração tudo é visível", resolveSidebarWidgets(null).every((w) => w.visible)],
  [
    "a ordem salva manda",
    resolveSidebarWidgets([{ key: "shop", visible: true }, { key: "clubStats", visible: true }])
      .slice(0, 2)
      .map((w) => w.key)
      .join() === "shop,clubStats",
  ],
  [
    "widget novo do código entra no fim, visível",
    (() => {
      const resolved = resolveSidebarWidgets([{ key: "shop", visible: false }]);
      const fresh = resolved.find((w) => w.key === "clubStats");
      return resolved.length === SIDEBAR_WIDGETS.length && fresh?.visible === true;
    })(),
  ],
  ["chave desconhecida é descartada", !resolveSidebarWidgets([{ key: "hack", visible: true }]).some((w) => w.key === "hack")],
  [
    "chave repetida entra uma vez só",
    resolveSidebarWidgets([{ key: "shop", visible: false }, { key: "shop", visible: true }]).filter(
      (w) => w.key === "shop",
    ).length === 1,
  ],
  ["oculto continua na lista, só invisível", resolveSidebarWidgets([{ key: "ads", visible: false }]).find((w) => w.key === "ads")?.visible === false],
  ["limite de campanha aceita 0", resolveAdLimit(0) === 0],
  ["limite de campanha tem teto", resolveAdLimit(999) === 10],
  ["limite inválido cai no padrão", resolveAdLimit(null) === 2 && resolveAdLimit(NaN) === 2],
  ["limite negativo vira 0", resolveAdLimit(-3) === 0],

  // Identidade do jogador entre o cadastro manual e o Transfermarkt. Se esta
  // normalização errar, o reforço aparece duas vezes na sidebar quando a fonte
  // finalmente publicar — e ninguém liga uma coisa à outra.
  ["acento não separa o mesmo jogador", normalizeSigningName("Andrés Gómez") === normalizeSigningName("Andres Gomez")],
  ["caixa não separa", normalizeSigningName("SANTIAGO SOSA") === normalizeSigningName("Santiago Sosa")],
  ["espaço extra não separa", normalizeSigningName("  Facundo   Colidio ") === "facundo colidio"],
  ["pontuação não separa", normalizeSigningName("Vitor Jr.") === normalizeSigningName("Vitor Jr")],
  ["jogadores diferentes não colidem", normalizeSigningName("Santiago Sosa") !== normalizeSigningName("Facundo Colidio")],
];

console.log();
for (const [label, passed] of checks) {
  console.log(`${passed ? "OK    " : "FALHOU"} | ${label}`);
  if (passed) ok++;
}
console.log(`\n${ok}/${checks.length} casos corretos`);
if (ok !== checks.length) process.exit(1);
