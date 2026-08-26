/** Popula o banco com dados de demonstração fiéis aos mockups.
 *  Uso: npm run seed  (apaga e recria as coleções). */
import { slugify } from "@ntv/shared";
import { connectDB, disconnectDB } from "./db.js";
import { hashPassword } from "./lib/auth.js";
import { User } from "./models/User.js";
import { Post } from "./models/Post.js";
import { Product } from "./models/Product.js";
import { Poll } from "./models/Poll.js";
import { RssSource } from "./models/RssSource.js";
import { XSource } from "./models/XSource.js";
import { Setting } from "./models/Setting.js";
import { Match, ClubStat } from "./models/Match.js";
import { Event } from "./models/Event.js";

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
const hoursAgo = (n: number) => new Date(Date.now() - n * 3600000);

await connectDB();

console.log("[seed] limpando coleções…");
await Promise.all([
  User.deleteMany({}),
  Post.deleteMany({}),
  Product.deleteMany({}),
  Poll.deleteMany({}),
  RssSource.deleteMany({}),
  XSource.deleteMany({}),
  Setting.deleteMany({}),
  Match.deleteMany({}),
  ClubStat.deleteMany({}),
  Event.deleteMany({}),
]);

const [leo, editor, reader] = await User.create([
  {
    name: "Leo Lacerda",
    email: "leo@ntvnews.com.br",
    passwordHash: await hashPassword("ntv123456"),
    role: "admin",
    bio: "Apresentador do canal Na Torcida Vascaínos. Cobre o Vasco desde 2016.",
    avatarUrl: null,
    lastLoginAt: new Date(),
  },
  {
    name: "Marina Alves",
    email: "marina@ntvnews.com.br",
    passwordHash: await hashPassword("ntv123456"),
    role: "editor",
    bio: "Repórter de bastidores.",
    lastLoginAt: hoursAgo(6),
  },
  {
    name: "Torcedor Teste",
    email: "torcedor@exemplo.com",
    passwordHash: await hashPassword("ntv123456"),
    role: "reader",
    preferences: { newsletter: true, matchAlerts: true, shopNews: false },
  },
]);

await User.create({
  name: "Rafael Bastos",
  email: "rafael@ntvnews.com.br",
  role: "editor",
  invitePending: true,
});

const teamPosts = [
  {
    title: "Vasco fecha contratação de meia argentino para a sequência do Brasileirão",
    subtitle: "Jogador de 26 anos chega por empréstimo de um ano com opção de compra.",
    category: "Mercado da Bola",
    tags: ["reforço", "mercado", "brasileirão"],
    featured: { active: true, position: 1 },
    author: leo._id,
    hours: 2,
  },
  {
    title: "Bastidores: o que mudou no vestiário depois da vitória em São Januário",
    subtitle: "Comissão técnica adotou nova rotina de treinos.",
    category: "Bastidores",
    tags: ["vestiário", "elenco"],
    featured: { active: true, position: 2 },
    author: leo._id,
    hours: 5,
  },
  {
    title: "Análise tática: como o Vasco resolveu o problema do meio-campo",
    subtitle: "Mudança de esquema deu equilíbrio à equipe nas últimas cinco partidas.",
    category: "Análise",
    tags: ["tática", "análise"],
    featured: { active: true, position: 3 },
    author: editor._id,
    hours: 9,
  },
  {
    title: "Exclusivo: diretoria já negocia renovação do camisa 10",
    subtitle: "Conversas avançaram nesta semana.",
    category: "NTV Exclusivo",
    tags: ["renovação", "exclusivo"],
    featured: { active: false, position: null },
    author: leo._id,
    hours: 14,
  },
  {
    title: "Base do Vasco tem três convocados para a Seleção Sub-20",
    subtitle: "Garotos de São Januário seguem em evidência.",
    category: "Base",
    tags: ["base", "seleção"],
    featured: { active: false, position: null },
    author: editor._id,
    hours: 20,
  },
  {
    title: "Onde assistir: escala, arbitragem e prováveis para o próximo clássico",
    subtitle: "Tudo o que você precisa saber antes da bola rolar.",
    category: "Jogos",
    tags: ["clássico", "escalação"],
    featured: { active: false, position: null },
    author: leo._id,
    hours: 26,
  },
];

