import { useMemo, useState } from "react";
import {
  useFetcher,
  useLoaderData,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { formatDateTime } from "@ntv/shared";
import { Header, type SessionUser } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { useSite } from "~/lib/site";
import { pageMeta } from "~/lib/seo";
import { gql } from "~/lib/graphql.server";
import { MARKET_QUERY } from "~/lib/queries";

interface Rumour {
  id: string;
  question: string;
  goodPercent?: number | null;
  totalVotes: number;
  myVote?: string | null;
  fee?: string | null;
  probability?: number | null;
  rumouredAt?: string | null;
  player: { name: string; position: string; club: string; photo?: string | null };
}

interface Signing {
  id: string;
  playerName: string;
  position?: string | null;
  club?: string | null;
  fee?: string | null;
  photo?: string | null;
}

interface Data {
  polls: Rumour[];
  signings: Signing[];
  settings: { matches: { lastSyncAt?: string | null } };
  me: SessionUser | null;
}

type SortKey = "fonte" | "aprovacao" | "votos" | "valor";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "fonte", label: "Ordem do mercado" },
  { key: "aprovacao", label: "Mais aprovados" },
  { key: "votos", label: "Mais votados" },
  { key: "valor", label: "Maior valor" },
];


export const meta: MetaFunction = ({ matches }) =>
  pageMeta({
    matches: matches as never,
    path: "/mercado",
    title: "Mercado da Bola",
    description:
      "Todas as especulações de contratação do Vasco na janela atual. Vote se aprova ou reprova cada nome.",
    keywords: [
      "mercado da bola",
      "negociações vasco",
      "novidades vasco",
      "nome dos jogadores do vasco",
      "Vasco da Gama",
      "bap",
      "leila pereira",
      "futebol",
    ],
  });

export async function loader({ request }: LoaderFunctionArgs) {
  return gql<Data>(MARKET_QUERY, { request });
}

/** "€ 8.00 mi" → 8_000_000, para poder ordenar por valor. */
function feeToNumber(fee?: string | null): number {
  if (!fee) return 0;
  const value = Number(/([\d.,]+)/.exec(fee)?.[1]?.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(value)) return 0;
  if (/mi/i.test(fee)) return value * 1_000_000;
  if (/mil/i.test(fee)) return value * 1_000;
  return value;
}

