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

/** Palavrões e xingamentos em pt-BR, já na forma normalizada (sem acento). */
const PROFANITY = [
  "arrombado",
  "babaca",
  "bosta",
  "buceta",
  "cacete",
  "caralho",
  "corno",
  "cuzao",
  "desgracado",
  "escroto",
  "fdp",
  "filho da puta",
  "foda",
  "fodase",
  "foder",
  "merda",
  "otario",
  "pau no cu",
  "piranha",
  "porra",
  "puta",
  "putaria",
  "puto",
  "retardado",
  "safado",
  "vagabundo",
  "vadia",
  "viado",
  "xoxota",
];

/**
 * Política brasileira. A lista é deliberadamente feita de **entidades e termos
 * inequívocos**: partidos, instituições e pautas.
 *
 * Ficaram de fora "direita", "esquerda", "presidente", "eleição" e afins —
 * num portal de futebol elas aparecem o tempo todo em contexto legítimo
 * ("lateral-direita", "pé esquerdo", "presidente do clube", "eleição no Vasco").
 * Bloquear essas palavras causaria mais falso positivo do que proteção.
 */
const POLITICS = [
  "bolsonaro",
  "bolsonarista",
  "lula",
  "lulista",
  "petista",
  "partido dos trabalhadores",
  "psdb",
  "psol",
  "mdb",
  "partido liberal",
  "planalto",
  "congresso nacional",
  "camara dos deputados",
  "senado federal",
  "deputado federal",
  "senador",
  "ministro do stf",
  "supremo tribunal federal",
  "stf",
  "tse",
  "impeachment",
  "urna eletronica",
  "voto impresso",
  "comunista",
  "comunismo",
  "fascista",
  "fascismo",
  "ditadura militar",
  "golpe militar",
  "esquerdista",
  "direitista",
  "eleicoes presidenciais",
  "candidato a presidente",
];

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
  "!": "i",
};

/** Minúsculas, sem acento, sem leet e sem repetição de letra ("caraaalho" → "caralho"). */
export function normalizeForModeration(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[0135734@$!]/g, (char) => LEET[char] ?? char)
    .replace(/(.)\1{2,}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mesma string sem nada que não seja letra — pega "c.a.r.a.l.h.o" e "p o r r a". */
const squash = (input: string) => input.replace(/[^a-z]/g, "");

function findTerm(text: string, terms: string[]): string | undefined {
  const squashed = squash(text);

  for (const term of terms) {
    // Termo com espaço: só faz sentido buscar na forma com espaços.
    if (term.includes(" ")) {
      if (text.includes(term)) return term;
      continue;
    }
    // Palavra inteira, para "puto" não casar dentro de "computo".
    if (new RegExp(`(^|[^a-z])${term}([^a-z]|$)`).test(text)) return term;
    // Evasão por pontuação/espaço entre as letras.
    if (term.length >= 5 && squashed.includes(term)) return term;
  }
  return undefined;
}

const MESSAGES: Record<ModerationCategory, string> = {
  profanity: "Seu comentário tem palavras de baixo calão. Reescreva sem xingamento.",
  politics:
    "Aqui a gente fala de Vasco. Comentários sobre política brasileira não são publicados.",
};

/** Verdicto de moderação para um comentário. */
export function moderateComment(text: string): ModerationVerdict {
  const normalized = normalizeForModeration(text);

  const profanity = findTerm(normalized, PROFANITY);
  if (profanity) {
    return { allowed: false, category: "profanity", term: profanity, message: MESSAGES.profanity };
  }

  const politics = findTerm(normalized, POLITICS);
  if (politics) {
    return { allowed: false, category: "politics", term: politics, message: MESSAGES.politics };
  }

  return { allowed: true };
}

export const MODERATION_TERM_COUNT = {
  profanity: PROFANITY.length,
  politics: POLITICS.length,
};
