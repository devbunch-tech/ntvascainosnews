import { GraphQLError } from "graphql";
import { Video } from "../../models/Video.js";
import { Ad } from "../../models/Ad.js";
import { Match } from "../../models/Match.js";
import { Standing } from "../../models/Standing.js";
import { Bracket } from "../../models/Bracket.js";
import { Signing } from "../../models/Signing.js";
import { Setting, getSettings } from "../../models/Setting.js";
import { requirePermission } from "../../lib/auth.js";
import { idField, type GraphQLContext } from "../../lib/context.js";
import { syncYoutube } from "../../jobs/youtube.js";
import { syncAll as syncMatchesJob, MatchSyncDisabled } from "../../jobs/matches.js";
import { syncMarket } from "../../jobs/market.js";

const NETWORKS = ["instagram", "x", "youtube", "facebook", "tiktok"];

/** Anúncio no ar: ativo e dentro da janela de veiculação. */
export function liveAdQuery(placement?: string) {
  const now = new Date();
  return {
    active: true,
    ...(placement ? { placement } : {}),
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
    ],
  };
}

export const mediaResolvers = {
  Query: {
    // `await` é obrigatório: devolver a Query do Mongoose faz o GraphQL
    // executá-la duas vezes ("Query was already executed").
    videos: async (_: unknown, { limit = 6 }: { limit?: number }) =>
      Video.find().sort({ publishedAt: -1 }).limit(Math.min(limit, 24)).lean().exec(),

    ads: async (
      _: unknown,
      { placement, includeInactive }: { placement?: string; includeInactive?: boolean },
      ctx: GraphQLContext,
    ) => {
      const isStaff = ctx.user?.role === "admin" || ctx.user?.role === "editor";
      const query = includeInactive && isStaff ? (placement ? { placement } : {}) : liveAdQuery(placement);
      return Ad.find(query).sort({ weight: -1, createdAt: -1 }).lean().exec();
    },

    standings: async () => Standing.find().sort({ order: 1 }).lean().exec(),

    brackets: async () => Bracket.find().sort({ order: 1 }).lean().exec(),

    standing: async (_: unknown, { key }: { key: string }) =>
      Standing.findOne({ key }).lean().exec(),

    signings: async (
      _: unknown,
      { direction = "in", limit = 5 }: { direction?: string; limit?: number },
    ) =>
      Signing.find(direction ? { direction } : {})
        .sort({ order: 1, createdAt: -1 })
        .limit(Math.min(limit, 30))
        .lean()
        .exec(),

    matches: async (_: unknown, { past }: { past?: boolean }) => {
      if (past === undefined) return Match.find().sort({ date: -1 }).limit(60).lean().exec();
      return past
        ? Match.find({ scoreFor: { $ne: null } }).sort({ date: -1 }).limit(30).lean().exec()
        : Match.find({ date: { $gte: new Date() } }).sort({ date: 1 }).limit(30).lean().exec();
    },
  },

  Mutation: {
    saveSocialLinks: async (
      _: unknown,
      { links }: { links: { network: string; url: string }[] },
      ctx: GraphQLContext,
    ) => {
      requirePermission(ctx.user, "settings:manage");
      const update: Record<string, string> = {};
      for (const link of links) {
        if (!NETWORKS.includes(link.network)) {
          throw new GraphQLError(`Rede desconhecida: ${link.network}`, {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
        update[`socialAccounts.${link.network}.url`] = link.url.trim();
      }
      await Setting.updateOne({ key: "site" }, { $set: update }, { upsert: true });
      return getSettings();
    },

    saveYoutubeChannel: async (
      _: unknown,
      { channelUrl }: { channelUrl: string },
      ctx: GraphQLContext,
    ) => {
      requirePermission(ctx.user, "settings:manage");
      // Zera o channelId: a próxima sincronização resolve o handle novo.
      await Setting.updateOne(
        { key: "site" },
        { $set: { "youtube.channelUrl": channelUrl.trim(), "youtube.channelId": null } },
        { upsert: true },
      );
      return getSettings();
    },

    saveTransfermarktUrl: async (_: unknown, { url }: { url: string }, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "settings:manage");
      await Setting.updateOne(
        { key: "site" },
        { $set: { "matches.transfermarktUrl": url.trim() } },
        { upsert: true },
      );
      return getSettings();
    },

    syncYoutube: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "settings:manage");
      const result = await syncYoutube();
      return result.imported;
    },

    syncMatches: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "settings:manage");
      try {
        const result = await syncMatchesJob();
        const detail = result.partial
          ? " (fonte gratuita: só o último resultado e o próximo jogo — complete no cadastro abaixo)"
          : result.standings
            ? " e classificação atualizada"
            : "";
        return {
          affected: result.upserted,
          skipped: 0,
          message: `${result.upserted} jogo(s) sincronizado(s) via ${result.provider}${detail}.`,
        };
      } catch (error) {
        if (error instanceof MatchSyncDisabled) {
          return { affected: 0, skipped: 0, message: error.message };
        }
        throw error;
      }
    },

    syncMarket: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "settings:manage");
      const result = await syncMarket();
      return {
        affected: result.rumours + result.signings,
        skipped: 0,
        message: `${result.rumours} boato(s), ${result.signings} transferência(s) e ${result.standings} tabela(s).`,
      };
    },

    createMatch: async (_: unknown, { input }: { input: any }, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "settings:manage");
      return (await Match.create(input)).toObject();
    },
    updateMatch: async (_: unknown, { id, input }: { id: string; input: any }, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "settings:manage");
      return Match.findByIdAndUpdate(id, { $set: input }, { new: true }).lean();
    },
    deleteMatch: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "settings:manage");
      await Match.findByIdAndDelete(id);
      return true;
    },

    createAd: async (_: unknown, { input }: { input: any }, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "settings:manage");
      return (await Ad.create(input)).toObject();
    },
    updateAd: async (_: unknown, { id, input }: { id: string; input: any }, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "settings:manage");
      return Ad.findByIdAndUpdate(id, { $set: input }, { new: true }).lean();
    },
    deleteAd: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "settings:manage");
      await Ad.findByIdAndDelete(id);
      return true;
    },
    trackAdClick: async (_: unknown, { id }: { id: string }) => {
      await Ad.findByIdAndUpdate(id, { $inc: { clicks: 1 } });
      return true;
    },
  },

  Video: { id: idField },
  Signing: { id: idField },
  Ad: { id: idField },
  YoutubeChannel: {
    channelUrl: (yt: any) => yt?.channelUrl ?? null,
  },
};
