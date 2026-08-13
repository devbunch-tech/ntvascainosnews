/**
 * Geração automática de SEO por post: descrição, palavras-chave e geo.
 *
 * Roda na API (na gravação e na ingestão de RSS) e no admin (para o editor ver
 * o que será publicado). Tudo é **sugestão**: se a redação preencher o campo à
 * mão, o valor manual manda.
 */
/**
 * Geolocalização padrão: São Januário, no Rio.
 *
 * As meta tags `geo.*`/ICBM ajudam buscadores e agregadores a entender que o
 * conteúdo é local — relevante para um portal de clube, cujo público é
 * majoritariamente da cidade.
 */
export declare const DEFAULT_GEO: {
    readonly placename: "Rio de Janeiro, RJ";
    readonly region: "BR-RJ";
    /** Estádio de São Januário. */
    readonly position: "-22.890556;-43.227778";
    readonly icbm: "-22.890556, -43.227778";
};
export interface PostGeo {
    placename: string;
    region: string;
    position: string;
    icbm: string;
}
export interface PostSeo {
    description: string;
    keywords: string[];
    geo: PostGeo;
}
/** Tira tags, entidades e espaços repetidos. */
export declare function toPlainText(html: string): string;
/**
 * Descrição a partir do que existir: subtítulo, resumo ou o começo do corpo.
 * Corta na fronteira de frase quando dá, para não terminar no meio da palavra.
 */
export declare function buildDescription(input: {
    subtitle?: string | null;
    excerpt?: string | null;
    body?: string | null;
    title: string;
}): string;
/** Palavras-chave: tags e categoria mandam, depois nomes próprios e termos do título. */
export declare function buildKeywords(input: {
    title: string;
    tags?: string[] | null;
    category?: string | null;
}): string[];
/** SEO completo de um post, respeitando o que já foi preenchido à mão. */
export declare function buildPostSeo(input: {
    title: string;
    subtitle?: string | null;
    excerpt?: string | null;
    body?: string | null;
    tags?: string[] | null;
    category?: string | null;
}, manual?: {
    description?: string | null;
    keywords?: string[] | null;
    geo?: Partial<PostGeo> | null;
}): PostSeo;
