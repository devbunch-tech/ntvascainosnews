import { useState } from "react";
import { Link, useFetcher } from "react-router";
import { formatPrice, timeAgo } from "@ntv/shared";
import { NewsRow, type PostCardData } from "./PostCards";

export interface SidebarData {
  clubStats?: {
    position: number;
    points: number;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    efficiency: number;
  } | null;
  lastMatches: {
    id: string;
    opponent: string;
    result?: string | null;
    scoreFor?: number | null;
    scoreAgainst?: number | null;
    date: string;
  }[];
  nextMatches: {
    id: string;
    opponent: string;
    date: string;
    venue: string;
    competition: string;
    ticketUrl?: string | null;
  }[];
  activePolls: {
    id: string;
    question: string;
    goodPercent?: number | null;
    totalVotes: number;
    myVote?: string | null;
    fee?: string | null;
    probability?: number | null;
    player: { name: string; position: string; club: string; photo?: string | null };
  }[];
  signings?: {
    id: string;
    playerName: string;
    position?: string | null;
    club?: string | null;
    fee?: string | null;
    photo?: string | null;
    date?: string | null;
  }[];
  shopHighlights: {
    id: string;
    title: string;
    price: number;
    imageUrl?: string | null;
    externalUrl: string;
    marketplace: string;
  }[];
  latestVideos?: {
    id: string;
    videoId: string;
    title: string;
    thumbnail?: string | null;
    url: string;
    publishedAt: string;
  }[];
  ads?: { id: string; title: string; advertiser?: string | null; imageUrl?: string | null; targetUrl: string }[];
}

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(iso));

function ClubStatsWidget({ stats }: { stats: SidebarData["clubStats"] }) {
  if (!stats) return null;
  return (
    <section className="widget">
      <h2 className="widget__title">Estatísticas do clube</h2>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <strong style={{ fontSize: 30, fontWeight: 900, color: "var(--ntv-ink)" }}>
          {stats.position}º
        </strong>
        <span className="ntv-meta">no Brasileirão · {stats.points} pts</span>
      </div>
      <div className="statgrid">
        <div>
          <strong>{stats.played}</strong>
          <span>J</span>
        </div>
        <div>
          <strong>{stats.wins}</strong>
          <span>V</span>
        </div>
        <div>
          <strong>{stats.draws}</strong>
          <span>E</span>
        </div>
        <div>
          <strong>{stats.losses}</strong>
          <span>D</span>
        </div>
      </div>
      <div className="bar">
        <div className="bar__fill" style={{ width: `${stats.efficiency}%` }} />
      </div>
      <p className="ntv-meta" style={{ marginTop: 6 }}>
        {stats.efficiency}% de aproveitamento
      </p>
    </section>
  );
}

function LastMatchesWidget({ matches }: { matches: SidebarData["lastMatches"] }) {
  if (!matches.length) return null;
  return (
    <section className="widget">
      <h2 className="widget__title">Últimos 5 jogos</h2>
      <div className="formline">
        {matches.map((m) => (
          <span key={m.id} className={`formdot formdot--${m.result ?? "D"}`} title={m.opponent}>
            {m.result === "W" ? "V" : m.result === "D" ? "E" : "D"}
          </span>
        ))}
      </div>
      {matches.map((m) => (
        <div key={m.id} className="matchrow">
          <span className="matchrow__date">{shortDate(m.date)}</span>
          <span>{m.opponent}</span>
          <strong style={{ marginLeft: "auto" }}>
            {m.scoreFor}–{m.scoreAgainst}
          </strong>
        </div>
      ))}
    </section>
  );
}

