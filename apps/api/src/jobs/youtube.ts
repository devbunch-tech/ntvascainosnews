/**
 * Sincroniza os vídeos do canal via **feed público** do YouTube — sem API key.
 *
 *   https://www.youtube.com/feeds/videos.xml?channel_id=UC...
 *
 * O feed exige o channelId (`UC...`), mas o admin cadastra a URL com @handle.
 * A primeira sincronização resolve o handle lendo a página do canal e guarda o
 * channelId em `settings.youtube.channelId`.
 */
import { Setting, getSettings } from "../models/Setting.js";
import { Video } from "../models/Video.js";

const TIMEOUT_MS = 15000;
const HEADERS = { "user-agent": "NTVNewsBot/1.0 (+https://ntvnews.com.br)" };

/** Extrai o channelId de uma URL de canal (@handle, /channel/UC..., /c/nome). */
export async function resolveChannelId(channelUrl: string): Promise<string> {
  const direct = /\/channel\/(UC[\w-]{20,})/.exec(channelUrl)?.[1];
  if (direct) return direct;

  const response = await fetch(channelUrl, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "follow",
    headers: HEADERS,
  });
  if (!response.ok) throw new Error(`Canal respondeu HTTP ${response.status}`);

  const html = await response.text();

  // A ORDEM IMPORTA. O HTML da página tem vários "channelId", e o primeiro
  // costuma ser de um vídeo recomendado — não do canal. O id do próprio canal
  // é o do link canônico / externalId. Pegar o "channelId" solto traz o canal errado.
  const channelId =
    /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{20,})"/.exec(html)?.[1] ??
    /<meta itemprop="identifier" content="(UC[\w-]{20,})"/.exec(html)?.[1] ??
    /"externalId":"(UC[\w-]{20,})"/.exec(html)?.[1];

  if (!channelId) throw new Error("Não achei o channelId nessa URL de canal.");
  return channelId;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
};

/** Títulos do feed vêm com entidades (&quot;, &amp;) — o portal exibe o texto cru. */
function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&([a-z#0-9]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

const tag = (xml: string, name: string) => {
  const value = new RegExp(`<${name}[^>]*>([^<]*)</${name}>`).exec(xml)?.[1];
  return value == null ? null : decodeEntities(value);
};

export interface YoutubeSyncResult {
  imported: number;
  total: number;
  channelTitle: string | null;
}

export async function syncYoutube(): Promise<YoutubeSyncResult> {
  const settings = await getSettings();
  const channelUrl = settings.youtube?.channelUrl;
  if (!channelUrl) throw new Error("Nenhum canal configurado em Configurações → Redes sociais.");

  try {
    const channelId = settings.youtube?.channelId || (await resolveChannelId(channelUrl));

    const response = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS), headers: HEADERS },
    );
    if (!response.ok) throw new Error(`Feed respondeu HTTP ${response.status}`);

    const xml = await response.text();
    const channelTitle = tag(xml.slice(0, xml.indexOf("<entry>") + 1), "title");
    const entries = xml.split("<entry>").slice(1);

    let imported = 0;
    for (const entry of entries) {
      const videoId = tag(entry, "yt:videoId");
      const title = tag(entry, "title");
      const published = tag(entry, "published");
      if (!videoId || !title || !published) continue;

      const result = await Video.updateOne(
        { videoId },
        {
          $set: {
            title,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            thumbnail:
              /<media:thumbnail url="([^"]+)"/.exec(entry)?.[1] ??
              `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            publishedAt: new Date(published),
            channelTitle,
          },
        },
        { upsert: true },
      );
      if (result.upsertedCount) imported += 1;
    }

    await Setting.updateOne(
      { key: "site" },
      {
        $set: {
          "youtube.channelId": channelId,
          "youtube.channelTitle": channelTitle,
          "youtube.lastSyncAt": new Date(),
          "youtube.lastError": null,
        },
      },
    );

    return { imported, total: entries.length, channelTitle };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await Setting.updateOne(
      { key: "site" },
      { $set: { "youtube.lastSyncAt": new Date(), "youtube.lastError": message } },
    );
    throw error;
  }
}
