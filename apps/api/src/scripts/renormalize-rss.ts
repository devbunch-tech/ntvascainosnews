/**
 * Reaplica a normalização de corpo nos posts que já entraram pelo RSS.
 * Útil depois de mexer em `normalizeBody` — evita ter que reimportar tudo.
 *
 *   npm run rss:renormalize
 */
import { connectDB, disconnectDB } from "../db.js";
import { normalizeBody } from "../jobs/ingest.js";
import { Post } from "../models/Post.js";

await connectDB();

const posts = await Post.find({ "source.type": "rss" }).select("title body coverImage");
let changed = 0;

for (const post of posts) {
  const body = normalizeBody(post.body ?? "", {
    coverImage: post.coverImage,
    title: post.title,
  });
  if (body === post.body) continue;

  post.body = body;
  post.excerpt = body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 220);
  await post.save();
  changed += 1;
}

console.log(`[renormalize] ${changed} de ${posts.length} post(s) reformatado(s).`);
await disconnectDB();
