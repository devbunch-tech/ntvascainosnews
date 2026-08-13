import type { AuthUser } from "./auth.js";

export interface GraphQLContext {
  user: AuthUser | null;
  /** IP/UA cru, usado só para deduplicar eventos de visita. */
  fingerprint: string;
  /**
   * Identidade do visitante sem login, para a enquete aceitar voto anônimo.
   * Vem do header `x-voter-id` (cookie do portal); sem ele, usa IP + UA.
   */
  voterId: string;
}

/** Resolver de `id` para documentos vindos de `.lean()` (que expõem `_id`). */
export const idField = (doc: { _id?: unknown; id?: unknown }) => String(doc.id ?? doc._id);
