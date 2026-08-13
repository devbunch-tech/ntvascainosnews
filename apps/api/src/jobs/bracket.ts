/**
 * Chaveamento das copas (mata-mata), lido do Transfermarkt.
 *
 * A página `/gesamtspielplan/pokalwettbewerb/<CODE>` traz a competição inteira:
 * uma linha de cabeçalho por fase ("Oitavas de final - Jogos de ida") seguida
 * das linhas de confronto. Serve para Copa do Brasil e Sul-Americana.
 *
 * Cuidado que o parser precisa ter: a página da Sul-Americana **mistura** as
 * tabelas da fase de grupos com os confrontos do mata-mata. O que separa os
 * dois é a quantidade de clubes na linha — confronto tem dois, classificação
 * tem um.
 */
import { Bracket } from "../models/Bracket.js";
import { Setting } from "../models/Setting.js";
import {
  cleanHtml as clean,
  decodeEntities,
  fetchTransfermarkt,
  slugKey,
} from "../lib/transfermarkt.js";

export interface BracketTie {
  home: string;
  away: string;
  score: string | null;
  date: Date | null;
  /** Marca o confronto do Vasco, para destacar na tela. */
  highlight: boolean;
}

export interface BracketRound {
  name: string;
  order: number;
  ties: BracketTie[];
}

/**
 * Nomes dos clubes na linha, na ordem em que aparecem, sem repetir.
 *
 * A ordem dos atributos varia (`<a title href>` e `<a href title>`), então
 * casamos a âncora inteira e lemos o `title` num segundo passo. O mesmo clube
 * costuma aparecer duas ou três vezes na linha (escudo + nome), daí o dedupe.
 */
function clubsIn(row: string): string[] {
  const names: string[] = [];

  for (const anchor of row.match(/<a\b[^>]*>/g) ?? []) {
    if (!/href="\/[^"]*\/verein\/\d+/.test(anchor)) continue;
    const title = /title="([^"]{2,50})"/.exec(anchor)?.[1];
    if (!title) continue;
    const name = decodeEntities(title).trim();
    if (name && name !== names[names.length - 1]) names.push(name);
  }

  return names;
}

function parseDate(cells: string[]): Date | null {
  const raw = cells.find((c) => /\d{2}\/\d{2}\/\d{4}/.test(c));
  const match = raw && /(\d{2})\/(\d{2})\/(\d{4})/.exec(raw);
  if (!match) return null;
  const time = cells.find((c) => /^\d{1,2}:\d{2}$/.test(c)) ?? "21:00";
  const [hour, minute] = time.split(":");
  return new Date(`${match[3]}-${match[2]}-${match[1]}T${hour.padStart(2, "0")}:${minute}:00-03:00`);
}

export function parseBracket(html: string, team = /vasco/i): BracketRound[] {
  const rounds: BracketRound[] = [];
  let current: BracketRound | null = null;

  for (const row of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
    // Cabeçalho de fase: célula com colspan e link para a rodada.
    const header = /<td[^>]*colspan="\d+"[^>]*>\s*<a[^>]*>([^<]{3,60})<\/a>/.exec(row);
    if (header) {
      current = { name: decodeEntities(header[1]).trim(), order: rounds.length, ties: [] };
      rounds.push(current);
      continue;
    }
    if (!current) continue;

    // Dois clubes na linha = confronto. Um só = linha de classificação de grupo.
    const clubs = clubsIn(row);
    if (clubs.length < 2) continue;

    const cells = (row.match(/<td[^>]*>[\s\S]*?<\/td>/g) ?? []).map(clean);

    // As duas primeiras células são data e HORA — "19:30" casa com o mesmo
    // formato de um placar e seria lido como 19 a 30. O placar só aparece da
    // terceira em diante; "-:-" é jogo que ainda não aconteceu.
    const score = cells.slice(2).find((c) => /^\d{1,2}:\d{1,2}(\s|$)/.test(c)) ?? null;

    current.ties.push({
      home: clubs[0],
      away: clubs[1],
      score: score ? score.trim() : null,
      date: parseDate(cells),
      highlight: team.test(clubs[0]) || team.test(clubs[1]),
    });
  }

  return rounds.filter((round) => round.ties.length > 0);
}

export interface CupTarget {
  slug: string;
  code: string;
  name: string;
}

/** Competições do clube na temporada, tiradas dos blocos da página de jogos. */
export function competitionsOf(fixturesHtml: string): CupTarget[] {
  const out: CupTarget[] = [];

  for (const box of fixturesHtml.split(/(?=<div class="box">)/)) {
    const heading = /<h2[^>]*>([\s\S]*?)<\/h2>/.exec(box);
    if (!heading) continue;
    const name = clean(heading[1]);
    if (!name || /classifica|balan/i.test(name)) continue;

    const link = /href="\/([a-z0-9-]+)\/startseite\/wettbewerb\/([A-Z0-9]{2,6})/.exec(box);
    if (!link) continue;
    if (out.some((item) => item.code === link[2])) continue;

    out.push({ slug: link[1], code: link[2], name });
  }

  return out;
}

export async function syncBrackets(fixturesHtml: string, origin: string) {
  const competitions = competitionsOf(fixturesHtml);
  let saved = 0;

  for (const [index, competition] of competitions.entries()) {
    const url = `${origin}/${competition.slug}/gesamtspielplan/pokalwettbewerb/${competition.code}`;

    try {
      const rounds = parseBracket(await fetchTransfermarkt(url));
      // Liga não tem mata-mata: a página existe mas volta sem fase nenhuma.
      if (!rounds.length) continue;

      await Bracket.updateOne(
        { key: slugKey(competition.name) },
        {
          $set: {
            competition: competition.name,
            rounds,
            order: index,
            sourceUrl: url,
            lastSyncAt: new Date(),
          },
        },
        { upsert: true },
      );
      saved += 1;
    } catch (error) {
      console.error(
        `[chaveamento] ${competition.name} falhou:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  await Setting.updateOne(
    { key: "site" },
    { $set: { "brackets.lastSyncAt": new Date(), "brackets.lastCount": saved } },
    { upsert: true },
  );

  return { saved, competitions: competitions.length };
}
