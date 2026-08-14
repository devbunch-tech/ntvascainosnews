import { Link } from "react-router";
import { SOCIAL_LABELS, SOCIAL_ORDER, SocialIcon, type SocialNetwork } from "./SocialIcons";
import { publicAsset } from "~/lib/site";

export interface FooterSocial {
  network: SocialNetwork;
  url: string;
}

/**
 * As URLs vêm de `settings.socialAccounts.*.url`, editáveis em
 * Admin → Configurações → Redes sociais. Rede sem URL não é exibida.
 */
export function Footer({
  siteName = "NTV News",
  social = [],
  ads = [],
}: {
  siteName?: string;
  social?: FooterSocial[];
  ads?: { id: string; title: string; imageUrl?: string | null; targetUrl: string }[];
}) {
  const links = SOCIAL_ORDER.map((network) => social.find((item) => item.network === network)).filter(
    (item): item is FooterSocial => Boolean(item?.url),
  );

  return (
    <footer className="footer">
      <div className="wrap">
        {ads.length ? (
          <div className="footer__ads">
            {ads.map((ad) => (
              <a
                key={ad.id}
                className="adslot adslot--footer"
                href={ad.targetUrl}
                target="_blank"
                rel="noopener sponsored"
              >
                {publicAsset(ad.imageUrl) ? (
                  <img src={publicAsset(ad.imageUrl)!} alt={ad.title} />
                ) : (
                  <span>{ad.title}</span>
                )}
              </a>
            ))}
          </div>
        ) : null}

        <div className="footer__top">
          <Link to="/" className="footer__logo">
            <img src="/assets/logo.svg" alt={siteName} />
          </Link>

          <div className="footer__social">
            {links.map((item) => (
              <a
                key={item.network}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={SOCIAL_LABELS[item.network]}
                title={SOCIAL_LABELS[item.network]}
              >
                <SocialIcon network={item.network} />
              </a>
            ))}
          </div>
        </div>

        <div className="footer__bottom">
          <span>
            © {new Date().getFullYear()} {siteName}. Todos os direitos reservados.
          </span>
          <Link to="/anuncie" className="footer__advertise">
            Anuncie aqui
          </Link>
          <span className="footer__by">
            Desenvolvido por
            <img src="/assets/bunch.png" alt="Bunch" />
          </span>
        </div>
      </div>
    </footer>
  );
}
