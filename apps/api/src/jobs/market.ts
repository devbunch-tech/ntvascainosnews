/**
 * Mercado da bola e classificação, lidos do Transfermarkt.
 *
 * - **Boatos** (`/geruechte/verein/978`) viram enquetes: cada especulação abre
 *   uma votação "aprova / reprova" na sidebar.
 * - **Transferências** (`/transfers/verein/978`) alimentam a lista de
 *   contratações confirmadas da temporada.
 * - **Classificação** sai da própria página de calendário, que já traz a tabela
 *   de cada competição disputada.
 *
 * Mesma ressalva do `transfermarkt.ts`: é leitura de HTML, quebra se o layout
 * mudar, e o erro fica registrado em `settings.market.lastError`.
 */
import { Poll } from "../models/Poll.js";
import { Signing } from "../models/Signing.js";
import { Standing } from "../models/Standing.js";
import { Setting, getSettings } from "../models/Setting.js";
import { syncBrackets } from "./bracket.js";
import {
  cleanHtml as clean,
  decodeEntities,
  fetchTransfermarkt,
  slugKey,
} from "../lib/transfermarkt.js";






/** Deriva as URLs irmãs a partir da URL de calendário salva nas configurações. */
export function relatedUrls(fixturesUrl: string) {
  const match = /^(https?:\/\/[^/]+)\/([^/]+)\/[^/]+\/verein\/(\d+)/.exec(fixturesUrl);
  if (!match) return null;
  const [, origin, slug, id] = match;
  return {
    rumours: `${origin}/${slug}/geruechte/verein/${id}`,
    transfers: `${origin}/${slug}/transfers/verein/${id}`,
    fixtures: fixturesUrl,
  };
}

/**
 * As linhas do Transfermarkt contêm tabelas aninhadas (foto + nome), e um
 * `<tr>…</tr>` não-guloso termina no `</tr>` **interno** — cortando fora as
 * colunas de posição, clube e valor. As linhas externas são as que têm
 * `class="odd"`/`"even"`, então fatiamos por elas.
 */
function outerRows(html: string): string[] {
  const markers = [...html.matchAll(/<tr class="(?:odd|even)"[^>]*>/g)];
  return markers.map((marker, index) => {
    const start = marker.index ?? 0;
    const end = index + 1 < markers.length ? (markers[index + 1].index ?? html.length) : html.length;
    return html.slice(start, end);
  });
}

const playerAnchor = (row: string) =>
  /<a[^>]*href="\/[^"]*\/profil\/spieler\/\d+"[^>]*>([^<]{2,60})<\/a>/.exec(row)?.[1] ??
  /<a[^>]*href="\/[^"]*\/profil\/spieler\/(\d+)"[^>]*title="([^"]{2,60})"/.exec(row)?.[2];

const playerId = (row: string) => /\/profil\/spieler\/(\d+)/.exec(row)?.[1] ?? null;

/** Qualquer âncora de clube na linha, tirando o próprio Vasco. */
function otherClub(row: string): string {
  const titles = [...row.matchAll(/<a[^>]*href="\/[^"]*\/verein\/\d+[^"]*"[^>]*title="([^"]{2,50})"/g)].map(
    (m) => m[1],
  );
  const images = [...row.matchAll(/<img[^>]*class="[^"]*tiny_wappen[^"]*"[^>]*(?:title|alt)="([^"]{2,50})"/g)].map(
    (m) => m[1],
  );
  return [...titles, ...images].find((value) => !/vasco/i.test(value)) ?? "";
}

/** Posição do jogador, que o site marca no `title` de uma célula. */
const POSITIONS =
  /(Goleiro|Zagueiro|Lateral[ -]\w+|Volante|Meio[ -]Campo|Meia[ -]?\w*|Ponta[ -]?\w*|Atacante|Centroavante)/i;

function positionOf(row: string): string {
  const titled = [...row.matchAll(/\btitle="([^"]{3,30})"/g)]
    .map((m) => m[1])
    .find((value) => POSITIONS.test(value));
  return titled ?? POSITIONS.exec(clean(row))?.[1] ?? "";
}

const playerPhoto = (row: string) =>
  /<img[^>]+src="(https:\/\/img\.a\.transfermarkt\.technology\/portrait\/[^"]+)"/.exec(row)?.[1] ??
  null;

/* ------------------------------ Boatos ------------------------------ */

