/**
 * Impressão digital de título, para detectar a mesma notícia vinda de fontes
 * diferentes.
 *
 * O dedupe por `guid` só pega o mesmo item do mesmo feed. Quando ge.globo e
 * Lance! publicam a mesma matéria, os guids diferem e o título varia um pouco
 * ("Vasco vence o Fluminense" × "Vasco vence Fluminense fora de casa").
 *
 * A digital é o **conjunto** de palavras significativas, ordenado: sobrevive a
 * mudança de ordem, pontuação, acento e às palavras de ligação.
 */
export declare function normalizeTitle(title: string): string;
/**
 * Digital do título. Títulos curtos demais usam a forma normalizada inteira —
 * com poucas palavras, o conjunto ordenado agruparia notícias diferentes.
 */
export declare function titleFingerprint(title: string): string;
/** Quanto dois títulos se sobrepõem, de 0 a 1 (índice de Jaccard). */
export declare function titleSimilarity(a: string, b: string): number;
