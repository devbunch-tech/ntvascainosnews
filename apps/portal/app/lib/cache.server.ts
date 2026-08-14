/** Cache de página na borda do Oxygen.
 *
 *  O problema que isto resolve: sem `Cache-Control` o Oxygen marca a resposta
 *  como `oxygen-full-page-cache: uncacheable` e toda visita refaz o SSR inteiro
 *  — ida à API, consultas ao banco, render. Num portal de notícias a mesma home
 *  é servida milhares de vezes por minuto sem mudar nada.
 *
 *  Por que só para quem não tem cookie: as páginas trazem dados de quem está
 *  logado (`me`, `myVote`, comentário próprio). Cachear isso publicamente
 *  entregaria a sessão de uma pessoa para outra. Então a regra é simples —
 *  requisição sem nenhum cookie é anônima e pode ser compartilhada; qualquer
 *  cookie presente (`ntv_session` do login ou `ntv_voter` de quem já votou)
 *  força render fresco e privado.
 *
 *  O `Vary: Cookie` é o que torna isso seguro no CDN: ele entra na chave do
 *  cache, então uma resposta anônima nunca é entregue a quem manda cookie.
 *
 *  `stale-while-revalidate` deixa a borda servir a versão levemente antiga
 *  enquanto busca a nova em segundo plano — ninguém espera pela revalidação.
 */

export interface CacheWindow {
  /** Segundos que o CDN pode servir a resposta como fresca. */
  sMaxAge: number;
  /** Segundos extras servindo a versão antiga enquanto revalida. */
  staleWhileRevalidate: number;
}

/** Notícia entra o tempo todo; alguns segundos já cortam quase todo o trabalho. */
export const CACHE_HOME: CacheWindow = { sMaxAge: 60, staleWhileRevalidate: 300 };

/** Matéria publicada muda pouco depois de no ar. */
export const CACHE_ARTICLE: CacheWindow = { sMaxAge: 300, staleWhileRevalidate: 3600 };

/** Listagens e páginas de dados esportivos. */
export const CACHE_LIST: CacheWindow = { sMaxAge: 120, staleWhileRevalidate: 600 };

export function pageCacheHeaders(request: Request, window: CacheWindow): HeadersInit {
  const hasCookie = Boolean(request.headers.get("Cookie"));

  if (hasCookie) {
    // Visitante identificado: a resposta é dele e não pode ser compartilhada.
    return {
      "Cache-Control": "private, no-store",
      "Oxygen-Cache-Control": "private, no-store",
      Vary: "Cookie",
    };
  }

  return {
    // Para browser e proxies comuns.
    "Cache-Control": `public, max-age=0, s-maxage=${window.sMaxAge}, stale-while-revalidate=${window.staleWhileRevalidate}`,
    // O que realmente liga o full-page cache do Oxygen: ele lê este header
    // próprio, não o Cache-Control padrão, e exige um `max-age` explícito.
    "Oxygen-Cache-Control": `public, max-age=${window.sMaxAge}, stale-while-revalidate=${window.staleWhileRevalidate}`,
    Vary: "Cookie",
  };
}
