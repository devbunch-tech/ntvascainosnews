/** Entrypoint dos sincronizadores externos: `npm run sync`.
 *  Em produção, registrar como cron (YouTube a cada hora, jogos 2× ao dia). */
import { connectDB, disconnectDB } from "../db.js";
import { syncYoutube } from "./youtube.js";
import { syncAll as syncMatches, MatchSyncDisabled } from "./matches.js";
import { syncMarket } from "./market.js";

await connectDB();

try {
  const yt = await syncYoutube();
  console.log(`[youtube] ${yt.imported} novo(s) de ${yt.total} · canal "${yt.channelTitle}"`);
} catch (error) {
  console.error("[youtube] falhou:", error instanceof Error ? error.message : error);
}

try {
  const result = await syncMatches();
  console.log(`[jogos] ${result.upserted} jogo(s) via ${result.provider}${result.standings ? " · classificação ok" : ""}`);
} catch (error) {
  if (error instanceof MatchSyncDisabled) console.log(`[jogos] ${error.message}`);
  else console.error("[jogos] falhou:", error instanceof Error ? error.message : error);
}

try {
  const market = await syncMarket();
  console.log(
    `[mercado] ${market.rumours} boato(s) · ${market.signings} transferência(s) · ${market.standings} tabela(s) · ${market.brackets} chaveamento(s)`,
  );
} catch (error) {
  console.error("[mercado] falhou:", error instanceof Error ? error.message : error);
}

await disconnectDB();
