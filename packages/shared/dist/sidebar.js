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
export const SIDEBAR_WIDGETS = [
    { key: "clubStats", label: "Estatísticas do clube" },
    { key: "lastMatches", label: "Últimos 5 jogos" },
    { key: "nextMatches", label: "Próximos 5 jogos" },
    { key: "market", label: "Mercado da Bola" },
    { key: "signings", label: "Últimas contratações" },
    { key: "youtube", label: "No YouTube" },
    { key: "ads", label: "Publicidade" },
    { key: "shop", label: "Loja NTV" },
];
const KNOWN = new Set(SIDEBAR_WIDGETS.map((w) => w.key));
const labelOf = (key) => SIDEBAR_WIDGETS.find((w) => w.key === key)?.label ?? key;
/** Quantas campanhas a sidebar exibe quando não há configuração. */
export const DEFAULT_AD_LIMIT = 2;
/** Teto de sanidade: sidebar não é rede de display. */
export const MAX_AD_LIMIT = 10;
/**
 * Combina o que está salvo com o catálogo do código.
 *
 * As duas metades importam. Descartar chave desconhecida evita que um widget
 * removido do código volte como item fantasma no admin. Acrescentar ao fim a
 * chave conhecida que não está salva é o que faz um widget novo aparecer
 * sozinho — sem isso, toda peça nova nasceria invisível para quem já tinha
 * configuração gravada, e o bug seria silencioso.
 */
export function resolveSidebarWidgets(stored) {
    const out = [];
    const seen = new Set();
    for (const item of stored ?? []) {
        const key = item?.key;
        if (!key || !KNOWN.has(key) || seen.has(key))
            continue;
        seen.add(key);
        out.push({ key, label: labelOf(key), visible: item.visible !== false });
    }
    for (const widget of SIDEBAR_WIDGETS) {
        if (seen.has(widget.key))
            continue;
        out.push({ key: widget.key, label: widget.label, visible: true });
    }
    return out;
}
/** Mantém o limite de campanhas dentro do intervalo aceito. */
export function resolveAdLimit(value) {
    if (typeof value !== "number" || !Number.isFinite(value))
        return DEFAULT_AD_LIMIT;
    return Math.min(MAX_AD_LIMIT, Math.max(0, Math.trunc(value)));
}