const body = (title: string) => `
<p>${title} — a informação foi apurada pela equipe do NTV News junto a pessoas próximas às negociações.</p>
<h2>O que está definido</h2>
<p>As partes acertaram os principais pontos do acordo nesta semana. Os valores não foram revelados oficialmente,
mas fontes indicam que o clube conseguiu diluir o impacto no orçamento da temporada.</p>
<blockquote>O torcedor pode ficar tranquilo: o planejamento está sendo cumprido à risca.</blockquote>
<h2>Próximos passos</h2>
<p>A tendência é que o anúncio oficial saia nos próximos dias, após a assinatura do contrato e a realização
dos exames médicos em São Januário.</p>
`;

const createdTeam = await Post.create(
  teamPosts.map((p) => ({
    title: p.title,
    slug: slugify(p.title),
    subtitle: p.subtitle,
    body: body(p.title),
    excerpt: p.subtitle,
    category: p.category,
    tags: p.tags,
    author: p.author,
    source: { type: "team" },
    status: "published",
    publishedAt: hoursAgo(p.hours),
    featured: p.featured,
    crosspost: { instagram: true, x: false },
    views: Math.floor(Math.random() * 8000) + 500,
  })),
);

const rssTitles = [
  ["Vasco encaminha empréstimo de zagueiro ao futebol português", "ge.globo"],
  ["Ingressos para o próximo jogo em São Januário esgotam em duas horas", "Lance!"],
  ["CBF divulga tabela detalhada das próximas cinco rodadas", "ge.globo"],
  ["Vasco anuncia novo patrocínio máster para a temporada", "UOL Esporte"],
  ["Atacante volta a treinar com bola e deve ser relacionado", "Lance!"],
  ["STJD julga recurso do clube nesta quinta-feira", "UOL Esporte"],
  ["Cruzmaltino sobe uma posição no ranking da CBF", "ge.globo"],
  ["Obras do CT avançam e nova ala fica pronta em dois meses", "Lance!"],
];

await Post.create(
  rssTitles.map(([title, feed], i) => ({
    title,
    slug: slugify(title),
    body: `<p>${title}.</p>`,
    excerpt: title,
    category: "Notícias",
    tags: [],
    source: { type: "rss", name: feed, url: "https://exemplo.com/noticia" },
    externalId: `seed-rss-${i}`,
    status: "published",
    publishedAt: hoursAgo(i * 3 + 1),
    views: Math.floor(Math.random() * 3000),
  })),
);

await Post.create({
  title: "Rascunho: entrevista exclusiva com o novo reforço",
  slug: "rascunho-entrevista-novo-reforco",
  body: "<p>Em edição.</p>",
  category: "NTV Exclusivo",
  author: leo._id,
  source: { type: "team" },
  status: "draft",
});

await Post.create({
  title: "Agendado: prévia do clássico de domingo",
  slug: "agendado-previa-do-classico",
  body: "<p>Publicação agendada.</p>",
  category: "Jogos",
  author: editor._id,
  source: { type: "team" },
  status: "scheduled",
  publishedAt: new Date(Date.now() + 86400000),
});

await Product.create([
  {
    title: "Camisa Oficial Vasco I 2025 — Torcedor",
    price: 349.9,
    marketplace: "Shopee",
    category: "Camisas",
    externalUrl: "https://shopee.com.br/exemplo-camisa-1",
    highlighted: true,
  },
  {
    title: "Camisa Oficial Vasco II 2025 — Torcedor",
    price: 329.9,
    marketplace: "Mercado Livre",
    category: "Camisas",
    externalUrl: "https://mercadolivre.com.br/exemplo-camisa-2",
  },
  {
    title: "Boné Aba Curta Cruz de Malta",
    price: 89.9,
    marketplace: "Shopee",
    category: "Acessórios",
    externalUrl: "https://shopee.com.br/exemplo-bone",
  },
  {
    title: "Caneca Térmica São Januário 500ml",
    price: 74.9,
    marketplace: "Amazon",
    category: "Acessórios",
    externalUrl: "https://amazon.com.br/exemplo-caneca",
    soldOut: true,
  },
  {
    title: "Moletom Cruzmaltino Preto",
    price: 259.9,
    marketplace: "Mercado Livre",
    category: "Moletons",
    externalUrl: "https://mercadolivre.com.br/exemplo-moletom",
    highlighted: true,
  },
  {
    title: "Chaveiro Metálico Escudo",
    price: 34.9,
    marketplace: "Shopee",
    category: "Acessórios",
    externalUrl: "https://shopee.com.br/exemplo-chaveiro",
  },
  {
    title: "Camisa Retrô 1998 — Edição Limitada",
    price: 419.9,
    marketplace: "Amazon",
    category: "Camisas",
    externalUrl: "https://amazon.com.br/exemplo-retro",
  },
  {
    title: "Bola Oficial Réplica",
    price: 149.9,
    marketplace: "Shopee",
    category: "Esportes",
    externalUrl: "https://shopee.com.br/exemplo-bola",
    visible: false,
  },
]);

