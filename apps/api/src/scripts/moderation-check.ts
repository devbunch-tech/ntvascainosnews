/** Casos de referência do filtro de comentários.
 *  Uso: npm run mod:check — sai com código 1 se algum caso regredir. */
import { moderateComment } from "@ntv/shared";
const casos: [string, boolean][] = [
  ["Que jogo espetacular do Vasco ontem!", true],
  ["O Adson foi bem na lateral-direita e o pé esquerdo do camisa 10 decidiu", true],
  ["Eleição no Vasco vai definir o novo presidente do clube", true],
  ["Esse juiz é um merda", false],
  ["Que caraaaalho de arbitragem", false],
  ["c.a.r.a.l.h.o que roubo", false],
  ["V0CE E UM 0TARI0", false],
  ["O Bolsonaro devia opinar sobre isso", false],
  ["Culpa do STF e do Congresso Nacional", false],
  ["Time comunista de novo", false],
  ["computo os gols e o Vasco venceu", true],
  ["O presidente do clube falou na assembleia", true],
];
let ok = 0;
for (const [texto, esperado] of casos) {
  const v = moderateComment(texto);
  const passou = v.allowed === esperado;
  if (passou) ok++;
  console.log(`${passou ? "OK " : "FALHOU"} | permitido=${v.allowed} (esperado ${esperado}) ${v.category ? "[" + v.category + ":" + v.term + "]" : ""} | ${texto}`);
}
console.log(`\n${ok}/${casos.length} casos corretos`);
if (ok !== casos.length) process.exit(1);