export interface ParsedRumour {
  externalId: string;
  name: string;
  position: string;
  club: string;
  fee: string | null;
  probability: number | null;
  photo: string | null;
}

export function parseRumours(html: string): ParsedRumour[] {
  const out: ParsedRumour[] = [];
  const seen = new Set<string>();

  // A linha do boato tem uma tabela aninhada (foto + nome), então contar <td>
  // não funciona: o não-guloso quebra no </td> interno. Extraímos por campo.
  for (const row of outerRows(html)) {
    const id = playerId(row);
    const name = playerAnchor(row);
    if (!id || !name || seen.has(id)) continue;

    const position = positionOf(row);
    const club = otherClub(row);

    const text = clean(row);
    const fee = /(\d[\d.,]*\s*(?:mi\.?|mil)\s*€|€\s*[\d.,]+\s*(?:mi|mil)?|livre|empréstimo)/i.exec(text)?.[1] ?? null;
    const probability = Number(/(\d{1,3})\s*%/.exec(text)?.[1]);

    seen.add(id);
    out.push({
      externalId: `tm-rumour:${id}`,
      name: decodeEntities(name).trim(),
      position: decodeEntities(position).trim(),
      club: decodeEntities(club).trim(),
      fee,
      probability: Number.isFinite(probability) ? probability : null,
      photo: playerPhoto(row),
    });
  }

  return out;
}

/* --------------------------- Transferências --------------------------- */

export interface ParsedSigning {
  externalId: string;
  playerName: string;
  position: string | null;
  age: number | null;
  club: string | null;
  fee: string | null;
  photo: string | null;
  direction: "in" | "out";
}

export function parseTransfers(html: string): ParsedSigning[] {
  const out: ParsedSigning[] = [];
  const seen = new Set<string>();

  // A página tem dois blocos: chegadas e saídas.
  for (const box of html.split(/(?=<div class="box">)/)) {
    const heading = /<h2[^>]*>([\s\S]*?)<\/h2>/.exec(box);
    const title = heading ? clean(heading[1]).toLowerCase() : "";
    if (!/chegad|entrada|zug|arrival|sa[ií]d|abg|departure/i.test(title)) continue;

    const direction: "in" | "out" = /chegad|entrada|zug|arrival/i.test(title) ? "in" : "out";

    for (const row of outerRows(box)) {
      const id = playerId(row);
      const name = playerAnchor(row);
      const key = `${direction}:${id}`;
      if (!id || !name || seen.has(key)) continue;
      seen.add(key);

      const text = clean(row);
      const club = otherClub(row) || null;

      const age = Number(/\b(1[6-9]|[2-4]\d)\b/.exec(text)?.[1]);
      const fee =
        /(\d[\d.,]*\s*(?:mi\.?|mil)\s*€|livre|empréstimo|fim de contrato|desconhecid[oa])/i.exec(text)?.[1] ??
        null;

      out.push({
        externalId: `tm-transfer:${direction}:${id}`,
        playerName: decodeEntities(name).trim(),
        position: decodeEntities(positionOf(row)) || null,
        age: Number.isFinite(age) ? age : null,
        club: club ? decodeEntities(club) : null,
        fee,
        photo: playerPhoto(row),
        direction,
      });
    }
  }

  return out;
}

/* --------------------------- Classificação --------------------------- */


export interface ParsedStanding {
  key: string;
  competition: string;
  rows: {
    position: number;
    team: string;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDiff: number;
    points: number;
    highlight: boolean;
  }[];
}

/** Competições com tabela própria, descobertas na página de calendário. */
export function competitionTableUrls(fixturesHtml: string, origin: string): { url: string; name: string }[] {
  const found = new Map<string, { url: string; name: string }>();

  for (const match of fixturesHtml.matchAll(
    /href="(\/([a-z0-9-]+)\/tabelle\/wettbewerb\/([A-Z0-9]{2,6}))"/g,
  )) {
    const [, path, slug, code] = match;
    if (found.has(code)) continue;
    found.set(code, {
      url: `${origin}${path}`,
      name: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    });
  }

  return [...found.values()];
}

