/** Casos de referência do agrupamento de notícias duplicadas.
 *  Uso: npm run dedupe:check — sai com 1 se algum caso regredir. */
import { titleFingerprint, titleSimilarity } from "@ntv/shared";

const iguais: [string, string][] = [
  ["Vasco vence o Fluminense por 3 a 1", "Vasco vence Fluminense por 3 a 1"],
  ["Adson ganha chance no ataque do Vasco", "No ataque do Vasco, Adson ganha chance"],
  ["Vasco encaminha contratação de zagueiro colombiano", "Vasco encaminha a contratação do zagueiro colombiano"],
];

const diferentes: [string, string][] = [
  ["Vasco vence o Fluminense por 3 a 1", "Vasco perde para o Flamengo por 3 a 1"],
  ["Adson ganha chance no ataque do Vasco", "Brenner sofre lesão e desfalca o Vasco"],
  ["Vasco anuncia novo patrocinador máster", "Vasco anuncia novo técnico para a temporada"],
];

let ok = 0;
const total = iguais.length + diferentes.length;

for (const [a, b] of iguais) {
  const same = titleFingerprint(a) === titleFingerprint(b);
  console.log(`${same ? "OK    " : "FALHOU"} | devia agrupar (sim=${same}, similaridade=${titleSimilarity(a, b).toFixed(2)}) | ${a}`);
  if (same) ok++;
}
for (const [a, b] of diferentes) {
  const same = titleFingerprint(a) === titleFingerprint(b);
  console.log(`${!same ? "OK    " : "FALHOU"} | NÃO devia agrupar (sim=${same}, similaridade=${titleSimilarity(a, b).toFixed(2)}) | ${a}`);
  if (!same) ok++;
}

console.log(`\n${ok}/${total} casos corretos`);
if (ok !== total) process.exit(1);
