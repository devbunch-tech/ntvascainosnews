import { useEffect } from "react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router";
import { useQuery } from "@apollo/client";
import { can, type Role } from "@ntv/shared";
import { ME, SITE_ICON } from "./lib/queries";
import { tokenStore } from "./lib/apollo";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { PostsList } from "./pages/PostsList";
import { PostEditor } from "./pages/PostEditor";
import { Products } from "./pages/Products";
import { Users } from "./pages/Users";
import { Settings } from "./pages/Settings";
import { Matches } from "./pages/Matches";
import { Ads } from "./pages/Ads";
import { Account } from "./pages/Account";

interface Me {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string | null;
}

const NAV = [
  { to: "/", label: "Dashboard", short: "Início", end: true },
  { to: "/noticias", label: "Notícias", short: "Notícias" },
  { to: "/noticias/nova", label: "Nova notícia", short: "+" },
  { to: "/produtos", label: "Produtos", short: "Produtos" },
  { to: "/jogos", label: "Jogos", short: "Jogos", permission: "settings:manage" },
  { to: "/anunciantes", label: "Anunciantes", short: "Anúncios", permission: "settings:manage" },
  { to: "/usuarios", label: "Usuários", short: "Usuários", permission: "users:manage" },
  { to: "/configuracoes", label: "Configurações", short: "Config", permission: "settings:manage" },
];

function Shell({ me, children }: { me: Me; children: React.ReactNode }) {
  const visible = NAV.filter((item) => !item.permission || can(me.role, item.permission));

  return (
    <div className="admin">
      <aside className="side">
        <div className="side__logo">
          <img src="/assets/logo.svg" alt="NTV News" />
        </div>
        <nav className="side__nav">
          {visible.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `side__link ${isActive ? "is-active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="side__foot">
          {/* O nome é a porta da conta: é onde se procura trocar a própria senha,
              e Configurações não serve porque exige settings:manage. */}
          <NavLink to="/minha-conta" className="side__me" title="Minha conta">
            {me.name}
            <small>{me.role}</small>
          </NavLink>
          <button
            className="linkbtn"
            style={{ marginLeft: "auto", color: "var(--ntv-dark-text-dim)" }}
            onClick={() => {
              tokenStore.clear();
              window.location.assign("/login");
            }}
          >
            Sair
          </button>
        </div>
      </aside>

      <main className="content">{children}</main>

      <nav className="tabbar">
        {visible.slice(0, 2).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? "is-active" : "")}
          >
            {item.short}
          </NavLink>
        ))}
        <NavLink to="/noticias/nova" className="fab" aria-label="Nova notícia">
          +
        </NavLink>
        <NavLink to="/produtos" className={({ isActive }) => (isActive ? "is-active" : "")}>
          Produtos
        </NavLink>
        <NavLink
          to={can(me.role, "settings:manage") ? "/configuracoes" : "/noticias"}
          className={({ isActive }) => (isActive ? "is-active" : "")}
        >
          {can(me.role, "settings:manage") ? "Config" : "Notícias"}
        </NavLink>
      </nav>
    </div>
  );
}

/**
 * Aplica no admin o favicon enviado em Configurações → Geral.
 *
 * O `index.html` do admin é estático, então o ícone tem que ser trocado em
 * runtime — senão o painel fica com o logotipo padrão mesmo depois do upload.
 */
function useSiteIcon() {
  const { data } = useQuery(SITE_ICON, { errorPolicy: "ignore" });
  const favicon = data?.settings?.faviconUrl;
  const siteName = data?.settings?.siteName;

  useEffect(() => {
    if (favicon) {
      const link =
        document.querySelector<HTMLLinkElement>('link[rel="icon"]') ??
        document.head.appendChild(Object.assign(document.createElement("link"), { rel: "icon" }));
      link.href = favicon;
      link.type = favicon.endsWith(".svg") ? "image/svg+xml" : "";
    }
    if (siteName) document.title = `${siteName} — Admin`;
  }, [favicon, siteName]);
}

export function App() {
  useSiteIcon();
  const location = useLocation();
  const hasToken = Boolean(tokenStore.get());
  const { data, loading } = useQuery<{ me: Me | null }>(ME, { skip: !hasToken });

  if (location.pathname === "/login") return <Login />;
  if (!hasToken) return <Navigate to="/login" replace />;
  if (loading && !data) {
    return (
      <div className="loginpage">
        <p className="ntv-meta">Carregando…</p>
      </div>
    );
  }
  if (!data?.me) return <Navigate to="/login" replace />;

  const me = data.me;
  if (me.role === "reader") {
    return (
      <div className="loginpage">
        <div className="loginbox">
          <p className="alert">Esta conta não tem acesso ao painel.</p>
          <button
            className="ntv-btn"
            style={{ width: "100%" }}
            onClick={() => {
              tokenStore.clear();
              window.location.assign("/login");
            }}
          >
            Trocar de conta
          </button>
        </div>
      </div>
    );
  }

  return (
    <Shell me={me}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/noticias" element={<PostsList me={me} />} />
        <Route path="/noticias/nova" element={<PostEditor me={me} />} />
        <Route path="/noticias/:slug" element={<PostEditor me={me} />} />
        <Route path="/produtos" element={<Products />} />
        {/* Sem checagem de papel: é a própria conta de quem está logado. */}
        <Route path="/minha-conta" element={<Account me={me} />} />
        <Route
          path="/jogos"
          element={can(me.role, "settings:manage") ? <Matches /> : <Navigate to="/" replace />}
        />
        <Route
          path="/anunciantes"
          element={can(me.role, "settings:manage") ? <Ads /> : <Navigate to="/" replace />}
        />
        <Route
          path="/usuarios"
          element={can(me.role, "users:manage") ? <Users me={me} /> : <Navigate to="/" replace />}
        />
        <Route
          path="/configuracoes"
          element={can(me.role, "settings:manage") ? <Settings /> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