function NextMatchesWidget({ matches }: { matches: SidebarData["nextMatches"] }) {
  if (!matches.length) return null;
  return (
    <section className="widget">
      <h2 className="widget__title">Próximos 5 jogos</h2>
      {matches.map((m) => (
        <div key={m.id} className="matchrow matchrow--next">
          <span className="matchrow__date">{shortDate(m.date)}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            {m.opponent}
            <br />
            <span className="ntv-meta">{m.competition}</span>
            {m.ticketUrl ? (
              <>
                <br />
                <a
                  className="matchrow__ticket"
                  href={m.ticketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Comprar ingresso ↗
                </a>
              </>
            ) : null}
          </span>
          <span className="matchrow__venue">{m.venue === "home" ? "Casa" : "Fora"}</span>
        </div>
      ))}
    </section>
  );
}

export function PollModal({
  poll,
  onClose,
}: {
  poll: SidebarData["activePolls"][number];
  onClose: () => void;
}) {
  const fetcher = useFetcher<{ myVote?: string; goodPercent?: number; error?: string }>();
  const voted = poll.myVote ?? fetcher.data?.myVote;
  const percent = fetcher.data?.goodPercent ?? poll.goodPercent ?? 0;

  return (
    <div className="backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          Mercado da Bola · Enquete
          <button className="modal__close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="modal__body">
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span className="avatar" style={{ width: 48, height: 48, fontSize: 18 }}>
              {poll.player.photo ? (
                <img src={poll.player.photo} alt={poll.player.name} />
              ) : (
                poll.player.name.slice(0, 1)
              )}
            </span>
            <div>
              <strong style={{ display: "block", color: "var(--ntv-ink)" }}>
                {poll.player.name}
              </strong>
              <span className="ntv-meta">
                {poll.player.position}
                {poll.player.club ? ` · ${poll.player.club}` : ""}
              </span>
            </div>
          </div>

          <p className="modal__question">{poll.question}</p>

          {voted ? (
            <>
              <div className="bar">
                <div className="bar__fill" style={{ width: `${percent}%` }} />
              </div>
              <div
                className="ntv-meta"
                style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}
              >
                <span>{percent}% bom reforço</span>
                <span>{100 - percent}% péssimo negócio</span>
              </div>
              <p className="modal__note">Seu voto foi registrado. Obrigado!</p>
            </>
          ) : (
            <fetcher.Form method="post" action="/api/votar" className="modal__buttons">
              <input type="hidden" name="pollId" value={poll.id} />
              <button className="ntv-btn" name="choice" value="good" type="submit">
                Bom reforço
              </button>
              <button className="ntv-btn ntv-btn--outline" name="choice" value="bad" type="submit">
                Péssimo negócio
              </button>
              {fetcher.data?.error ? <p className="alert">{fetcher.data.error}</p> : null}
              <p className="modal__note">O resultado aparece após votar.</p>
            </fetcher.Form>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Últimas especulações de contratação, com votação "aprova / reprova" na
 * própria linha. O percentual agregado aparece sempre; o voto exige login e o
 * servidor recusa o segundo voto do mesmo usuário.
 */
function MarketWidget({ polls }: { polls: SidebarData["activePolls"] }) {
  const fetcher = useFetcher<{ id?: string; myVote?: string; goodPercent?: number; error?: string }>();
  if (!polls.length) return null;

  return (
    <section className="widget widget--dark">
      <h2 className="widget__title">Mercado da Bola · Especulações</h2>

      {polls.slice(0, 5).map((poll) => {
        const voted = poll.myVote ?? (fetcher.data?.id === poll.id ? fetcher.data.myVote : null);
        const percent =
          (fetcher.data?.id === poll.id ? fetcher.data.goodPercent : null) ?? poll.goodPercent ?? 0;

        return (
          <div key={poll.id} className="pollrow">
            <div className="pollrow__head">
              {poll.player.photo ? (
                <img className="pollrow__photo" src={poll.player.photo} alt="" loading="lazy" />
              ) : null}
              <div style={{ minWidth: 0 }}>
                <div className="pollrow__name">{poll.player.name}</div>
                <span className="ntv-meta">
                  {[poll.player.position, poll.player.club].filter(Boolean).join(" · ")}
                  {poll.probability ? ` · ${poll.probability}% provável` : ""}
                </span>
              </div>
            </div>

            <div className="bar">
              <div className="bar__fill" style={{ width: `${percent}%` }} />
            </div>
            <div className="pollrow__legend">
              <span>{percent}% aprova</span>
              <span>{poll.totalVotes} voto(s)</span>
            </div>

            {voted ? (
              <p className="pollrow__voted">
                Você {voted === "good" ? "aprovou" : "reprovou"} esta contratação.
              </p>
            ) : (
              <fetcher.Form method="post" action="/api/votar" className="pollrow__actions">
                <input type="hidden" name="pollId" value={poll.id} />
                <button className="votebtn votebtn--yes" name="choice" value="good">
                  Aprovo
                </button>
                <button className="votebtn votebtn--no" name="choice" value="bad">
                  Reprovo
                </button>
              </fetcher.Form>
            )}
          </div>
        );
      })}

      <Link className="ntv-btn widget__cta" to="/mercado">
        Ver todas as especulações
      </Link>
    </section>
  );
}

/** Contratações confirmadas na temporada, do mais recente para o mais antigo. */
function SigningsWidget({ signings }: { signings?: SidebarData["signings"] }) {
  if (!signings?.length) return null;

  return (
    <section className="widget">
      <h2 className="widget__title">Últimas contratações</h2>
      <ul className="signings">
        {signings.slice(0, 5).map((signing) => (
          <li key={signing.id} className="signing">
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
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Último vídeo do canal + os anteriores. Alimentado pelo feed público
 *  do YouTube (job `npm run sync`), sem API key. */
function YouTubeWidget({
  videos,
  channelUrl,
}: {
  videos?: SidebarData["latestVideos"];
  channelUrl?: string;
}) {
  const [latest, ...previous] = videos ?? [];

  return (
    <section className="widget">
      <h2 className="widget__title">No YouTube</h2>

      {latest ? (
        <>
          <a className="ytcard" href={latest.url} target="_blank" rel="noopener noreferrer">
            <span className="ytcard__thumb">
              {latest.thumbnail ? <img src={latest.thumbnail} alt="" loading="lazy" /> : null}
              <span className="ytcard__play" aria-hidden>
                ▶
              </span>
            </span>
            <span className="ytcard__title">{latest.title}</span>
            <span className="ntv-meta">{timeAgo(latest.publishedAt)}</span>
          </a>

          {previous.length ? (
            <ul className="ytlist">
              {previous.map((video) => (
                <li key={video.id}>
                  <a href={video.url} target="_blank" rel="noopener noreferrer">
                    {video.title}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className="ntv-meta" style={{ marginBottom: 12 }}>
          Nenhum vídeo sincronizado ainda.
        </p>
      )}

      <a
        className="ntv-btn ntv-btn--outline"
        style={{ marginTop: 12 }}
        href={channelUrl ?? "https://www.youtube.com/@natorcidavascaino"}
        target="_blank"
        rel="noopener noreferrer"
      >
        Ver o canal
      </a>
    </section>
  );
}

/** Espaço de anunciante. Clique é contabilizado antes de sair do portal. */
function AdWidget({ ads }: { ads?: SidebarData["ads"] }) {
  const fetcher = useFetcher();
  if (!ads?.length) return null;

  return (
    <>
      {ads.map((ad) => (
        <section key={ad.id} className="widget widget--ad">
          <span className="adslot__tag">Publicidade</span>
          <a
            className="adslot"
            href={ad.targetUrl}
            target="_blank"
            rel="noopener sponsored"
            onClick={() => fetcher.submit({ id: ad.id }, { method: "post", action: "/api/clique-anuncio" })}
          >
            {ad.imageUrl ? (
              <img src={ad.imageUrl} alt={ad.title} loading="lazy" />
            ) : (
              <span className="adslot__fallback">{ad.title}</span>
            )}
          </a>
          {ad.advertiser ? <span className="ntv-meta">{ad.advertiser}</span> : null}
        </section>
      ))}
    </>
  );
}

function ShopWidget({ products }: { products: SidebarData["shopHighlights"] }) {
  if (!products.length) return null;
  return (
    <section className="widget">
      <h2 className="widget__title">Loja NTV</h2>
      {products.map((p) => (
        <a
          key={p.id}
          className="shopmini"
          href={p.externalUrl}
          target="_blank"
          rel="noopener sponsored"
        >
          {p.imageUrl ? <img src={p.imageUrl} alt="" /> : <span className="ph" />}
          <span>
            <span className="shopmini__title">{p.title}</span>
            <br />
            <span className="shopmini__price">{formatPrice(p.price)}</span>
          </span>
        </a>
      ))}
      <Link
        className="ntv-btn ntv-btn--outline"
        style={{ marginTop: 12 }}
        to="/loja"
      >
        Ver a loja
      </Link>
    </section>
  );
}

/** Ordem dos widgets segue o README: na página do post, "Últimas postagens" vem primeiro. */
export function Sidebar({
  data,
  latestPosts,
  youtubeChannelUrl,
}: {
  data: SidebarData;
  latestPosts?: PostCardData[];
  youtubeChannelUrl?: string;
}) {
  return (
    <aside className="sidebar">
      {latestPosts?.length ? (
        <section className="widget">
          <h2 className="widget__title">Últimas postagens</h2>
          <div className="newslist" style={{ borderTop: 0 }}>
            {latestPosts.slice(0, 6).map((post) => (
              <NewsRow key={post.id} post={post} />
            ))}
          </div>
        </section>
      ) : null}
      <ClubStatsWidget stats={data.clubStats} />
      <LastMatchesWidget matches={data.lastMatches} />
      <NextMatchesWidget matches={data.nextMatches} />
      <MarketWidget polls={data.activePolls} />
      <SigningsWidget signings={data.signings} />
      <YouTubeWidget videos={data.latestVideos} channelUrl={youtubeChannelUrl} />
      <AdWidget ads={data.ads} />
      <ShopWidget products={data.shopHighlights} />
    </aside>
  );
}
