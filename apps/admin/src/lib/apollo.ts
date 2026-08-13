import { ApolloClient, HttpLink, InMemoryCache, from } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";

export const GRAPHQL_URL =
  import.meta.env.VITE_GRAPHQL_URL ?? "http://localhost:4010/graphql";
export const API_URL = GRAPHQL_URL.replace(/\/graphql\/?$/, "");

const TOKEN_KEY = "ntv_admin_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const authLink = setContext((_, { headers }) => {
  const token = tokenStore.get();
  return { headers: { ...headers, ...(token ? { authorization: `Bearer ${token}` } : {}) } };
});

const errorLink = onError(({ graphQLErrors }) => {
  // Token expirado ou revogado: derruba a sessão e volta ao login.
  if (graphQLErrors?.some((e) => e.extensions?.code === "UNAUTHENTICATED")) {
    tokenStore.clear();
    if (!location.pathname.startsWith("/login")) location.assign("/login");
  }
});

export const client = new ApolloClient({
  link: from([errorLink, authLink, new HttpLink({ uri: GRAPHQL_URL })]),
  cache: new InMemoryCache(),
  defaultOptions: { watchQuery: { fetchPolicy: "cache-and-network" } },
});

/** Upload direto para o endpoint REST da API (multipart). */
export async function uploadFile(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(`${API_URL}/upload`, { method: "POST", body });
  const payload = (await response.json()) as { url?: string; error?: string };
  if (!response.ok || !payload.url) throw new Error(payload.error ?? "Falha no upload.");
  return payload.url;
}
