/**
 * Sincroniza jogos e classificação do Vasco a partir da football-data.org.
 *
 * A API exige um token gratuito (https://www.football-data.org/client/register).
 * Sem `FOOTBALL_DATA_TOKEN` no ambiente, o job não roda e os jogos continuam
 * sendo os cadastrados à mão no admin — que é o caminho sempre disponível.
 *
 * ATENÇÃO: este adaptador **não foi testado contra a API real**, porque o token
 * é pessoal e precisa ser criado por quem opera o portal. O formato seguido é o
 * documentado na v4 (`/v4/teams/{id}/matches`, `/v4/competitions/BSA/standings`).
 */
import { env } from "../env.js";
import { Match, ClubStat } from "../models/Match.js";
import { syncTransfermarkt } from "./transfermarkt.js";

const BASE = "https://api.football-data.org/v4";
const TIMEOUT_MS = 15000;

/** Vasco da Gama na football-data.org. Sobrescrevível por env. */
const TEAM_ID = Number(process.env.FOOTBALL_DATA_TEAM_ID ?? 1780);
const COMPETITION = process.env.FOOTBALL_DATA_COMPETITION ?? "BSA";

export class MatchSyncDisabled extends Error {
  constructor() {
    super(
      "FOOTBALL_DATA_TOKEN não configurado. Cadastre os jogos no admin ou crie um token gratuito em football-data.org.",
    );
    this.name = "MatchSyncDisabled";
  }
}

async function call<T>(path: string): Promise<T> {
  if (!env.footballDataToken) throw new MatchSyncDisabled();

  const response = await fetch(`${BASE}${path}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "X-Auth-Token": env.footballDataToken },
  });
  if (response.status === 429) throw new Error("Limite de requisições da API atingido.");
  if (!response.ok) throw new Error(`API respondeu HTTP ${response.status}`);
  return (await response.json()) as T;
}

interface ApiMatch {
  id: number;
  utcDate: string;
  status: string;
  competition?: { name?: string };
  homeTeam?: { id?: number; name?: string };
  awayTeam?: { id?: number; name?: string };
  score?: { fullTime?: { home?: number | null; away?: number | null } };
}

export async function syncMatches(): Promise<{ upserted: number }> {
  const data = await call<{ matches: ApiMatch[] }>(`/teams/${TEAM_ID}/matches?limit=40`);
  let upserted = 0;

  for (const match of data.matches ?? []) {
    const isHome = match.homeTeam?.id === TEAM_ID;
    const opponent = (isHome ? match.awayTeam?.name : match.homeTeam?.name) ?? "A definir";
    const full = match.score?.fullTime;
    const finished = match.status === "FINISHED";

    await Match.updateOne(
      { externalId: String(match.id) },
      {
        $set: {
          opponent,
          date: new Date(match.utcDate),
          competition: match.competition?.name ?? "Brasileirão",
          venue: isHome ? "home" : "away",
          scoreFor: finished ? ((isHome ? full?.home : full?.away) ?? null) : null,
          scoreAgainst: finished ? ((isHome ? full?.away : full?.home) ?? null) : null,
        },
        // `ticketUrl` fica de fora do $set: é preenchido no admin e não pode ser sobrescrito.
        $setOnInsert: { externalId: String(match.id) },
      },
      { upsert: true },
    );
    upserted += 1;
  }

  return { upserted };
}

interface ApiStanding {
  standings?: {
    type: string;
    table: {
      position: number;
      team: { id: number };
      playedGames: number;
      won: number;
      draw: number;
      lost: number;
      points: number;
    }[];
  }[];
}

export async function syncStandings(): Promise<boolean> {
  const data = await call<ApiStanding>(`/competitions/${COMPETITION}/standings`);
  const table = data.standings?.find((s) => s.type === "TOTAL")?.table ?? [];
  const row = table.find((entry) => entry.team.id === TEAM_ID);
  if (!row) return false;

  await ClubStat.updateOne(
    { key: "current" },
    {
      $set: {
        position: row.position,
        points: row.points,
        played: row.playedGames,
        wins: row.won,
        draws: row.draw,
        losses: row.lost,
      },
    },
    { upsert: true },
  );
  return true;
}

/* ------------------------------------------------------------------ *
 * Provedor sem token: TheSportsDB.
 *
 * A chave pública de teste ("3") devolve só **um** jogo por chamada — dá para
 * manter o último resultado e o próximo jogo em dia, mas não os cinco de cada
 * lado. Serve como preenchimento automático mínimo; a lista completa vem do
 * football-data (com token) ou do cadastro manual no admin.
 * ------------------------------------------------------------------ */

const SPORTSDB_KEY = process.env.THESPORTSDB_KEY ?? "3";
const SPORTSDB_TEAM = process.env.THESPORTSDB_TEAM_ID ?? "134282"; // Vasco da Gama

interface SportsDbEvent {
  idEvent: string;
  dateEvent: string;
  strTime?: string | null;
  strHomeTeam: string;
  strAwayTeam: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strLeague?: string;
}

async function sportsDb(endpoint: string): Promise<SportsDbEvent[]> {
  const response = await fetch(
    `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}/${endpoint}?id=${SPORTSDB_TEAM}`,
    { signal: AbortSignal.timeout(TIMEOUT_MS) },
  );
  if (!response.ok) throw new Error(`TheSportsDB respondeu HTTP ${response.status}`);
  const data = (await response.json()) as { results?: SportsDbEvent[]; events?: SportsDbEvent[] };
  return data.results ?? data.events ?? [];
}

const isVasco = (name: string) => /vasco/i.test(name);

export async function syncMatchesFree(): Promise<{ upserted: number }> {
  const events = [...(await sportsDb("eventslast.php")), ...(await sportsDb("eventsnext.php"))];
  let upserted = 0;

  for (const event of events) {
    const home = isVasco(event.strHomeTeam);
    const opponent = home ? event.strAwayTeam : event.strHomeTeam;
    const scoreHome = event.intHomeScore == null ? null : Number(event.intHomeScore);
    const scoreAway = event.intAwayScore == null ? null : Number(event.intAwayScore);

    await Match.updateOne(
      { externalId: `sportsdb:${event.idEvent}` },
      {
        $set: {
          opponent,
          date: new Date(`${event.dateEvent}T${event.strTime || "21:30:00"}Z`),
          competition: event.strLeague ?? "Brasileirão",
          venue: home ? "home" : "away",
          scoreFor: home ? scoreHome : scoreAway,
          scoreAgainst: home ? scoreAway : scoreHome,
        },
        $setOnInsert: { externalId: `sportsdb:${event.idEvent}` },
      },
      { upsert: true },
    );
    upserted += 1;
  }

  return { upserted };
}

/**
 * Transfermarkt é a fonte padrão dos jogos: traz a temporada inteira sem token.
 * Com `FOOTBALL_DATA_TOKEN` configurado, a classificação também é atualizada.
 */
export async function syncAll() {
  const { upserted } = await syncTransfermarkt();

  let standings = false;
  if (env.footballDataToken) {
    try {
      standings = await syncStandings();
    } catch (error) {
      console.error("[jogos] classificação falhou:", error instanceof Error ? error.message : error);
    }
  }

  return { upserted, standings, provider: "transfermarkt" as const, partial: false };
}
