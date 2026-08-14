/** Agendamento dentro do próprio processo da API.
 *
 *  Por que aqui e não em cron jobs do Render: o serviço web já fica ligado 24h
 *  no plano pago, então rodar os jobs nele não custa nada além do que já se
 *  paga. Cron job no Render é serviço separado e cobrado à parte — para dois
 *  jobs leves como estes, o isolamento não compensava o custo.
 *
 *  A troca consciente: se um job travar de forma catastrófica, ele leva a API
 *  junto. Por isso todo job roda dentro de try/catch e nunca propaga erro — o
 *  pior caso vira uma linha de log, não uma queda.
 *
 *  Não usa biblioteca de cron de propósito: `setInterval` resolve para
 *  "a cada N minutos" e evita mais uma dependência no bundle.
 */
import { ingestAll } from "./jobs/ingest.js";
import { syncYoutube } from "./jobs/youtube.js";
import { syncAll as syncMatches, MatchSyncDisabled } from "./jobs/matches.js";
import { syncMarket } from "./jobs/market.js";

const MINUTO = 60_000;

/** RSS a cada 15 min: é o que traz notícia nova sem ninguém digitar. */
const INTERVALO_RSS = 15 * MINUTO;
/** Vídeos, jogos e mercado mudam devagar; de hora em hora basta. */
const INTERVALO_SYNC = 60 * MINUTO;
/** Espera antes da primeira rodada: deixa o processo terminar de subir e o
 *  health check do Render passar antes de disputar CPU com a ingestão. */
const ATRASO_INICIAL = 2 * MINUTO;

/** Roda a tarefa sem nunca deixar o erro escapar para o processo. */
async function protegido(nome: string, tarefa: () => Promise<string>) {
  const inicio = Date.now();
  try {
    const resumo = await tarefa();
    console.log(`[scheduler] ${nome}: ${resumo} (${Date.now() - inicio}ms)`);
  } catch (error) {
    console.error(`[scheduler] ${nome} falhou:`, error instanceof Error ? error.message : error);
  }
}

async function rodarRss() {
  await protegido("rss", async () => {
    const { imported, sources } = await ingestAll();
    return `${imported} post(s) de ${sources} fonte(s)`;
  });
}

async function rodarSync() {
  await protegido("youtube", async () => {
    const yt = await syncYoutube();
    return `${yt.imported} novo(s) de ${yt.total}`;
  });

  await protegido("jogos", async () => {
    try {
      const r = await syncMatches();
      return `${r.upserted} jogo(s) via ${r.provider}`;
    } catch (error) {
      // Ausência de token não é falha: é configuração. Vira log normal.
      if (error instanceof MatchSyncDisabled) return error.message;
      throw error;
    }
  });

  await protegido("mercado", async () => {
    const m = await syncMarket();
    return `${m.rumours} boato(s) · ${m.signings} transferência(s)`;
  });
}

/**
 * Liga o agendador.
 *
 * Desligado por padrão fora de produção: rodar a ingestão a cada 15 min na
 * máquina de quem desenvolve encheria o banco local e bateria nos feeds à toa.
 * `SCHEDULER=on` força ligar, `SCHEDULER=off` força desligar.
 */
export function startScheduler(isProd: boolean) {
  const flag = process.env.SCHEDULER;
  const ligado = flag === "on" || (flag !== "off" && isProd);

  if (!ligado) {
    console.log("[scheduler] desligado (SCHEDULER=on para ligar fora de produção)");
    return;
  }

  console.log(
    `[scheduler] ligado · rss a cada ${INTERVALO_RSS / MINUTO}min · sync a cada ${INTERVALO_SYNC / MINUTO}min`,
  );

  setTimeout(() => {
    void rodarRss();
    void rodarSync();
    setInterval(() => void rodarRss(), INTERVALO_RSS);
    setInterval(() => void rodarSync(), INTERVALO_SYNC);
  }, ATRASO_INICIAL);
}
