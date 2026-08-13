
import { Link, useLoaderData, useSearchParams, type LoaderFunctionArgs, type MetaFunction } from "react-router";
import { formatDateTime } from "@ntv/shared";
import { Header, type SessionUser } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { useSite } from "~/lib/site";
import { pageMeta } from "~/lib/seo";
import { gql } from "~/lib/graphql.server";
import { STANDINGS_QUERY } from "~/lib/queries";

interface StandingRow {
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
}

interface Standing {
  key: string;
  competition: string;
  season?: string | null;
  sourceUrl?: string | null;
  lastSyncAt?: string | null;
  rows: StandingRow[];
}

interface BracketTie {
  home: string;
  away: string;
  score?: string | null;
  date?: string | null;
  highlight: boolean;
}

interface Bracket {
  key: string;
  competition: string;
  sourceUrl?: string | null;
  lastSyncAt?: string | null;
  rounds: { name: string; order: number; ties: BracketTie[] }[];
}

interface Data {
  standings: Standing[];
  brackets: Bracket[];
  me: SessionUser | null;
}

/** Aba: liga vira tabela de classificação, copa vira chaveamento. */
type Tab =
  | { kind: "standing"; key: string; label: string; standing: Standing }
  | { kind: "bracket"; key: string; label: string; bracket: Bracket };


export const meta: MetaFunction = ({ matches }) =>
  pageMeta({
    matches: matches as never,
    path: "/tabela",
    title: "Tabela e chaveamento",
    description:
      "Classificação do Vasco no Brasileirão e o chaveamento completo da Copa do Brasil e da Sul-Americana.",
  });

export async function loader({ request }: LoaderFunctionArgs) {
  return gql<Data>(STANDINGS_QUERY, { request });
}

/** Faixas de classificação do Brasileirão — só aplicadas em tabela de 20 times. */
function zoneOf(position: number, size: number): string {
  if (size < 20) return "";
  if (position <= 4) return "zone--libertadores";
  if (position <= 6) return "zone--pre";
  if (position <= 12) return "zone--sula";
  if (position > size - 4) return "zone--rebaixamento";
  return "";
}

/** Data curta do confronto: "13/08". */
const tieDate = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(iso)) : null;

/**
 * Chaveamento de copa: uma seção por fase, com os confrontos em duas colunas.
 * As fases vêm da fonte já na ordem certa; a mais recente primeiro é mais útil
 * para quem abre a página, então invertemos.
 */
