/** Gera SEO para os posts que ainda não têm. Uso: npm run seo:backfill */
import { buildPostSeo } from "@ntv/shared";
import { connectDB, disconnectDB } from "../db.js";
import { Post } from "../models/Post.js";

await connectDB();

const posts = await Post.find().select("title subtitle excerpt body tags category seo geo");
let updated = 0;

for (const post of posts) {
  // Descrição escrita à mão não é sobrescrita.
  if (post.seo?.auto === false) continue;

  const seo = buildPostSeo({
    title: post.title,
    subtitle: post.subtitle,
    excerpt: post.excerpt,
    body: post.body,
    tags: post.tags,
    category: post.category,
  });

  post.set("seo.description", seo.description);
  post.set("seo.keywords", seo.keywords);
  post.set("seo.auto", true);
  post.set("geo", seo.geo);
  await post.save();
  updated += 1;
}

console.log(`[seo] ${updated} de ${posts.length} post(s) com SEO gerado.`);
await disconnectDB();
