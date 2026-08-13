/**
 * Remove o conteúdo de demonstração para o site entrar com dados reais.
 *
 *   npm run reset:content              → apaga posts, produtos, enquetes, jogos e métricas
 *   npm run reset:content -- --rss     → apaga também as fontes RSS de exemplo
 *   npm run reset:content -- --users   → apaga usuários que não são admin
 *   npm run reset:content -- --all     → tudo acima
 *
 * Usuários e configurações são PRESERVADOS por padrão — apagá-los tiraria seu
 * próprio acesso ao painel.
 */
import { connectDB, disconnectDB } from "../db.js";
import { Post } from "../models/Post.js";
import { Product } from "../models/Product.js";
import { Poll } from "../models/Poll.js";
import { RssSource } from "../models/RssSource.js";
import { Match, ClubStat } from "../models/Match.js";
import { Event } from "../models/Event.js";
import { User } from "../models/User.js";

const flags = process.argv.slice(2);
const all = flags.includes("--all");
const wipeRss = all || flags.includes("--rss");
const wipeUsers = all || flags.includes("--users");

await connectDB();

const removed: string[] = [];

const [posts, products, polls, matches, stats, events] = await Promise.all([
  Post.deleteMany({}),
  Product.deleteMany({}),
  Poll.deleteMany({}),
  Match.deleteMany({}),
  ClubStat.deleteMany({}),
  Event.deleteMany({}),
]);

removed.push(
  `posts: ${posts.deletedCount}`,
  `produtos: ${products.deletedCount}`,
  `enquetes: ${polls.deletedCount}`,
  `jogos: ${matches.deletedCount}`,
  `estatísticas: ${stats.deletedCount}`,
  `eventos: ${events.deletedCount}`,
);

// Votos antigos apontam para enquetes que deixaram de existir.
await User.updateMany({}, { $set: { pollVotes: [] } });

if (wipeRss) {
  const rss = await RssSource.deleteMany({});
  removed.push(`fontes RSS: ${rss.deletedCount}`);
}

if (wipeUsers) {
  const users = await User.deleteMany({ role: { $ne: "admin" } });
  removed.push(`usuários não-admin: ${users.deletedCount}`);
}

console.log(`[reset] removido — ${removed.join(" · ")}`);
console.log(
  `[reset] preservados: ${await User.countDocuments()} usuário(s) e as configurações do site.`,
);
if (!wipeRss) console.log("[reset] fontes RSS mantidas (use --rss para apagá-las).");

await disconnectDB();
