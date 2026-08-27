import Parser from "rss-parser";
import { buildPostSeo, slugify, titleFingerprint, toPlainText } from "@ntv/shared";
import { Post } from "../models/Post.js";
import { RssSource } from "../models/RssSource.js";

/** Campos de imagem que os feeds brasileiros usam — sem declará-los aqui,
 *  o rss-parser descarta os namespaces `media:` e `itunes:`. */
const parser = new Parser({
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
      ["media:group", "mediaGroup"],
      ["itunes:image", "itunesImage"],
      ["image", "imageTag"],
      ["content:encoded", "contentEncoded"],
      ["atom:subtitle", "atomSubtitle"],
    ],
  },
});

const FETCH_TIMEOUT_MS = 15000;
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|avif|gif)(\?|$)/i;

/** Busca o XML com timeout próprio: um feed que não fecha a conexão não pode
 *  travar o cron inteiro (o `timeout` do rss-parser não cobre todos os casos). */
async function fetchFeed(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      "user-agent": "NTVNewsBot/1.0 (+https://ntvnews.com.br)",
      accept: "application/rss+xml, application/xml, text/xml",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const type = response.headers.get("content-type") ?? "";
  const body = await response.text();
  if (type.includes("text/html") && !body.trimStart().startsWith("<?xml")) {
    throw new Error("A URL respondeu HTML, não um feed RSS.");
  }
  return body;
}

const asArray = <T>(value: T | T[] | undefined | null): T[] =>
  value == null ? [] : Array.isArray(value) ? value : [value];

/** Normaliza URL relativa e descarta pixel de tracking / data URI. */
function cleanUrl(raw: unknown, base?: string): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const value = raw.trim();
  if (value.startsWith("data:")) return null;
  try {
    const url = new URL(value, base);
    if (!/^https?:$/.test(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Entre vários `media:content`, fica com o de maior largura declarada. */
function widestMedia(entries: any[], base?: string): string | null {
  const candidates = entries
    .map((entry) => ({
      url: cleanUrl(entry?.$?.url ?? entry?.url, base),
      width: Number(entry?.$?.width ?? 0),
      type: String(entry?.$?.medium ?? entry?.$?.type ?? ""),
    }))
    .filter((c) => c.url && !c.type.startsWith("video"));

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.width - a.width);
  return candidates[0].url;
}

/** Imagem de destaque a partir do próprio item do feed. */
export function imageFromItem(item: Record<string, any>): string | null {
  const base = item.link ?? undefined;

  // 1. <enclosure> — só quando é imagem de fato.
  const enclosure = cleanUrl(item.enclosure?.url, base);
  if (enclosure && (item.enclosure?.type?.startsWith("image") || IMAGE_EXTENSIONS.test(enclosure))) {
    return enclosure;
  }

  // 2. media:content / media:thumbnail, inclusive dentro de media:group.
  const media =
    widestMedia(asArray(item.mediaContent), base) ??
    widestMedia(asArray(item.mediaThumbnail), base) ??
    widestMedia(asArray(item.mediaGroup?.["media:content"]), base) ??
    widestMedia(asArray(item.mediaGroup?.["media:thumbnail"]), base);
  if (media) return media;

  // 3. itunes:image e <image> soltos.
  const tagged =
    cleanUrl(item.itunesImage?.$?.href ?? item.itunesImage, base) ??
    cleanUrl(item.imageTag?.url ?? item.imageTag, base);
  if (tagged) return tagged;

  // 4. Primeiro <img> do corpo.
  const html = item.contentEncoded ?? item["content:encoded"] ?? item.content ?? "";
  const inline = /<img[^>]+src=["']([^"']+)["']/i.exec(String(html))?.[1];
  return cleanUrl(inline, base);
}

/** Último recurso: lê o og:image da página original da matéria. */
export async function imageFromArticle(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": "NTVNewsBot/1.0 (+https://ntvnews.com.br)", accept: "text/html" },
    });
    if (!response.ok) return null;

    // O <head> basta: evita baixar a página inteira só pela meta tag.
    const head = (await response.text()).slice(0, 200_000);
    const meta =
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(head) ??
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i.exec(head) ??
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i.exec(head);
    return cleanUrl(meta?.[1], url);
  } catch {
    return null;
  }
}

const BLOCK_TAG = /<(p|h[1-6]|ul|ol|blockquote|figure|div)[\s>]/i;

