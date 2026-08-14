/**
 * Geração automática de SEO por post: descrição, palavras-chave e geo.
 *
 * Roda na API (na gravação e na ingestão de RSS) e no admin (para o editor ver
 * o que será publicado). Tudo é **sugestão**: se a redação preencher o campo à
 * mão, o valor manual manda.
 */
import { slugify } from "./format.js";
/** Limite prático da meta description antes do Google cortar. */
const DESCRIPTION_MAX = 158;
const KEYWORDS_MAX = 12;
/** Palavras que não descrevem o assunto. */
const STOPWORDS = new Set([
    "a", "ao", "aos", "as", "à", "às", "com", "como", "da", "das", "de", "do",
    "dos", "e", "em", "entre", "essa", "esse", "esta", "este", "foi", "já", "mais",
    "mas", "na", "nas", "no", "nos", "não", "num", "numa", "o", "os", "ou", "para",
    "pela", "pelas", "pelo", "pelos", "por", "que", "se", "sem", "ser", "seu",
    "seus", "sua", "suas", "só", "também", "tem", "ter", "um", "uma", "vai", "vão",
    "ver", "vez", "é", "após", "sobre", "contra", "the", "of", "and",
]);
/** Termos que sempre entram: é o que o portal quer ranquear. */
const BRAND_KEYWORDS = ["Vasco da Gama", "Vasco", "NTV News", "notícias do Vasco"];
/**
 * Geolocalização padrão: São Januário, no Rio.
 *
 * As meta tags `geo.*`/ICBM ajudam buscadores e agregadores a entender que o
 * conteúdo é local — relevante para um portal de clube, cujo público é
 * majoritariamente da cidade.
 */
export const DEFAULT_GEO = {
    placename: "Rio de Janeiro, RJ",
    region: "BR-RJ",
    /** Estádio de São Januário. */
    position: "-22.890556;-43.227778",
    icbm: "-22.890556, -43.227778",
};
/** Tira tags, entidades e espaços repetidos. */
export function toPlainText(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/\s+/g, " ")
        .trim();
}
/**
 * Descrição a partir do que existir: subtítulo, resumo ou o começo do corpo.
 * Corta na fronteira de frase quando dá, para não terminar no meio da palavra.
 */
export function buildDescription(input) {
    const source = [input.subtitle, input.excerpt].map((v) => v?.trim()).find((v) => v && v.length > 40) ??
        toPlainText(input.body ?? "") ??
        input.title;
    const text = toPlainText(source || input.title);
    if (text.length <= DESCRIPTION_MAX)
        return text;
    const cut = text.slice(0, DESCRIPTION_MAX);
    const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    if (lastStop > DESCRIPTION_MAX * 0.6)
        return cut.slice(0, lastStop + 1).trim();
    const lastSpace = cut.lastIndexOf(" ");
    return `${cut.slice(0, lastSpace > 0 ? lastSpace : DESCRIPTION_MAX).trim()}…`;
}
/** Nomes próprios do título (duas palavras capitalizadas seguidas contam como um). */
function properNouns(title) {
    const found = [];
    const pattern = /\b([A-ZÁ-Ú][\wÀ-ÿ]{2,})(?:\s+(?:de|da|do|dos|das)?\s*([A-ZÁ-Ú][\wÀ-ÿ]{2,}))?/g;
    for (const match of title.matchAll(pattern)) {
        const value = match[0].trim();
        // Primeira palavra da frase costuma ser capitalizada sem ser nome próprio.
        if (match.index === 0 && !match[2])
            continue;
        found.push(value);
    }
    return found;
}
/** Palavras-chave: tags e categoria mandam, depois nomes próprios e termos do título. */
export function buildKeywords(input) {
    const out = [];
    const push = (value) => {
        const clean = value.trim();
        const exists = out.some((item) => item.toLowerCase() === clean.toLowerCase());
        if (clean.length > 2 && !exists)
            out.push(clean);
    };
    for (const tag of input.tags ?? [])
        push(tag);
    if (input.category)
        push(input.category);
    for (const noun of properNouns(input.title))
        push(noun);
    const words = toPlainText(input.title)
        .toLowerCase()
        .replace(/[^\wà-ÿ\s-]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 3 && !STOPWORDS.has(word));
    for (const word of words)
        push(word);
    for (const brand of BRAND_KEYWORDS)
        push(brand);
    return out.slice(0, KEYWORDS_MAX);
}
/* ------------------------------------------------------------------ *
 * Arquivos de categoria e tag
 * ------------------------------------------------------------------ */
/**
 * O banco guarda o rótulo de exibição ("Mercado da Bola"), não um slug — não há
 * coleção de taxonomia. A URL do arquivo é derivada do rótulo, e a resolução na
 * rota é feita ao contrário: comparando o slug da URL com o slug de cada valor
 * publicado. Definido aqui para que portal, sitemap e testes usem a mesma
 * regra; duas implementações divergentes gerariam link interno quebrado.
 */
export const categoryPath = (name) => `/categoria/${slugify(name)}`;
export const tagPath = (name) => `/tag/${slugify(name)}`;
/** SEO completo de um post, respeitando o que já foi preenchido à mão. */
export function buildPostSeo(input, manual) {
    return {
        description: manual?.description?.trim() || buildDescription(input),
        keywords: manual?.keywords?.length ? manual.keywords : buildKeywords(input),
        geo: { ...DEFAULT_GEO, ...(manual?.geo ?? {}) },
    };
}
