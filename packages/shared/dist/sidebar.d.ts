/**
 * Catálogo dos widgets da sidebar.
 *
 * A ordem e a visibilidade passaram a ser configuráveis no admin, mas as peças
 * continuam vivendo no código do portal. Este arquivo é a ponte: define quais
 * chaves existem e como se chamam, para que API, admin e portal não mantenham
 * três listas que saem de sincronia.
 *
 * A configuração salva é uma lista ordenada — a posição no array **é** a ordem.
 * Não há campo `order` de propósito: dois registros com o mesmo número forçam
 * um critério de desempate que ninguém consegue prever olhando a tela.
 */
/** A ordem aqui é a que vale enquanto ninguém configurar nada. */
export declare const SIDEBAR_WIDGETS: readonly [{
    readonly key: "clubStats";
    readonly label: "Estatísticas do clube";
}, {
    readonly key: "lastMatches";
    readonly label: "Últimos 5 jogos";
}, {
    readonly key: "nextMatches";
    readonly label: "Próximos 5 jogos";
}, {
    readonly key: "market";
    readonly label: "Mercado da Bola";
}, {
    readonly key: "signings";
    readonly label: "Últimas contratações";
}, {
    readonly key: "youtube";
    readonly label: "No YouTube";
}, {
    readonly key: "ads";
    readonly label: "Publicidade";
}, {
    readonly key: "shop";
    readonly label: "Loja NTV";
}];
export type SidebarWidgetKey = (typeof SIDEBAR_WIDGETS)[number]["key"];
/** Quantas campanhas a sidebar exibe quando não há configuração. */
export declare const DEFAULT_AD_LIMIT = 2;
/** Teto de sanidade: sidebar não é rede de display. */
export declare const MAX_AD_LIMIT = 10;
export interface SidebarWidget {
    key: string;
    label: string;
    visible: boolean;
}
/**
 * Combina o que está salvo com o catálogo do código.
 *
 * As duas metades importam. Descartar chave desconhecida evita que um widget
 * removido do código volte como item fantasma no admin. Acrescentar ao fim a
 * chave conhecida que não está salva é o que faz um widget novo aparecer
 * sozinho — sem isso, toda peça nova nasceria invisível para quem já tinha
 * configuração gravada, e o bug seria silencioso.
 */
export declare function resolveSidebarWidgets(stored?: {
    key?: string | null;
    visible?: boolean | null;
}[] | null): SidebarWidget[];
/** Mantém o limite de campanhas dentro do intervalo aceito. */
export declare function resolveAdLimit(value?: number | null): number;
