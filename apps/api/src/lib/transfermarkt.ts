/**
 * Cliente único para o Transfermarkt.
 *
 * Os três jobs (jogos, mercado, chaveamento) leem várias páginas na mesma
 * execução — página de calendário, tabela por competição, boatos, transferências
 * e o chaveamento de cada copa. Disparar tudo em sequência apertada faz o site
 * começar a estrangular a conexão e cair em timeout.
 *
 * Daqui saem três garantias: **espaçamento** entre requisições, **uma tentativa
 * extra** em falha de rede, e cabeçalhos consistentes.
 */

const TIMEOUT_MS = 30_000;
/** Intervalo mínimo entre duas requisições ao site. */
const MIN_GAP_MS = 1_200;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

let lastRequestAt = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function once(url: string): Promise<string> {
  const since = Date.now() - lastRequestAt;
  if (since < MIN_GAP_MS) await sleep(MIN_GAP_MS - since);
  lastRequestAt = Date.now();

  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "follow",
    headers: {
      "user-agent": USER_AGENT,
      "accept-language": "pt-BR,pt;q=0.9",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`Transfermarkt respondeu HTTP ${response.status}`);
  return response.text();
}

export async function fetchTransfermarkt(url: string): Promise<string> {
  try {
    return await once(url);
  } catch (error) {
    // Timeout e queda de conexão costumam passar na segunda tentativa.
    await sleep(2_500);
    try {
      return await once(url);
    } catch {
      throw error;
    }
  }
}

/* ---------------- utilidades de parsing compartilhadas ---------------- */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

export const cleanHtml = (html: string) =>
  decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

export const slugKey = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
