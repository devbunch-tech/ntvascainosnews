/**
 * Cadastra contratação à mão, para quando o Transfermarkt ainda não publicou.
 *
 * As contratações da sidebar vêm do scrape do Transfermarkt (`npm run sync`).
 * A fonte atrasa: um jogador pode já estar no BID da CBF e ainda não constar
 * lá. Este script cobre essa janela.
 *
 * Uso:
 *   npm run signing:add -w @ntv/api -- "Nome" --posicao "Volante" --clube "ex-Racing"
 *   npm run signing:add -w @ntv/api -- "Nome" --saida        # registra saída
 *   npm run signing:add -w @ntv/api -- --listar
 *
 * A chave é o nome normalizado, não o externalId: assim rodar duas vezes
 * atualiza em vez de duplicar, e o `reconcileManualSignings` do sync consegue
 * casar este registro com o do Transfermarkt quando ele finalmente aparecer.
 */
import { connectDB, disconnectDB } from "../db.js";
import { Signing } from "../models/Signing.js";
import { normalizeSigningName } from "../jobs/market.js";

const args = process.argv.slice(2);

/** Flags que consomem o argumento seguinte — o resto é posicional. */
const VALUE_FLAGS = ["posicao", "clube", "valor", "foto"];

const flag = (name: string) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};

const positional: string[] = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith("--")) {
    if (VALUE_FLAGS.includes(arg.slice(2))) i++; // pula o valor da flag
    continue;
  }
  positional.push(arg);
}

await connectDB();

if (args.includes("--listar")) {
  const all = await Signing.find().sort({ order: 1, createdAt: -1 }).lean();
  for (const s of all) {
    console.log(
      `${String(s.order).padStart(3)} | ${s.direction} | ${s.playerName} | ${s.position ?? "-"} | ${s.club ?? "-"} | ${s.externalId ?? "-"}`,
    );
  }
  console.log(`\n${all.length} registro(s).`);
  await disconnectDB();
  process.exit(0);
}

const playerName = positional[0];

if (!playerName) {
  console.error('Informe o nome. Ex.: npm run signing:add -w @ntv/api -- "Santiago Sosa" --clube "ex-Racing"');
  await disconnectDB();
  process.exit(1);
}

const direction = args.includes("--saida") ? "out" : "in";
const key = normalizeSigningName(playerName);

// Entra na frente das que vieram do Transfermarkt, que recebem order 0..N.
// Negativo evita ter de renumerar as existentes a cada inclusão.
const first = await Signing.find({ direction }).sort({ order: 1 }).limit(1).lean();
const order = Math.min(0, first[0]?.order ?? 0) - 1;

const existing = await Signing.findOne({ direction, nameKey: key });

await Signing.updateOne(
  { direction, nameKey: key },
  {
    $set: {
      playerName: playerName.trim(),
      nameKey: key,
      direction,
      ...(flag("posicao") ? { position: flag("posicao") } : {}),
      ...(flag("clube") ? { club: flag("clube") } : {}),
      ...(flag("valor") ? { fee: flag("valor") } : {}),
      ...(flag("foto") ? { photo: flag("foto") } : {}),
      ...(existing ? {} : { order, externalId: `manual:${key}`, date: new Date() }),
    },
  },
  { upsert: true },
);

console.log(`${existing ? "Atualizado" : "Cadastrado"}: ${playerName} (${direction}).`);
await disconnectDB();
