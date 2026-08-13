/**
 * Jogos do Vasco a partir do calendário do Transfermarkt.
 *
 * A página traz a **temporada inteira** — passados com placar e futuros com
 * "-:-" — agrupada por competição, que é exatamente o que os widgets de
 * "últimos 5" e "próximos 5" precisam. Não há API pública: isto é leitura do
 * HTML, então quebra se o Transfermarkt mudar o layout. O erro fica registrado
 * em `settings.matches.lastError` e os jogos já gravados continuam no ar.
 *
 * Uso não-comercial e com uma requisição por sincronização; não paralelize nem
 * aumente a frequência sem necessidade.
 */
import { Match } from "../models/Match.js";
import { Setting, getSettings } from "../models/Setting.js";
import {
  cleanHtml as clean,
  decodeEntities,
  fetchTransfermarkt,
  slugKey,
} from "../lib/transfermarkt.js";


export const DEFAULT_TM_URL =
  "https://www.transfermarkt.com.br/vasco-da-gama/spielplan/verein/978";




/** "qui 29/01/2026" + "20:00" → Date. Horário do Transfermarkt é de Brasília. */
function parseDate(dateCell: string, timeCell: string): Date | null {
  const match = /(\d{2})\/(\d{2})\/(\d{4})/.exec(dateCell);
  if (!match) return null;
  const [, day, month, year] = match;
  const time = /(\d{1,2}):(\d{2})/.exec(timeCell);
  const hour = time ? time[1].padStart(2, "0") : "21";
  const minute = time ? time[2] : "00";
  // -03:00 é o fuso de Brasília, que é como o site publica os horários.
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:00-03:00`);
}

export interface ParsedMatch {
  externalId: string;
  opponent: string;
  date: Date;
  competition: string;
  venue: "home" | "away";
  scoreFor: number | null;
  scoreAgainst: number | null;
}

/** Separado do fetch para poder ser testado com HTML salvo. */
export function parseFixtures(html: string): ParsedMatch[] {
  const matches: ParsedMatch[] = [];

  // Cada competição é uma "box" com <h2> de título e uma tabela de jogos.
  for (const box of html.split(/(?=<div class="box">)/)) {
    const heading = /<h2[^>]*>([\s\S]*?)<\/h2>/.exec(box);
    const competition = heading ? clean(heading[1]) : "";
    if (!competition || /balanço|balanco/i.test(competition)) continue;

    for (const row of box.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
      const cells = row.match(/<td[^>]*>[\s\S]*?<\/td>/g) ?? [];
      if (cells.length < 8) continue;

      const text = cells.map(clean);
      const date = parseDate(text[1] ?? "", text[2] ?? "");
      if (!date) continue;

      // Adversário: âncora que aponta para o perfil do outro clube
      // (/<slug>/startseite/verein/<id>). O `title` traz o nome completo
      // ("Mirassol FC"); o texto da âncora vem abreviado ("Mirassol").
      const clubAnchor = row.match(/<a[^>]*href="\/[^"]*\/startseite\/verein\/\d+[^"]*"[^>]*>/g) ?? [];
      const titled = clubAnchor.map((a) => /title="([^"]{2,60})"/.exec(a)?.[1]).find(Boolean);
      const opponent =
        titled ??
        /href="\/[^"]*\/startseite\/verein\/\d+[^"]*"[^>]*>([^<]{2,60})<\/a>/.exec(row)?.[1];
      if (!opponent) continue;

      const venue = (text[3] ?? "").toUpperCase().startsWith("C") ? "home" : "away";

      // Placar sempre no formato mandante:visitante. "-:-" = jogo futuro.
      const score = /(\d+):(\d+)/.exec(text[text.length - 1] ?? "");
      let scoreFor: number | null = null;
      let scoreAgainst: number | null = null;
      if (score) {
        const [home, away] = [Number(score[1]), Number(score[2])];
        scoreFor = venue === "home" ? home : away;
        scoreAgainst = venue === "home" ? away : home;
      }

      // Id do relatório quando existe; senão, data + adversário identificam o jogo.
      const reportId = /\/spielbericht\/index\/spielbericht\/(\d+)/.exec(row)?.[1];
      const externalId = reportId
        ? `tm:${reportId}`
        : `tm:${date.toISOString().slice(0, 10)}:${decodeEntities(opponent).toLowerCase().replace(/\s+/g, "-")}`;

      matches.push({
        externalId,
        opponent: decodeEntities(opponent).trim(),
        date,
        competition,
        venue,
        scoreFor,
        scoreAgainst,
      });
    }
  }

  return matches;
}

export async function syncTransfermarkt(): Promise<{ upserted: number; url: string }> {
  const settings = await getSettings();
  const url = settings.matches?.transfermarktUrl || DEFAULT_TM_URL;

  try {
    const parsed = parseFixtures(await fetchTransfermarkt(url));
    if (!parsed.length) {
      throw new Error("Nenhum jogo encontrado — o layout do Transfermarkt pode ter mudado.");
    }

    for (const match of parsed) {
      await Match.updateOne(
        { externalId: match.externalId },
        {
          $set: {
            opponent: match.opponent,
            date: match.date,
            competition: match.competition,
            venue: match.venue,
            scoreFor: match.scoreFor,
            scoreAgainst: match.scoreAgainst,
          },
          // `ticketUrl` fora do $set: é do admin e não pode ser sobrescrito.
          $setOnInsert: { externalId: match.externalId },
        },
        { upsert: true },
      );
    }

    // Os registros da fonte antiga viravam duplicata dos mesmos jogos.
    await Match.deleteMany({ externalId: { $regex: "^sportsdb:" } });

    await Setting.updateOne(
      { key: "site" },
      {
        $set: {
          "matches.transfermarktUrl": url,
          "matches.lastSyncAt": new Date(),
          "matches.lastError": null,
          "matches.lastCount": parsed.length,
        },
      },
      { upsert: true },
    );

    return { upserted: parsed.length, url };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await Setting.updateOne(
      { key: "site" },
      { $set: { "matches.lastSyncAt": new Date(), "matches.lastError": message } },
      { upsert: true },
    );
    throw error;
  }
}
