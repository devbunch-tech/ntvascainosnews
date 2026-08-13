import { createCookieSessionStorage, redirect } from "react-router";
import { getEnv } from "./env.server";

/** Cookie de sessão — a API Web de cookies do React Router roda igual no Oxygen. */
interface SessionData {
  token: string;
}

let storage: ReturnType<typeof createCookieSessionStorage<SessionData>> | null = null;

function getStorage() {
  if (storage) return storage;
  storage = createCookieSessionStorage<SessionData>({
    cookie: {
      name: "ntv_session",
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secrets: [getEnv().SESSION_SECRET],
      secure: import.meta.env.PROD,
      maxAge: 60 * 60 * 24 * 30,
    },
  });
  return storage;
}

export function getSession(request: Request) {
  return getStorage().getSession(request.headers.get("Cookie"));
}

export async function getToken(request: Request): Promise<string | null> {
  const session = await getSession(request);
  return session.get("token") ?? null;
}

export async function commitWithToken(request: Request, token: string, to = "/") {
  const session = await getSession(request);
  session.set("token", token);
  return redirect(to, { headers: { "Set-Cookie": await getStorage().commitSession(session) } });
}

export async function logout(request: Request) {
  const session = await getSession(request);
  return redirect("/", {
    headers: { "Set-Cookie": await getStorage().destroySession(session) },
  });
}
