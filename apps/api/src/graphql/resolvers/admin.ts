import { resolveSidebarWidgets, resolveAdLimit } from "@ntv/shared";
import { Post } from "../../models/Post.js";
import { Event } from "../../models/Event.js";
import { RssSource } from "../../models/RssSource.js";
import { XSource } from "../../models/XSource.js";
import { Setting, getSettings } from "../../models/Setting.js";
import { requirePermission } from "../../lib/auth.js";
import { idField, type GraphQLContext } from "../../lib/context.js";
import { ingestAll } from "../../jobs/ingest.js";
import { ingestAllX } from "../../jobs/x-ingest.js";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const NETWORKS = ["instagram", "x", "youtube"] as const;

export const adminResolvers = {
  Query: {
    dashboard: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "posts:write");
      const today = startOfToday();

      const [visits, shopClicks, postsToday, rssToday, featured, sources, recent] = await Promise.all([
        Event.countDocuments({ type: "visit", createdAt: { $gte: today } }),
        Event.countDocuments({ type: "shop_click", createdAt: { $gte: today } }),
        Post.find({ createdAt: { $gte: today } }).select("source").lean(),
        Post.countDocuments({ "source.type": "rss", createdAt: { $gte: today } }),
        Post.find({ "featured.active": true }).sort({ "featured.position": 1 }).populate("author").lean(),
        RssSource.find().sort({ name: 1 }).lean(),
        Post.find().sort({ updatedAt: -1 }).limit(8).populate("author").lean(),
      ]);

      const team = postsToday.filter((p) => p.source?.type !== "rss" && p.source?.type !== "x").length;

      // Três slots fixos; posição vaga volta como null (slot tracejado no dashboard).
      const slots: (unknown | null)[] = [null, null, null];
      for (const post of featured) {
        const pos = post.featured?.position;
        if (pos && pos >= 1 && pos <= 3) slots[pos - 1] = post;
      }

      return {
        stats: {
          visitsToday: visits,
          postsToday: postsToday.length,
          postsTodaySplit: { team, rss: postsToday.length - team },
          rssImportedToday: rssToday,
          shopClicksToday: shopClicks,
        },
        featuredSlots: slots,
        rssSources: sources,
        recentPosts: recent,
      };
    },

    settings: async () => getSettings(),

    rssSources: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "rss:manage");
      return RssSource.find().sort({ name: 1 }).lean();
    },

    xSources: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "x:manage");
      return XSource.find().sort({ name: 1 }).lean();
    },
  },

  Mutation: {
    saveSettings: async (_: unknown, { input }: { input: any }, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "settings:manage");
      const data: Record<string, unknown> = {};
      for (const key of ["siteName", "logoUrl", "faviconUrl", "url", "maintenance"]) {
        if (input[key] !== undefined) data[key] = input[key];
      }
      if (input.seoTitle !== undefined) data["seo.title"] = input.seoTitle;
      if (input.seoDescription !== undefined) data["seo.description"] = input.seoDescription;
      if (input.seoOgImage !== undefined) data["seo.ogImage"] = input.seoOgImage;
      if (input.seoKeywords !== undefined) data["seo.keywords"] = input.seoKeywords;
      if (input.googleVerification !== undefined) {
        data["seo.googleVerification"] = input.googleVerification;
      }
      await Setting.updateOne({ key: "site" }, { $set: data }, { upsert: true });
      return getSettings();
    },

    saveSidebar: async (
      _: unknown,
      { widgets, adLimit }: { widgets: { key: string; visible: boolean }[]; adLimit: number },
      ctx: GraphQLContext,
    ) => {
      requirePermission(ctx.user, "settings:manage");
      // Passa pelo resolvedor antes de gravar para descartar chave inventada e
      // duplicata; o que sobra é a lista na ordem em que o admin mandou.
      const clean = resolveSidebarWidgets(widgets).map((w) => ({ key: w.key, visible: w.visible }));
      await Setting.updateOne(
        { key: "site" },
        { $set: { "sidebar.widgets": clean, "sidebar.adLimit": resolveAdLimit(adLimit) } },
        { upsert: true },
      );
      return getSettings();
    },

    connectSocial: async (
      _: unknown,
      { network, handle }: { network: string; handle: string },
      ctx: GraphQLContext,
    ) => {
      requirePermission(ctx.user, "social:manage");
      if (!NETWORKS.includes(network as (typeof NETWORKS)[number])) {
        throw new Error(`Rede desconhecida: ${network}`);
      }
      await Setting.updateOne(
        { key: "site" },
        { $set: { [`socialAccounts.${network}`]: { connected: true, handle } } },
        { upsert: true },
      );
      return getSettings();
    },

    disconnectSocial: async (_: unknown, { network }: { network: string }, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "social:manage");
      await Setting.updateOne(
        { key: "site" },
        { $set: { [`socialAccounts.${network}`]: { connected: false, handle: null } } },
      );
      return getSettings();
    },

    createRssSource: async (_: unknown, { input }: { input: any }, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "rss:manage");
      return (await RssSource.create(input)).toObject();
    },
    updateRssSource: async (_: unknown, { id, input }: { id: string; input: any }, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "rss:manage");
      return RssSource.findByIdAndUpdate(id, { $set: input }, { new: true }).lean();
    },
    toggleRssSource: async (
      _: unknown,
      { id, enabled }: { id: string; enabled: boolean },
      ctx: GraphQLContext,
    ) => {
      requirePermission(ctx.user, "rss:manage");
      return RssSource.findByIdAndUpdate(id, { $set: { enabled } }, { new: true }).lean();
    },
    deleteRssSource: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "rss:manage");
      await RssSource.findByIdAndDelete(id);
      return true;
    },
    runRssIngest: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "rss:manage");
      const { imported } = await ingestAll();
      return imported;
    },

    createXSource: async (_: unknown, { input }: { input: any }, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "x:manage");
      return (await XSource.create({ ...input, handle: input.handle.replace(/^@/, "") })).toObject();
    },
    updateXSource: async (_: unknown, { id, input }: { id: string; input: any }, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "x:manage");
      const data = input.handle ? { ...input, handle: input.handle.replace(/^@/, "") } : input;
      return XSource.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
    },
    toggleXSource: async (
      _: unknown,
      { id, enabled }: { id: string; enabled: boolean },
      ctx: GraphQLContext,
    ) => {
      requirePermission(ctx.user, "x:manage");
      return XSource.findByIdAndUpdate(id, { $set: { enabled } }, { new: true }).lean();
    },
    deleteXSource: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "x:manage");
      await XSource.findByIdAndDelete(id);
      return true;
    },
    runXIngest: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "x:manage");
      const { imported } = await ingestAllX();
      return imported;
    },
  },

  RssSource: { id: idField },
  XSource: { id: idField },
  Settings: {
    // Resolvido na leitura, não na gravação: assim um widget novo no código
    // aparece para quem já tem configuração salva, sem migração de banco.
    sidebar: (s: any) => ({
      widgets: resolveSidebarWidgets(s.sidebar?.widgets),
      adLimit: resolveAdLimit(s.sidebar?.adLimit),
    }),
    seo: (s: any) => ({
      title: s.seo?.title ?? "",
      description: s.seo?.description ?? "",
      ogImage: s.seo?.ogImage ?? null,
      keywords: s.seo?.keywords ?? [],
      googleVerification: s.seo?.googleVerification ?? null,
      organizationName: s.seo?.organizationName ?? s.siteName ?? "NTV News",
      foundingDate: s.seo?.foundingDate ?? null,
    }),
    socialAccounts: (s: any) => {
      const empty = { connected: false, handle: null, url: null };
      return {
        instagram: s.socialAccounts?.instagram ?? empty,
        x: s.socialAccounts?.x ?? empty,
        youtube: s.socialAccounts?.youtube ?? empty,
        facebook: s.socialAccounts?.facebook ?? empty,
        tiktok: s.socialAccounts?.tiktok ?? empty,
      };
    },
    youtube: (s: any) => s.youtube ?? { channelUrl: null, channelId: null },
    matches: (s: any) => s.matches ?? { transfermarktUrl: null, lastCount: 0 },
  },
};
