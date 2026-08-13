import { useLoaderData, type LoaderFunctionArgs, type MetaFunction } from "react-router";
import { Header, type SessionUser } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { useSite } from "~/lib/site";
import { pageMeta } from "~/lib/seo";
import { gql } from "~/lib/graphql.server";

const ADVERTISE_QUERY = /* GraphQL */ `
  query Advertise {
    settings {
      siteName
      url
    }
    home(latestLimit: 1) {
      latest {
        total
      }
    }
    me {
      id
      name
      avatarUrl
    }
  }
`;

interface AdvertiseData {
  settings: { siteName: string; url: string };
  home: { latest: { total: number } };
  me: SessionUser | null;
}

/** Formatos oferecidos — os mesmos `placement` aceitos pelo model `Ad`. */
const FORMATS = [
  {
    name: "Barra lateral",
    spec: "300×250 ou 300×600 px",
    where: "Home e páginas de notícia, ao lado do conteúdo",
    placement: "sidebar",
  },
  {
    name: "Dentro da matéria",
    spec: "728×90 px (desktop) · 320×100 px (mobile)",
    where: "Entre os parágrafos, no meio da leitura",
    placement: "in_article",
  },
  {
    name: "Rodapé",
    spec: "970×250 px",
    where: "Fim de todas as páginas",
    placement: "footer",
  },
  {
    name: "Loja NTV",
    spec: "300×250 px",
    where: "Grade de produtos da Loja",
    placement: "shop",
  },
];


export const meta: MetaFunction = ({ matches }) =>
  pageMeta({
    matches: matches as never,
    path: "/anuncie",
    title: "Anuncie no NTV News",
    description:
      "Formatos, especificações e contato comercial para anunciar no maior portal do torcedor vascaíno.",
  });

export async function loader({ request }: LoaderFunctionArgs) {
  return gql<AdvertiseData>(ADVERTISE_QUERY, { request });
}

export default function AnuncieRoute() {
  const { settings, home, me } = useLoaderData<typeof loader>();
  const site = useSite();

  return (
    <div className="shell">
      <Header user={me} />
      <main className="main">
        <div className="wrap" style={{ maxWidth: 860 }}>
          <div className="section__head">
            <span className="section__rule" />
            <h1 className="section__title">Anuncie no {settings.siteName}</h1>
          </div>

          <p className="post__subtitle">
            O portal do torcedor vascaíno. Sua marca ao lado da cobertura diária do clube —
            notícias, mercado da bola, tabela e a Loja NTV.
          </p>

          <section className="advertise__numbers">
            <div>
              <strong>{home.latest.total.toLocaleString("pt-BR")}</strong>
              <span>notícias publicadas</span>
            </div>
            <div>
              <strong>Diário</strong>
              <span>cobertura da equipe + agregação</span>
            </div>
            <div>
              <strong>Mobile-first</strong>
              <span>a maior parte do público vem do celular</span>
            </div>
          </section>

          <h2 className="section__title" style={{ margin: "32px 0 14px" }}>
            Formatos disponíveis
          </h2>

          <div className="advertise__grid">
            {FORMATS.map((format) => (
              <article key={format.placement} className="widget">
                <h3 className="widget__title">{format.name}</h3>
                <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700 }}>{format.spec}</p>
                <p className="ntv-meta">{format.where}</p>
              </article>
            ))}
          </div>

          <section className="widget" style={{ marginTop: 24 }}>
            <h2 className="widget__title">Como funciona</h2>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14.5, lineHeight: 1.7 }}>
              <li>Você envia a peça no formato acima e o link de destino.</li>
              <li>A equipe cadastra a campanha com data de início e fim.</li>
              <li>Você recebe o relatório de impressões e cliques do período.</li>
            </ol>
            <p className="ntv-meta" style={{ marginTop: 12 }}>
              As peças são hospedadas pelo próprio portal — sem rede de terceiros, sem script
              externo e sem rastreador de outra empresa nas páginas.
            </p>
          </section>

          <section className="advertise__cta">
            <div>
              <strong>Quer anunciar?</strong>
              <p className="ntv-meta" style={{ margin: "4px 0 0" }}>
                Fale com a equipe comercial e receba a tabela de preços.
              </p>
            </div>
            <a className="ntv-btn" href={`mailto:comercial@${hostOf(settings.url)}`}>
              Falar com o comercial
            </a>
          </section>
        </div>
      </main>
      <Footer siteName={site.siteName} social={site.social} ads={site.footerAds} />
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "ntvascainosnews.com.br";
  }
}
