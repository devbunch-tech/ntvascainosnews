/** Cliente GraphQL baseado em `fetch` — sem dependência de Node, roda no Oxygen.
 *  Um Apollo Client completo não é necessário no servidor: os loaders do
 *  React Router já fazem o papel de cache/estado. */
import { getEnv } from "./env.server";
import { getToken } from "./session.server";
import { readVoterId } from "./voter.server";

export class GraphQLRequestError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = "GraphQLRequestError";
  }
}

interface QueryOptions {
  variables?: Record<string, unknown>;
  /** Request da rota: usada para propagar o token de sessão do leitor. */
  request?: Request;
  token?: string | null;
  /** Identidade anônima da enquete. A action de voto passa a sua explicitamente. */
  voterId?: string | null;
  /** Cache-Control para o Oxygen CDN cachear a resposta SSR. */
  signal?: AbortSignal;
}

export async function gql<T = unknown>(query: string, options: QueryOptions = {}): Promise<T> {
  const { PUBLIC_GRAPHQL_URL } = getEnv();
  const token = options.token ?? (options.request ? await getToken(options.request) : null);
  // Vai em toda chamada: é como a API sabe o que este visitante já votou,
  // mesmo sem login. Sem cookie ainda, não manda nada — a API cai no IP+UA.
  const voter =
    options.voterId ?? (options.request ? await readVoterId(options.request) : null);

  const response = await fetch(PUBLIC_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(voter ? { "x-voter-id": voter } : {}),
    },
    body: JSON.stringify({ query, variables: options.variables ?? {} }),
    signal: options.signal,
  });

  if (!response.ok) {
    throw new GraphQLRequestError(`API respondeu ${response.status}`, "HTTP_ERROR");
  }

  const payload = (await response.json()) as {
    data?: T;
    errors?: { message: string; extensions?: { code?: string } }[];
  };

  if (payload.errors?.length) {
    const first = payload.errors[0];
    throw new GraphQLRequestError(first.message, first.extensions?.code);
  }
  if (!payload.data) throw new GraphQLRequestError("Resposta vazia da API");
  return payload.data;
}