function BracketView({ bracket, standalone }: { bracket: Bracket; standalone: boolean }) {
  const rounds = [...bracket.rounds].reverse();

  return (
    <section className={standalone ? "" : "section"} style={standalone ? undefined : { marginTop: 48 }}>
      {!standalone ? (
        <div className="section__head">
          <span className="section__rule" />
          <h2 className="section__title">Chaveamento</h2>
        </div>
      ) : (
        <h2 className="table__title">{bracket.competition}</h2>
      )}

      {rounds.map((round) => (
        <div key={round.name} className="bracket__round">
          <h3 className="bracket__phase">{round.name}</h3>
          <div className="bracket__ties">
            {round.ties.map((tie, index) => (
              <div
                key={`${round.name}-${index}`}
                className={`tie ${tie.highlight ? "tie--highlight" : ""}`}
              >
                <span className="tie__team tie__team--home">{tie.home}</span>
                <span className="tie__score">{tie.score ?? tieDate(tie.date) ?? "×"}</span>
                <span className="tie__team">{tie.away}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <p className="ntv-meta table__source">
        {bracket.lastSyncAt ? `Atualizado em ${formatDateTime(bracket.lastSyncAt)} · ` : ""}
        dados do Transfermarkt
      </p>
    </section>
  );
}

export default function TabelaRoute() {
  const { standings, brackets, me } = useLoaderData<typeof loader>();
  const site = useSite();

  // Copa que também tem tabela (fase de grupos) aparece uma vez só: a
  // classificação manda, e o chaveamento entra logo abaixo dela.
  const tabs: Tab[] = [
    ...standings.map((standing) => ({
      kind: "standing" as const,
      key: standing.key,
      label: standing.competition,
      standing,
    })),
    ...brackets
      .filter((bracket) => !standings.some((standing) => standing.key === bracket.key))
      .map((bracket) => ({
        kind: "bracket" as const,
        key: bracket.key,
        label: bracket.competition,
        bracket,
      })),
  ];

  // A aba vive na URL: o SSR já entrega a competição certa e o link é
  // compartilhável (/tabela?competicao=copa-do-brasil).
  const [params] = useSearchParams();
  const active = params.get("competicao") ?? tabs[0]?.key ?? "";
  const tab = tabs.find((item) => item.key === active) ?? tabs[0];
  const current = tab?.kind === "standing" ? tab.standing : null;
  const bracket =
    tab?.kind === "bracket"
      ? tab.bracket
      : brackets.find((item) => item.key === tab?.key) ?? null;

  return (
    <div className="shell">
      <Header user={me} />
      <main className="main">
        <div className="wrap">
          <div className="section__head">
            <span className="section__rule" />
            <h1 className="section__title">Tabela</h1>
          </div>

          {tabs.length > 1 ? (
            <div className="chips" role="tablist" aria-label="Competições">
              {tabs.map((item) => (
                <Link
                  key={item.key}
                  to={`?competicao=${item.key}`}
                  role="tab"
                  className="chip"
                  aria-selected={item.key === tab?.key}
                  aria-pressed={item.key === tab?.key}
                  preventScrollReset
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ) : null}

          {current ? (
            <>
              <h2 className="table__title">{current.competition}</h2>

              <div className="tablewrap">
                <table className="standings">
                  <thead>
                    <tr>
                      <th className="standings__pos">#</th>
                      <th className="standings__team">Time</th>
                      <th>P</th>
                      <th>J</th>
                      <th className="standings__wide">V</th>
                      <th className="standings__wide">E</th>
                      <th className="standings__wide">D</th>
                      <th className="standings__wide">GP</th>
                      <th className="standings__wide">GC</th>
                      <th>SG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.rows.map((row) => (
                      <tr
                        key={`${row.position}-${row.team}`}
                        className={`${row.highlight ? "is-highlight" : ""} ${zoneOf(row.position, current.rows.length)}`}
                      >
                        <td className="standings__pos">{row.position}</td>
                        <td className="standings__team">{row.team}</td>
                        <td>
                          <strong>{row.points}</strong>
                        </td>
                        <td>{row.played}</td>
                        <td className="standings__wide">{row.wins}</td>
                        <td className="standings__wide">{row.draws}</td>
                        <td className="standings__wide">{row.losses}</td>
                        <td className="standings__wide">{row.goalsFor}</td>
                        <td className="standings__wide">{row.goalsAgainst}</td>
                        <td>{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {current.rows.length >= 20 ? (
                <ul className="table__legend">
                  <li>
                    <span className="dot zone--libertadores" /> Libertadores
                  </li>
                  <li>
                    <span className="dot zone--pre" /> Pré-Libertadores
                  </li>
                  <li>
                    <span className="dot zone--sula" /> Sul-Americana
                  </li>
                  <li>
                    <span className="dot zone--rebaixamento" /> Rebaixamento
                  </li>
                </ul>
              ) : null}

              <p className="ntv-meta table__source">
                {current.lastSyncAt ? `Atualizado em ${formatDateTime(current.lastSyncAt)}` : ""}
                {current.sourceUrl ? " · dados do Transfermarkt" : ""}
              </p>
            </>
          ) : null}

          {bracket ? <BracketView bracket={bracket} standalone={!current} /> : null}

          {!current && !bracket ? (
            <p className="ntv-meta listpage__empty">
              Nenhuma competição sincronizada ainda. O admin atualiza em Jogos → Sincronizar.
            </p>
          ) : null}
        </div>
      </main>
      <Footer siteName={site.siteName} social={site.social} ads={site.footerAds} />
    </div>
  );
}
