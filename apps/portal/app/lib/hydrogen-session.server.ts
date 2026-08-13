import { createCookieSessionStorage, type Session, type SessionStorage } from "react-router";
import type { HydrogenSession } from "@shopify/hydrogen";

/** Sessão exigida pelo Hydrogen (carrinho, Customer Account API, buyer context).
 *
 *  É um cookie separado do `ntv_session` de `session.server.ts`: aquele guarda o
 *  token do login do portal na nossa própria API, este guarda o estado da Shopify.
 *  Manter os dois apartados evita que um invalide o outro ao ser regravado. */
export class AppSession implements HydrogenSession {
  public isPending = false;

  #sessionStorage: SessionStorage;
  #session: Session;

  constructor(sessionStorage: SessionStorage, session: Session) {
    this.#sessionStorage = sessionStorage;
    this.#session = session;
  }

  static async init(request: Request, secrets: string[]) {
    const storage = createCookieSessionStorage({
      cookie: {
        name: "ntv_shopify_session",
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secrets,
        secure: import.meta.env.PROD,
      },
    });

    const session = await storage.getSession(request.headers.get("Cookie"));
    return new this(storage, session);
  }

  get = ((...args: Parameters<Session["get"]>) => this.#session.get(...args)) as Session["get"];

  set = ((...args: Parameters<Session["set"]>) => {
    this.isPending = true;
    return this.#session.set(...args);
  }) as Session["set"];

  unset = ((...args: Parameters<Session["unset"]>) => {
    this.isPending = true;
    return this.#session.unset(...args);
  }) as Session["unset"];

  destroy = () => this.#sessionStorage.destroySession(this.#session);

  commit = () => {
    this.isPending = false;
    return this.#sessionStorage.commitSession(this.#session);
  };
}