await Poll.create([
  {
    player: { name: "Nicolás Ferreira", position: "Meia", club: "Argentinos Jrs" },
    question: "É um bom reforço para o Vasco?",
    votes: { good: 812, bad: 194 },
    order: 1,
  },
  {
    player: { name: "Diego Martins", position: "Zagueiro", club: "Athletico-PR" },
    question: "É um bom reforço para o Vasco?",
    votes: { good: 340, bad: 505 },
    order: 2,
  },
  {
    player: { name: "Ruan Pereira", position: "Lateral-direito", club: "Coritiba" },
    question: "É um bom reforço para o Vasco?",
    votes: { good: 601, bad: 288 },
    order: 3,
  },
]);

await RssSource.create([
  {
    name: "ge.globo — Vasco",
    url: "https://pox.globo.com/rss/ge/futebol/times/vasco",
    category: "Notícias",
  },
]);

await XSource.create([
  { handle: "leolacerdantv", name: "Léo Lacerda", category: "Notícias" },
  { handle: "PodCruzmaltino", name: "Pod Cruzmaltino", category: "Notícias" },
  { handle: "pedrosa", name: "Pedrosa", category: "Notícias" },
  { handle: "Vascanellas", name: "Vascanellas", category: "Notícias" },
]);

await ClubStat.create({
  key: "current",
  position: 6,
  points: 42,
  played: 25,
  wins: 12,
  draws: 6,
  losses: 7,
});

await Match.create([
  { opponent: "Botafogo", date: daysAgo(3), competition: "Brasileirão", venue: "home", scoreFor: 2, scoreAgainst: 0 },
  { opponent: "Grêmio", date: daysAgo(10), competition: "Brasileirão", venue: "away", scoreFor: 1, scoreAgainst: 1 },
  { opponent: "Bahia", date: daysAgo(17), competition: "Brasileirão", venue: "home", scoreFor: 3, scoreAgainst: 1 },
  { opponent: "Palmeiras", date: daysAgo(24), competition: "Brasileirão", venue: "away", scoreFor: 0, scoreAgainst: 2 },
  { opponent: "Fortaleza", date: daysAgo(31), competition: "Copa do Brasil", venue: "home", scoreFor: 2, scoreAgainst: 1 },
  { opponent: "Cruzeiro", date: daysAgo(-4), competition: "Brasileirão", venue: "away" },
  { opponent: "Internacional", date: daysAgo(-11), competition: "Brasileirão", venue: "home" },
  { opponent: "Athletico-PR", date: daysAgo(-18), competition: "Brasileirão", venue: "away" },
  { opponent: "Juventude", date: daysAgo(-25), competition: "Brasileirão", venue: "home" },
  { opponent: "Atlético-MG", date: daysAgo(-32), competition: "Brasileirão", venue: "away" },
]);

await Setting.create({
  key: "site",
  socialAccounts: {
    instagram: { connected: true, handle: "@ntvnews" },
    x: { connected: true, handle: "@ntvnews" },
    youtube: { connected: true, handle: "Na Torcida Vascaínos" },
  },
});

// Eventos do dia para os stat-cards do dashboard não nascerem zerados.
await Event.create([
  ...Array.from({ length: 1847 }, () => ({ type: "visit", ref: "/" })),
  ...Array.from({ length: 63 }, () => ({ type: "shop_click", ref: "seed" })),
]);

console.log(`[seed] pronto.
  usuários: ${await User.countDocuments()} (admin: leo@ntvnews.com.br / ntv123456)
  posts:    ${await Post.countDocuments()} (${createdTeam.length} da equipe)
  produtos: ${await Product.countDocuments()}
  enquetes: ${await Poll.countDocuments()}
  leitor:   torcedor@exemplo.com / ntv123456`);

await disconnectDB();
