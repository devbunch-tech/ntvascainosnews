/**
 * Reprocessa as notícias de RSS já importadas, agrupando duplicatas.
 *
 *   npm run rss:dedupe            → mostra o que faria, sem gravar
 *   npm run rss:dedupe -- --apply → grava
 *
 * Fica **uma ativa por grupo**: a publicada primeiro, que é quem deu a notícia.
 * As demais recebem `duplicateOf` e somem do portal, mas continuam no banco e
 * visíveis no admin — nada é apagado.
 */
import { titleFingerprint } from "@ntv/shared";
import { connectDB, disconnectDB } from "../db.js";
import { Post } from "../models/Post.js";

const DEDUPE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const apply = process.argv.includes("--apply");

await connectDB();

const posts = await Post.find({ "source.type": "rss" })
  .select("title publishedAt createdAt source dedupeKey duplicateOf")
  .sort({ publishedAt: 1, createdAt: 1 })
  .lean();

console.log(`[dedupe] analisando ${posts.length} notícia(s) de RSS…`);

/** Grupos por digital; dentro de cada digital, separa por janela de tempo. */
const groups = new Map<string, typeof posts>();
for (const post of posts) {
  const key = titleFingerprint(post.title);
  if (!key) continue;
  groups.set(key, [...(groups.get(key) ?? []), post]);
}

let suppressed = 0;
let groupsWithDupes = 0;
const updates: { id: unknown; dedupeKey: string; duplicateOf: unknown }[] = [];

for (const [key, entries] of groups) {
  // Dentro da digital, quebra em blocos: mesma manchete meses depois é
  // pauta recorrente, não cópia.
  const blocks: (typeof posts)[] = [];
  for (const post of entries) {
    const when = new Date(post.publishedAt ?? post.createdAt ?? Date.now()).getTime();
    const block = blocks.find((candidate) => {
      const first = candidate[0];
      const at = new Date(first.publishedAt ?? first.createdAt ?? Date.now()).getTime();
      return Math.abs(when - at) <= DEDUPE_WINDOW_MS;
    });
    if (block) block.push(post);
    else blocks.push([post]);
  }

  for (const block of blocks) {
    const [original, ...copies] = block;
    updates.push({ id: original._id, dedupeKey: key, duplicateOf: null });

    if (!copies.length) continue;
    groupsWithDupes += 1;
    suppressed += copies.length;

    console.log(`\n  "${original.title.slice(0, 70)}"`);
    console.log(`    mantém: ${original.source?.name ?? "—"}`);
    for (const copy of copies) {
      console.log(`    suprime: ${copy.source?.name ?? "—"} — ${copy.title.slice(0, 60)}`);
      updates.push({ id: copy._id, dedupeKey: key, duplicateOf: original._id });
    }
  }
}

if (apply) {
  for (const update of updates) {
    await Post.updateOne(
      { _id: update.id },
      { $set: { dedupeKey: update.dedupeKey, duplicateOf: update.duplicateOf } },
    );
  }
  console.log(`\n[dedupe] aplicado: ${suppressed} duplicata(s) em ${groupsWithDupes} grupo(s).`);
} else {
  console.log(
    `\n[dedupe] ${suppressed} duplicata(s) em ${groupsWithDupes} grupo(s). ` +
      `Nada gravado — rode com -- --apply para valer.`,
  );
}

await disconnectDB();