/** Normaliza a URL para comparar imagem do corpo com a capa (ignora querystring). */
const sameImage = (a?: string | null, b?: string | null) => {
  if (!a || !b) return false;
  const strip = (url: string) => url.split("?")[0].replace(/^https?:/, "");
  return strip(a) === strip(b);
};

/**
 * Deixa o corpo vindo do RSS apresentável:
 *
 * 1. remove a imagem que já é a capa — senão ela aparece duas vezes no post;
 * 2. o ge.globo entrega um `<img>` em CDATA e o resto como **texto puro** com `\n`;
 *    sem isso o post vira um parágrafo único gigante;
 * 3. descarta a primeira linha quando ela só repete o título (legenda do vídeo do topo).
 */
export function normalizeBody(
  raw: string,
  { coverImage, title }: { coverImage?: string | null; title?: string } = {},
): string {
  let html = String(raw ?? "").trim();
  if (!html) return "";

  // 1. Fora a capa duplicada.
  html = html.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = /src=["']([^"']+)["']/i.exec(tag)?.[1];
    return sameImage(src, coverImage) ? "" : tag;
  });

  // Já é HTML estruturado? Só limpa as sobras e devolve.
  if (BLOCK_TAG.test(html)) {
    return html.replace(/^(?:\s|<br\s*\/?>)+/i, "").trim();
  }

  // 2. Texto corrido → parágrafos. <br> também vira quebra.
  const normalizedTitle = (title ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const lines = html
    .replace(/<br\s*\/?>/gi, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const paragraphs: string[] = [];
  for (const [index, line] of lines.entries()) {
    // 3. Primeira linha repetindo o título não acrescenta nada.
    const plain = line.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (index === 0 && normalizedTitle && plain.toLowerCase() === normalizedTitle) continue;
    if (!plain) continue;
    // Linha que já é uma tag solta (ex.: iframe de vídeo) entra como está.
    paragraphs.push(/^<\w+[\s>]/.test(line) ? line : `<p>${line}</p>`);
  }

  return paragraphs.join("\n");
}

function excerptOf(html: string, max = 220): string {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

async function uniqueSlug(base: string) {
  let candidate = slugify(base) || `rss-${Date.now()}`;
  let n = 2;
  while (await Post.exists({ slug: candidate })) candidate = `${slugify(base)}-${n++}`;
  return candidate;
}

/** Janela em que dois títulos iguais são a mesma notícia. Fora dela, pauta
 *  recorrente ("Vasco treina em São Januário") não vira duplicata. */
const DEDUPE_WINDOW_DAYS = 7;

/**
 * Sites de torcida costumam soltar um flash curto e completar a matéria no
 * mesmo link minutos ou horas depois. Como a ingestão nunca revisita um
 * `externalId` já importado, sem isto o post fica preso na versão curta pra
 * sempre. A janela de revisão é só pras primeiras horas — depois disso, uma
 * mudança no texto da fonte é mais provável de ser edição do que expansão.
 */
const REFRESH_WINDOW_MS = 12 * 60 * 60 * 1000;

/**
 * Procura uma notícia já publicada com o mesmo título, dentro da janela.
 * Devolve a **ativa** (a que não é cópia de ninguém), para a cadeia de
 * duplicatas apontar sempre para a original.
 */
async function findActiveTwin(dedupeKey: string, when: Date) {
  if (!dedupeKey) return null;
  const window = DEDUPE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  return Post.findOne({
    dedupeKey,
    duplicateOf: null,
    publishedAt: {
      $gte: new Date(when.getTime() - window),
      $lte: new Date(when.getTime() + window),
    },
  })
    .select("_id title source")
    .lean();
}

/**
 * Reescreve `body`/`excerpt`/`seo.description` só quando a fonte
 * **acrescentou** texto ao que já está publicado — nunca quando o texto
 * mudou de outro jeito. Um post editado à mão no admin não bate mais com o
 * prefixo do feed e fica de fora, de propósito: preferimos ficar com uma
 * matéria curta a sobrescrever uma edição manual.
 */
async function expandExisting(
  existing: { _id: unknown; body?: string | null; seo?: { auto?: boolean | null } | null },
  item: Record<string, any>,
  category: string,
): Promise<boolean> {
  const html = item.contentEncoded ?? item.content ?? item.contentSnippet ?? "";
  if (!html) return false;

  let coverImage = imageFromItem(item);
  if (!coverImage && item.link) coverImage = await imageFromArticle(item.link);

  const body = normalizeBody(html, { coverImage, title: item.title });
  const existingText = toPlainText(existing.body ?? "");
  const freshText = toPlainText(body);
  if (freshText.length <= existingText.length || !freshText.startsWith(existingText)) return false;

  const update: Record<string, unknown> = { body, excerpt: excerptOf(body) };
  // Respeita descrição de SEO escrita à mão (seo.auto === false).
  if (existing.seo?.auto !== false) {
    const seo = buildPostSeo({ title: item.title, excerpt: excerptOf(body), body, category });
    update["seo.description"] = seo.description;
    update["seo.keywords"] = seo.keywords;
  }

  await Post.updateOne({ _id: existing._id }, { $set: update });
  return true;
}

/** Ingere uma fonte. Itens entram publicados com crédito (README §RSS). */
export async function ingestSource(sourceId: string): Promise<number> {
  const source = await RssSource.findById(sourceId);
  if (!source || !source.enabled) return 0;

  let imported = 0;
  let refreshed = 0;
  let missingImages = 0;
  let duplicates = 0;

  try {
    const feed = await parser.parseString(await fetchFeed(source.url));

    for (const item of feed.items ?? []) {
      const externalId = item.guid || item.link;
      if (!externalId || !item.title) continue;

      const existing = await Post.findOne({ externalId }).select("body seo.auto publishedAt");
      if (existing) {
        const stillFresh =
          existing.publishedAt && Date.now() - existing.publishedAt.getTime() < REFRESH_WINDOW_MS;
        if (stillFresh && (await expandExisting(existing, item, source.category))) refreshed += 1;
        continue;
      }

      const html =
        (item as any).contentEncoded ?? item.content ?? item.contentSnippet ?? "";

      let coverImage = imageFromItem(item as Record<string, any>);
      if (!coverImage && item.link) coverImage = await imageFromArticle(item.link);
      if (!coverImage) missingImages += 1;

      const body = normalizeBody(html, { coverImage, title: item.title });
      const publishedAt = item.isoDate ? new Date(item.isoDate) : new Date();

      // Mesma matéria já publicada por outra fonte: entra suprimida.
      const dedupeKey = titleFingerprint(item.title);
      const twin = await findActiveTwin(dedupeKey, publishedAt);
      if (twin) duplicates += 1;

      const seo = buildPostSeo({
        title: item.title,
        subtitle: (item as any).atomSubtitle,
        excerpt: excerptOf(body),
        body,
        category: source.category,
      });

      await Post.create({
        title: item.title,
        seo: { description: seo.description, keywords: seo.keywords, auto: true, noindex: false },
        geo: seo.geo,
        slug: await uniqueSlug(item.title),
        subtitle: (item as any).atomSubtitle ?? null,
        body,
        excerpt: excerptOf(body),
        coverImage,
        coverCredit: coverImage ? `Foto: ${source.name}` : null,
        category: source.category,
        source: { type: "rss", name: source.name, url: item.link ?? source.url },
        externalId,
        status: source.autoPublish ? "published" : "draft",
        publishedAt,
        dedupeKey,
        duplicateOf: twin?._id ?? null,
      });
      imported += 1;
    }
    source.lastError = null;
  } catch (error) {
    source.lastError = error instanceof Error ? error.message : String(error);
    console.error(`[rss] falha em ${source.name}:`, source.lastError);
  }

  if (duplicates) {
    console.log(`[rss] ${source.name}: ${duplicates} duplicata(s) suprimida(s).`);
  }
  if (missingImages) {
    console.warn(`[rss] ${source.name}: ${missingImages} de ${imported} item(ns) sem imagem.`);
  }
  if (refreshed) {
    console.log(`[rss] ${source.name}: ${refreshed} matéria(s) expandida(s) pela fonte.`);
  }

  source.lastFetchAt = new Date();
  source.importedCount = (source.importedCount ?? 0) + imported;
  await source.save();
  return imported;
}

export async function ingestAll(): Promise<{ imported: number; sources: number }> {
  const sources = await RssSource.find({ enabled: true }).select("_id").lean();
  let imported = 0;
  for (const s of sources) imported += await ingestSource(String(s._id));
  return { imported, sources: sources.length };
}
