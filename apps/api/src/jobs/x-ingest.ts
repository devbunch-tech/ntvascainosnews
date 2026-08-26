import { buildPostSeo, slugify } from "@ntv/shared";
import { Post } from "../models/Post.js";
import { XSource } from "../models/XSource.js";

/**
 * Ingestão de posts do X (Twitter) — mesmo modelo do RSS (jobs/ingest.ts),
 * mas sem API oficial de leitura gratuita.
 *
 * Usa o endpoint não-documentado de sindicação de timeline que o próprio
 * widget de embed do X consome (`syndication.twitter.com/srv/timeline-profile`).
 * A chave para ele responder é mandar `referer: https://platform.twitter.com/`
 * — sem isso o X devolve 429 ou corpo vazio. Isso não é uma API com contrato:
 * o X pode mudar o HTML, o campo `__NEXT_DATA__` ou passar a bloquear de vez,
 * a qualquer momento e sem aviso. `lastError` no admin é o sinal de que isso
 * aconteceu — quando parar de importar, é provavelmente aqui.
 */

const FETCH_TIMEOUT_MS = 15000;
const TWEET_URL = (handle: string, id: string) => `https://twitter.com/${handle}/status/${id}`;

interface RawTweet {
  id_str: string;
  full_text?: string;
  text?: string;
  created_at: string;
  user?: { screen_name?: string };
  retweeted_status?: unknown;
  entities?: {
    media?: { media_url_https?: string; type?: string }[];
    urls?: { url?: string; expanded_url?: string }[];
  };
}

/** Busca a timeline pública de um handle. Lança se o X mudou o formato. */
async function fetchTimeline(handle: string): Promise<RawTweet[]> {
  const url = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(handle)}?showReplies=false`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      // O X só serve este endpoint pra quem manda este referer — é o que o
      // widget de embed manda ao carregar. Sem ele: 429 ou corpo vazio.
      referer: "https://platform.twitter.com/",
      accept: "text/html",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const html = await response.text();
  const match = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!match) throw new Error("__NEXT_DATA__ não encontrado — o X mudou o layout da timeline.");

  let data: any;
  try {
    data = JSON.parse(match[1]);
  } catch {
    throw new Error("__NEXT_DATA__ não é JSON válido.");
  }

  const entries = data?.props?.pageProps?.timeline?.entries;
  if (!Array.isArray(entries)) throw new Error("Timeline sem `entries` — o X mudou a estrutura.");

  return entries
    .filter((entry: any) => entry?.type === "tweet")
    .map((entry: any) => entry.content?.tweet)
    .filter(Boolean);
}

/** O X sempre acrescenta um t.co no fim do texto de quem tem foto/vídeo. */
function stripTrailingMediaLink(text: string, entities?: RawTweet["entities"]): string {
  const mediaUrls = (entities?.media ?? []).map((m: any) => m.url).filter(Boolean);
  let out = text;
  for (const short of mediaUrls) out = out.replace(new RegExp(`\\s*${short}\\s*$`), "");
  return out.trim();
}

function excerptOf(text: string, max = 110): string {
  const plain = text.replace(/\s+/g, " ").trim();
  return plain.length > max ? `${plain.slice(0, max)}…` : plain;
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function uniqueSlug(base: string) {
  let candidate = slugify(base) || `x-${Date.now()}`;
  let n = 2;
  while (await Post.exists({ slug: candidate })) candidate = `${slugify(base)}-${n++}`;
  return candidate;
}

/** Ingere um perfil. Posts entram publicados com crédito, como no RSS. */
export async function ingestXSource(sourceId: string): Promise<number> {
  const source = await XSource.findById(sourceId);
  if (!source || !source.enabled) return 0;

  let imported = 0;

  try {
    const tweets = await fetchTimeline(source.handle);

    for (const tweet of tweets) {
      // Defesa: só o que é do próprio perfil (não retweet, não citação de outro autor).
      if (tweet.retweeted_status) continue;
      if (tweet.user?.screen_name?.toLowerCase() !== source.handle.toLowerCase()) continue;

      const tweetUrl = TWEET_URL(source.handle, tweet.id_str);
      if (await Post.exists({ externalId: tweetUrl })) continue;

      const rawText = tweet.full_text ?? tweet.text ?? "";
      const text = stripTrailingMediaLink(rawText, tweet.entities);
      if (!text) continue;

      const publishedAt = new Date(tweet.created_at);
      const dateLabel = publishedAt.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      const title = `${source.name}: "${excerptOf(text, 90)}"`;
      const body = `<p>${escapeHtml(source.name)} publicou no X:</p>
<blockquote class="twitter-tweet"><p lang="pt" dir="ltr">${escapeHtml(text)}</p>&mdash; ${escapeHtml(source.name)} (@${source.handle}) <a href="${tweetUrl}">${escapeHtml(dateLabel)}</a></blockquote>`;

      const coverImage = tweet.entities?.media?.[0]?.media_url_https ?? null;

      const seo = buildPostSeo({
        title,
        excerpt: text,
        body,
        category: source.category,
      });

      await Post.create({
        title,
        seo: { description: seo.description, keywords: seo.keywords, auto: true, noindex: false },
        geo: seo.geo,
        slug: await uniqueSlug(title),
        body,
        excerpt: excerptOf(text, 220),
        coverImage,
        coverCredit: coverImage ? `Foto: ${source.name} (X)` : null,
        category: source.category,
        source: { type: "x", name: source.name, url: tweetUrl },
        externalId: tweetUrl,
        status: source.autoPublish ? "published" : "draft",
        publishedAt,
      });
      imported += 1;
    }
    source.lastError = null;
  } catch (error) {
    source.lastError = error instanceof Error ? error.message : String(error);
    console.error(`[x] falha em @${source.handle}:`, source.lastError);
  }

  source.lastFetchAt = new Date();
  source.importedCount = (source.importedCount ?? 0) + imported;
  await source.save();
  return imported;
}

export async function ingestAllX(): Promise<{ imported: number; sources: number }> {
  const sources = await XSource.find({ enabled: true }).select("_id").lean();
  let imported = 0;
  for (const s of sources) imported += await ingestXSource(String(s._id));
  return { imported, sources: sources.length };
}