function RumourCard({ rumour }: { rumour: Rumour }) {
  const fetcher = useFetcher<{ id?: string; myVote?: string; goodPercent?: number; error?: string }>();
  const fresh = fetcher.data?.id === rumour.id ? fetcher.data : null;

  const voted = rumour.myVote ?? fresh?.myVote ?? null;
  const percent = fresh?.goodPercent ?? rumour.goodPercent ?? 0;
  const votes = voted && !rumour.myVote ? rumour.totalVotes + 1 : rumour.totalVotes;

  return (
    <article className="rumour">
      <div className="rumour__head">
        {rumour.player.photo ? (
          <img className="rumour__photo" src={rumour.player.photo} alt="" loading="lazy" />
        ) : (
          <span className="rumour__photo rumour__photo--empty" aria-hidden />
        )}
        <div style={{ minWidth: 0 }}>
          <h2 className="rumour__name">{rumour.player.name}</h2>
          <p className="ntv-meta">
            {[rumour.player.position, rumour.player.club].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        {rumour.probability != null ? (
          <span className="rumour__odds" title="Probabilidade estimada pela fonte">
            {rumour.probability}%
          </span>
        ) : null}
      </div>

      {rumour.fee ? <p className="rumour__fee">Valor especulado: {rumour.fee}</p> : null}

      <div className="bar">
        <div className="bar__fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="rumour__legend">
        <span>
          <strong>{percent}%</strong> aprova
        </span>
        <span>
          {votes} {votes === 1 ? "voto" : "votos"}
        </span>
      </div>

      {voted ? (
        <p className="rumour__voted">
          Você {voted === "good" ? "aprovou" : "reprovou"} esta contratação.
        </p>
      ) : (
        <fetcher.Form method="post" action="/api/votar" className="rumour__actions">
          <input type="hidden" name="pollId" value={rumour.id} />
          <button className="ntv-btn" name="choice" value="good">
            Aprovo
          </button>
          <button className="ntv-btn ntv-btn--outline" name="choice" value="bad">
            Reprovo
          </button>
        </fetcher.Form>
      )}

      {fetcher.data?.error ? <p className="alert">{fetcher.data.error}</p> : null}
    </article>
  );
}

export default function MercadoRoute() {
  const { polls, signings, settings, me } = useLoaderData<typeof loader>();
  const site = useSite();
  const [sort, setSort] = useState<SortKey>("fonte");

  const ordered = useMemo(() => {
    const list = [...polls];
    if (sort === "aprovacao") {
      // Sem voto, a % é 0 e não diz nada — quem já tem voto vem primeiro.
      list.sort((a, b) => {
        if (!a.totalVotes && !b.totalVotes) return 0;
        if (!a.totalVotes) return 1;
        if (!b.totalVotes) return -1;
        return (b.goodPercent ?? 0) - (a.goodPercent ?? 0);
      });
    }
    if (sort === "votos") list.sort((a, b) => b.totalVotes - a.totalVotes);
    if (sort === "valor") list.sort((a, b) => feeToNumber(b.fee) - feeToNumber(a.fee));
    return list;
  }, [polls, sort]);

  const totalVotes = polls.reduce((sum, poll) => sum + poll.totalVotes, 0);
  const voted = polls.filter((poll) => poll.myVote).length;

  return (
    <div className="shell">
      <Header user={me} />
      <main className="main">
        <div className="wrap">
          <div className="section__head">
            <span className="section__rule" />
            <h1 className="section__title">Mercado da Bola</h1>
            <span className="section__more">{polls.length} especulações</span>
          </div>

          <p className="listpage__subtitle">
            Todos os nomes especulados no Vasco na janela atual. Vote se aprova ou reprova
            cada contratação — o resultado é o que a torcida acha, não a probabilidade do
            negócio sair.
          </p>

          <section className="market__stats">
            <div>
              <strong>{polls.length}</strong>
              <span>nomes na janela</span>
            </div>
            <div>
              <strong>{totalVotes.toLocaleString("pt-BR")}</strong>
              <span>votos da torcida</span>
            </div>
            <div>
              <strong>{signings.length}</strong>
              <span>já confirmados</span>
            </div>
            <div>
              <strong>
                {voted}/{polls.length}
              </strong>
              <span>você já votou</span>
            </div>
          </section>

          <div className="market__toolbar">
            <label className="ntv-meta" htmlFor="ordenar">
              Ordenar por
            </label>
            <select
              id="ordenar"
              className="ntv-select"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              {SORTS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {ordered.length ? (
            <div className="market__grid">
              {ordered.map((rumour) => (
                <RumourCard key={rumour.id} rumour={rumour} />
              ))}
            </div>
          ) : (
            <p className="ntv-meta listpage__empty">
              Nenhuma especulação na janela atual. O admin atualiza em Jogos → Sincronizar.
            </p>
          )}

          {signings.length ? (
            <section className="section" style={{ marginTop: 48 }}>
              <div className="section__head">
                <span className="section__rule" />
                <h2 className="section__title">Já confirmados na temporada</h2>
              </div>
              <div className="market__signings">
                {signings.map((signing) => (
                  <div key={signing.id} className="signing">
                    {signing.photo ? (
                      <img className="signing__photo" src={signing.photo} alt="" loading="lazy" />
                    ) : (
                      <span className="signing__photo signing__photo--empty" aria-hidden />
                    )}
                    <span style={{ minWidth: 0 }}>
                      <strong className="signing__name">{signing.playerName}</strong>
                      <span className="ntv-meta">
                        {[signing.position, signing.club].filter(Boolean).join(" · ") || "Reforço"}
                      </span>
                    </span>
                    {signing.fee ? <span className="signing__fee">{signing.fee}</span> : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <p className="ntv-meta table__source">
            {settings.matches?.lastSyncAt
              ? `Atualizado em ${formatDateTime(settings.matches.lastSyncAt)} · `
              : ""}
            especulações e transferências do Transfermarkt
          </p>
        </div>
      </main>
      <Footer siteName={site.siteName} social={site.social} ads={site.footerAds} />
    </div>
  );
}
