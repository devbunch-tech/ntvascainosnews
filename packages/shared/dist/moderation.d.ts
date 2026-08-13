/**
 * Moderação de comentários: palavrão e política brasileira.
 *
 * Vive no pacote compartilhado para a API validar (autoridade) e o portal
 * avisar o usuário antes de enviar (conveniência).
 */
export type ModerationCategory = "profanity" | "politics";
export interface ModerationVerdict {
    allowed: boolean;
    category?: ModerationCategory;
    /** Termo que disparou o bloqueio — usado só em log/admin, nunca ecoado ao usuário. */
    term?: string;
    /** Mensagem pronta para exibir no formulário. */
    message?: string;
}
/** Minúsculas, sem acento, sem leet e sem repetição de letra ("caraaalho" → "caralho"). */
export declare function normalizeForModeration(input: string): string;
/** Verdicto de moderação para um comentário. */
export declare function moderateComment(text: string): ModerationVerdict;
export declare const MODERATION_TERM_COUNT: {
    profanity: number;
    politics: number;
};
