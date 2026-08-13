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
/** Palavras que não distinguem uma notícia de outra. */
const STOPWORDS = new Set([
    "a", "ao", "aos", "as", "à", "às", "com", "como", "da", "das", "de", "do", "dos",
    "e", "em", "entre", "essa", "esse", "esta", "este", "eu", "foi", "for", "há",
    "isso", "já", "la", "lo", "mais", "mas", "me", "mesmo", "meu", "muito", "na",
    "nas", "no", "nos", "não", "num", "numa", "o", "os", "ou", "para", "pela",
    "pelas", "pelo", "pelos", "per", "por", "que", "se", "sem", "ser", "seu",
    "seus", "só", "sua", "suas", "também", "te", "tem", "ter", "teu", "um", "uma",
    "vai", "vão", "ver", "vez", "é", "após", "sobre", "contra", "the", "of",
]);
/** Mínimo de palavras próprias para a digital ser confiável. */
const MIN_TOKENS = 4;
export function normalizeTitle(title) {
    return title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
/**
 * Digital do título. Títulos curtos demais usam a forma normalizada inteira —
 * com poucas palavras, o conjunto ordenado agruparia notícias diferentes.
 */
export function titleFingerprint(title) {
    const normalized = normalizeTitle(title);
    if (!normalized)
        return "";
    const tokens = normalized
        .split(" ")
        // Números ficam mesmo com 1 dígito: placar e ano distinguem a notícia
        // ("vence por 3 a 1" × "vence por 2 a 0").
        .filter((word) => (word.length > 2 || /^\d+$/.test(word)) && !STOPWORDS.has(word));
    // Título curto mantém a ordem: com 2 ou 3 palavras, o conjunto ordenado
    // agruparia notícias distintas. As palavras de ligação já saíram fora.
    if (tokens.length < MIN_TOKENS)
        return tokens.join(" ");
    return [...new Set(tokens)].sort().join(" ");
}
/** Quanto dois títulos se sobrepõem, de 0 a 1 (índice de Jaccard). */
export function titleSimilarity(a, b) {
    const setA = new Set(titleFingerprint(a).split(" ").filter(Boolean));
    const setB = new Set(titleFingerprint(b).split(" ").filter(Boolean));
    if (!setA.size || !setB.size)
        return 0;
    let shared = 0;
    for (const token of setA)
        if (setB.has(token))
            shared += 1;
    return shared / (setA.size + setB.size - shared);
}
