import { useEffect, useRef, useState } from "react";
import { Form, NavLink, Link, useLocation } from "react-router";
import { useSite, publicAsset } from "~/lib/site";

export interface SessionUser {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  /** Quando presente, o item vira link externo (aba nova). */
  external?: "youtube";
}

const NAV: NavItem[] = [
  { to: "/", label: "Início", end: true },
  { to: "/ntv-exclusivo", label: "NTV Exclusivo" },
  { to: "/noticias", label: "Notícias" },
  { to: "#youtube", label: "Vídeos", external: "youtube" },
  { to: "/tabela", label: "Tabela" },
  { to: "/loja", label: "Loja NTV" },
];

const YOUTUBE_FALLBACK = "https://www.youtube.com/@natorcidavascaino";

export function Avatar({
  name,
  url,
  size = 30,
}: {
  name: string;
  url?: string | null;
  size?: number;
}) {
  // Foto enviada rodando local grava URL de localhost; cai na inicial em vez de
  // mostrar imagem quebrada para todo mundo.
  const src = publicAsset(url);

  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {src ? <img src={src} alt={`Foto de ${name}`} /> : name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Header({ user }: { user?: SessionUser | null }) {
  const site = useSite();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);

  const youtubeUrl = site.social.find((s) => s.network === "youtube")?.url ?? YOUTUBE_FALLBACK;

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

  // Trocar de página fecha a busca aberta no mobile.
  useEffect(() => setSearchOpen(false), [location.pathname]);

  const renderNav = (className: string) =>
    NAV.map((item) =>
      item.external ? (
        <a
          key={item.label}
          className={className}
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {item.label}
        </a>
      ) : (
        <NavLink key={item.label} to={item.to} end={item.end} className={className}>
          {item.label}
        </NavLink>
      ),
    );

  return (
    <header className="header">
      <div className="wrap">
        <div className="header__bar">
          <Link to="/" className="header__logo" aria-label={`${site.siteName} — início`}>
            <img src="/assets/logo.svg" alt={site.siteName} />
          </Link>

          <nav className="header__nav">{renderNav("header__link")}</nav>

          <div className="header__actions">
            <Form method="get" action="/busca" role="search" className="header__searchform">
              <input
                ref={searchInput}
                className="header__search"
                type="search"
                name="q"
                placeholder="Buscar no NTV News"
                aria-label="Buscar notícias"
              />
            </Form>

            <button
              type="button"
              className="header__icon header__icon--search"
              aria-label="Buscar"
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((open) => !open)}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
            </button>

            {user ? (
              <>
                <Link to="/perfil" className="header__user" aria-label={`Perfil de ${user.name}`}>
                  <Avatar name={user.name} url={user.avatarUrl} />
                </Link>
                <Form method="post" action="/sair">
                  <button className="ntv-btn header__cta header__cta--ghost">Logout</button>
                </Form>
              </>
            ) : (
              <Link to="/entrar" className="ntv-btn header__cta">
                Login
              </Link>
            )}
          </div>
        </div>

        {searchOpen ? (
          <Form method="get" action="/busca" role="search" className="header__searchdrawer">
            <input
              className="ntv-input"
              type="search"
              name="q"
              placeholder="Buscar notícias, jogadores, competições…"
              aria-label="Buscar notícias"
              autoFocus
            />
            <button className="ntv-btn">Buscar</button>
          </Form>
        ) : null}

        <nav className="mobilenav" aria-label="Seções">
          {renderNav("mobilenav__link")}
        </nav>
      </div>
    </header>
  );
}

export function Ticker({ headline }: { headline?: string | null }) {
  if (!headline) return null;
  return (
    <div className="ticker">
      <div className="wrap">
        <div className="ticker__inner">
          <span className="ticker__flag">Agora</span>
          <span className="ticker__text">{headline}</span>
        </div>
      </div>
    </div>
  );
}
