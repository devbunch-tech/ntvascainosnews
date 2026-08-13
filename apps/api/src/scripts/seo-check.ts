/** Casos de referência da geração de SEO. Uso: npm run seo:check */
import { buildPostSeo, buildDescription, buildKeywords } from "@ntv/shared";

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
];

console.log();
for (const [label, passed] of checks) {
  console.log(`${passed ? "OK    " : "FALHOU"} | ${label}`);
  if (passed) ok++;
}
console.log(`\n${ok}/${checks.length} casos corretos`);
if (ok !== checks.length) process.exit(1);