/** Tabela completa da página `/tabelle/wettbewerb/<CODE>`. */
export function parseStandingTable(html: string): ParsedStanding["rows"] {
  const rows: ParsedStanding["rows"] = [];

  // A tabela usa links /spielplan/verein/ (não /startseite/), e as colunas são
  // [pos, escudo, clube, J, V, E, D, GP:GC, SG, P].
  for (const row of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
    if (!/\/verein\/\d+/.test(row)) continue;

    const cells = (row.match(/<td[^>]*>[\s\S]*?<\/td>/g) ?? []).map(clean);
    if (cells.length < 8) continue;

    const position = Number(cells[0]?.replace(/\D/g, ""));
    if (!Number.isFinite(position) || position < 1) continue;

    const team = cells[2]?.replace(/\s+/g, " ").trim();
    if (!team || /^\d/.test(team)) continue;

    const goals = cells.find((c) => /^\d+:\d+$/.test(c));
    const [goalsFor, goalsAgainst] = goals ? goals.split(":").map(Number) : [0, 0];
    const num = (index: number) => Number(cells[index]?.replace(/[^\d-]/g, "")) || 0;

    rows.push({
      position,
      team: decodeEntities(team).trim(),
      played: num(3),
      wins: num(4),
      draws: num(5),
      losses: num(6),
      goalsFor,
      goalsAgainst,
      goalDiff: goalsFor - goalsAgainst,
      points: num(cells.length - 1),
      highlight: /vasco/i.test(team),
    });
  }

  return rows;
}

/* ------------------------------ Sync ------------------------------ */

export async function syncMarket(): Promise<{
  rumours: number;
  signings: number;
  standings: number;
  brackets: number;
}> {
  const settings = await getSettings();
  const urls = relatedUrls(
    settings.matches?.transfermarktUrl ??
      "https://www.transfermarkt.com.br/vasco-da-gama/spielplan/verein/978",
  );
  if (!urls) throw new Error("URL do Transfermarkt em formato inesperado.");

  try {
    const [rumoursHtml, transfersHtml, fixturesHtml] = [
      await fetchTransfermarkt(urls.rumours),
      await fetchTransfermarkt(urls.transfers),
      await fetchTransfermarkt(urls.fixtures),
    ];

    // --- boatos → enquetes ---
    // Guarda a janela inteira: a sidebar mostra 5, a página /mercado mostra tudo.
    const rumours = parseRumours(rumoursHtml).slice(0, 40);
    for (const [index, rumour] of rumours.entries()) {
      await Poll.updateOne(
        { externalId: rumour.externalId },
        {
          $set: {
            "player.name": rumour.name,
            "player.position": rumour.position,
            "player.club": rumour.club,
            "player.photo": rumour.photo,
            fee: rumour.fee,
            probability: rumour.probability,
            rumouredAt: new Date(),
            order: index,
          },
          $setOnInsert: {
            externalId: rumour.externalId,
            question: `${rumour.name} no Vasco: você aprova?`,
            status: "open",
            votes: { good: 0, bad: 0 },
          },
        },
        { upsert: true },
      );
    }

    // --- transferências confirmadas ---
    const signings = parseTransfers(transfersHtml);
    for (const [index, signing] of signings.entries()) {
      await Signing.updateOne(
        { externalId: signing.externalId },
        { $set: { ...signing, order: index, season: settings.matches?.season ?? null } },
        { upsert: true },
      );
    }

    // --- classificação: uma requisição por competição que tenha tabela ---
    const origin = new URL(urls.fixtures).origin;
    const competitions = competitionTableUrls(fixturesHtml, origin);
    let standings = 0;

    for (const [index, competition] of competitions.entries()) {
      const rows = parseStandingTable(await fetchTransfermarkt(competition.url));
      if (rows.length < 4) continue;

      await Standing.updateOne(
        { key: slugKey(competition.name) },
        {
          $set: {
            competition: competition.name,
            rows,
            order: index,
            sourceUrl: competition.url,
            lastSyncAt: new Date(),
          },
        },
        { upsert: true },
      );
      standings += 1;
    }

    // Copas: chaveamento completo, a partir da mesma lista de competições.
    const brackets = await syncBrackets(fixturesHtml, origin);

    await Setting.updateOne(
      { key: "site" },
      { $set: { "market.lastSyncAt": new Date(), "market.lastError": null } },
      { upsert: true },
    );

    return {
      rumours: rumours.length,
      signings: signings.length,
      standings,
      brackets: brackets.saved,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await Setting.updateOne(
      { key: "site" },
      { $set: { "market.lastSyncAt": new Date(), "market.lastError": message } },
      { upsert: true },
    );
    throw error;
  }
}
