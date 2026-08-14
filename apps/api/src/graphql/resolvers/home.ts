import { Post } from "../../models/Post.js";
import { Product } from "../../models/Product.js";
import { Poll } from "../../models/Poll.js";
import { Match, ClubStat } from "../../models/Match.js";
import { User } from "../../models/User.js";
import { Event } from "../../models/Event.js";
import { Video } from "../../models/Video.js";
import { Ad } from "../../models/Ad.js";
import { Signing } from "../../models/Signing.js";
import { getSettings } from "../../models/Setting.js";
import { liveAdQuery } from "./media.js";
import { resolveAdLimit, MAX_AD_LIMIT } from "@ntv/shared";
import { idField, type GraphQLContext } from "../../lib/context.js";

// `duplicateOf: null` mantém a home livre da mesma notícia repetida por
// duas fontes de RSS.
const PUBLISHED = { status: "published" as const, duplicateOf: null };

export const homeResolvers = {
  Query: {
    home: async (_: unknown, { latestLimit = 12 }: { latestLimit?: number }, ctx: GraphQLContext) => {
      const staffIds = (await User.find({ role: { $in: ["admin", "editor"] } })
        .select("_id")
        .lean()).map((u) => u._id);

      const [settings, [featured, teamPosts, latest, latestTotal, clubStats, lastMatches, nextMatches, polls, shop, videos, adPool, signings]] =
        await Promise.all([
        // As configurações entram no mesmo lote das demais consultas: buscá-las
        // antes tornaria a rota mais quente do site uma ida a mais em série.
        getSettings(),
        Promise.all([
          Post.find({ ...PUBLISHED, "featured.active": true })
            .sort({ "featured.position": 1 })
            .limit(3)
            .populate("author")
            .lean(),
          // Seção "LEO LACERDA & EQUIPE" — conteúdo próprio, sempre acima das demais.
          Post.find({ ...PUBLISHED, "source.type": "team", author: { $in: staffIds } })
            .sort({ publishedAt: -1 })
            .limit(3)
            .populate("author")
            .lean(),
          Post.find(PUBLISHED)
            .sort({ publishedAt: -1 })
            .limit(Math.min(latestLimit, 30))
            .populate("author")
            .lean(),
          Post.countDocuments(PUBLISHED),
          ClubStat.findOne({ key: "current" }).lean(),
          Match.find({ scoreFor: { $ne: null } }).sort({ date: -1 }).limit(5).lean(),
          Match.find({ date: { $gte: new Date() } }).sort({ date: 1 }).limit(5).lean(),
          Poll.find({ status: "open" }).sort({ order: 1, rumouredAt: -1 }).limit(5).lean(),
          Product.find({ visible: true }).sort({ highlighted: -1, createdAt: -1 }).limit(4).lean(),
          Video.find().sort({ publishedAt: -1 }).limit(3).lean(),
          // Busca o teto e corta depois: o limite configurado só se conhece
          // junto com as configurações, que estão vindo neste mesmo lote.
          Ad.find(liveAdQuery("sidebar")).sort({ weight: -1, createdAt: -1 }).limit(MAX_AD_LIMIT).lean(),
          Signing.find({ direction: "in" }).sort({ order: 1, createdAt: -1 }).limit(5).lean(),
        ]),
      ]);

      // Quantas campanhas a sidebar exibe é configurável no admin; 0 desliga o
      // espaço sem precisar pausar cada campanha uma a uma.
      const ads = adPool.slice(0, resolveAdLimit(settings.sidebar?.adLimit));

      // Impressão é contada aqui: o anúncio foi entregue na resposta do SSR.
      // Depois do corte, de propósito — peça que não foi entregue não computa.
      if (ads.length) {
        await Ad.updateMany({ _id: { $in: ads.map((ad) => ad._id) } }, { $inc: { impressions: 1 } });
      }

      const votes = ctx.user
        ? new Map(
            ((await User.findById(ctx.user.id).select("pollVotes").lean())?.pollVotes ?? []).map(
              (v: any) => [String(v.poll), v.choice],
            ),
          )
        : new Map<string, string>();

      const tickerPost = featured[0] ?? latest[0];

      return {
        featured,
        teamPosts,
        latest: {
          items: latest,
          total: latestTotal,
          hasMore: latest.length < latestTotal,
        },
        clubStats,
        lastMatches,
        nextMatches,
        activePolls: polls.map((p) => ({ ...p, __myVote: votes.get(String(p._id)) ?? null })),
        shopHighlights: shop,
        signings,
        latestVideos: videos,
        ads,
        ticker: tickerPost?.title ?? null,
      };
    },
  },

  Mutation: {
    trackVisit: async (_: unknown, { path }: { path?: string }) => {
      await Event.create({ type: "visit", ref: path ?? "/" });
      return true;
    },
  },

  ClubStats: {
    efficiency: (s: { points?: number; played?: number }) => {
      const played = s.played ?? 0;
      if (!played) return 0;
      return Math.round(((s.points ?? 0) / (played * 3)) * 100);
    },
  },

  Match: {
    id: idField,
    result: (m: { scoreFor?: number | null; scoreAgainst?: number | null }) => {
      if (m.scoreFor == null || m.scoreAgainst == null) return null;
      return m.scoreFor > m.scoreAgainst ? "W" : m.scoreFor === m.scoreAgainst ? "D" : "L";
    },
  },
};
