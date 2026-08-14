import { GraphQLError } from "graphql";
import { buildPostSeo, slugify } from "@ntv/shared";
import { Post } from "../../models/Post.js";
import { User } from "../../models/User.js";
import { Event } from "../../models/Event.js";
import { requirePermission, type AuthUser } from "../../lib/auth.js";
import { idField, type GraphQLContext } from "../../lib/context.js";

type PostFilter = {
  search?: string;
  status?: string;
  category?: string;
  sourceType?: string;
  authorId?: string;
  from?: string;
  to?: string;
  tag?: string;
  onlyDuplicates?: boolean;
  hideDuplicates?: boolean;
};

export function buildPostQuery(filter: PostFilter = {}, publicOnly = false) {
  const q: Record<string, unknown> = {};
  if (publicOnly) {
    q.status = "published";
    q.publishedAt = { $lte: new Date() };
    // Duplicata de RSS nunca aparece no portal — só a versão ativa.
    q.duplicateOf = null;
  } else if (filter.status) {
    q.status = filter.status;
  }
  // No admin, `onlyDuplicates` mostra exatamente o que foi suprimido.
  if (filter.onlyDuplicates) q.duplicateOf = { $ne: null };
  else if (!publicOnly && filter.hideDuplicates !== false) q.duplicateOf = null;
  if (filter.category) q.category = filter.category;
  if (filter.sourceType) q["source.type"] = filter.sourceType;
  if (filter.authorId) q.author = filter.authorId;
  if (filter.tag) q.tags = filter.tag;
  if (filter.search) q.title = { $regex: filter.search, $options: "i" };
  if (filter.from || filter.to) {
    const range: Record<string, Date> = {};
    if (filter.from) range.$gte = new Date(filter.from);
    if (filter.to) range.$lte = new Date(filter.to);
    q.createdAt = range;
  }
  return q;
}

export async function uniqueSlug(title: string, explicit?: string | null, ignoreId?: string) {
  const base = slugify(explicit || title) || `post-${Date.now()}`;
  let candidate = base;
  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const clash = await Post.findOne({ slug: candidate, ...(ignoreId ? { _id: { $ne: ignoreId } } : {}) })
      .select("_id")
      .lean();
    if (!clash) return candidate;
    candidate = `${base}-${n++}`;
  }
}

/** Aplica exclusividade por posição: quem ocupava a posição volta à lista comum. */
export async function assignFeatured(postId: string, position: number | null | undefined) {
  if (!position) {
    await Post.findByIdAndUpdate(postId, {
      $set: { "featured.active": false, "featured.position": null },
    });
    return;
  }
  if (![1, 2, 3].includes(position)) {
    throw new GraphQLError("Posição de destaque deve ser 1, 2 ou 3.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  await Post.updateMany(
    { "featured.position": position, _id: { $ne: postId } },
    { $set: { "featured.active": false, "featured.position": null } },
  );
  await Post.findByIdAndUpdate(postId, {
    $set: { "featured.active": true, "featured.position": position },
  });
}

/**
 * Preenche description, keywords e geo do post.
 *
 * Só regenera enquanto `seo.auto` estiver ligado — no momento em que alguém
 * escrever a descrição à mão no admin, o texto manual passa a mandar.
 */
function applySeo(data: Record<string, any>, input: Record<string, any>, existing?: any) {
  const manualDescription = input.seoDescription?.trim();
  const manualKeywords = input.seoKeywords?.length ? input.seoKeywords : null;
  const auto = existing?.seo?.auto !== false && !manualDescription && !manualKeywords;

  const seo = buildPostSeo(
    {
      title: input.title ?? existing?.title ?? "",
      subtitle: input.subtitle ?? existing?.subtitle,
      excerpt: input.excerpt ?? existing?.excerpt,
      body: input.body ?? existing?.body,
      tags: input.tags ?? existing?.tags,
      category: input.category ?? existing?.category,
    },
    {
      description: manualDescription ?? (auto ? null : existing?.seo?.description),
      keywords: manualKeywords ?? (auto ? null : existing?.seo?.keywords),
      geo: input.geo ?? existing?.geo,
    },
  );

  data["seo.description"] = seo.description;
  data["seo.keywords"] = seo.keywords;
  data["seo.auto"] = auto;
  if (input.noindex !== undefined) data["seo.noindex"] = input.noindex;
  data["geo.placename"] = seo.geo.placename;
  data["geo.region"] = seo.geo.region;
  data["geo.position"] = seo.geo.position;
  return data;
}

function applyPostInput(input: Record<string, any>) {
  const data: Record<string, unknown> = {};
  const direct = [
    "title",
    "subtitle",
    "coverImage",
    "coverCredit",
    "body",
    "excerpt",
    "category",
    "tags",
    "status",
    "publishedAt",
  ];
  for (const key of direct) if (input[key] !== undefined) data[key] = input[key];
  if (input.crosspost) data.crosspost = input.crosspost;
  if (input.authorId) data.author = input.authorId;
  if (input.status === "published" && !input.publishedAt) data.publishedAt = new Date();
  return data;
}

/** Converte as chaves com ponto em objeto, para o `create` do Mongoose. */
function seoDoc(flat: Record<string, any>) {
  return {
    seo: {
      description: flat["seo.description"],
      keywords: flat["seo.keywords"],
      auto: flat["seo.auto"],
      noindex: flat["seo.noindex"] ?? false,
    },
    geo: {
      placename: flat["geo.placename"],
      region: flat["geo.region"],
      position: flat["geo.position"],
    },
  };
}

export const postResolvers = {
  Query: {
    post: async (_: unknown, { slug }: { slug: string }) => {
      const post = await Post.findOne({ slug }).populate("author").lean();
      if (!post) return null;
      await Post.updateOne({ _id: post._id }, { $inc: { views: 1 } });
      await Event.create({ type: "post_view", ref: slug });
      return post;
    },

    posts: async (
      _: unknown,
      { filter, limit = 12, offset = 0 }: { filter?: PostFilter; limit?: number; offset?: number },
      ctx: GraphQLContext,
    ) => {
      // Sem sessão de admin/editor a listagem só devolve publicados.
      const isStaff = ctx.user?.role === "admin" || ctx.user?.role === "editor";
      const q = buildPostQuery(filter, !isStaff);
      const [items, total] = await Promise.all([
        Post.find(q)
          .sort({ publishedAt: -1, createdAt: -1 })
          .skip(offset)
          .limit(Math.min(limit, 50))
          .populate("author")
          .lean(),
        Post.countDocuments(q),
      ]);
      return { items, total, hasMore: offset + items.length < total };
    },

    relatedPosts: async (_: unknown, { slug, limit = 6 }: { slug: string; limit?: number }) => {
      const current = await Post.findOne({ slug }).select("category tags").lean();
      return Post.find({
        slug: { $ne: slug },
        status: "published",
        duplicateOf: null,
        ...(current ? { $or: [{ category: current.category }, { tags: { $in: current.tags } }] } : {}),
      })
        .sort({ publishedAt: -1 })
        .limit(limit)
        .populate("author")
        .lean();
    },

    /**
     * Busca das notícias. Usa o índice de texto em português (stemming +
     * stopwords) e ordena por relevância; se o termo não render nada — nome
     * próprio, palavra curta, trecho de slug — cai para busca por substring.
     */
    searchPosts: async (
      _: unknown,
      { q, limit = 20, offset = 0 }: { q: string; limit?: number; offset?: number },
    ) => {
      const term = q.trim();
      if (term.length < 2) return { items: [], total: 0, hasMore: false, fallback: false };

      const base = { status: "published" as const, duplicateOf: null };
      const take = Math.min(limit, 50);

      const textQuery = { ...base, $text: { $search: term } };
      const [textItems, textTotal] = await Promise.all([
        Post.find(textQuery, { score: { $meta: "textScore" } })
          .sort({ score: { $meta: "textScore" }, publishedAt: -1 })
          .skip(offset)
          .limit(take)
          .populate("author")
          .lean(),
        Post.countDocuments(textQuery),
      ]);

      if (textTotal > 0) {
        return {
          items: textItems,
          total: textTotal,
          hasMore: offset + textItems.length < textTotal,
          fallback: false,
        };
      }

      // Fallback por substring, com o termo escapado para não virar regex.
      const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = { $regex: safe, $options: "i" };
      const loose = {
        ...base,
        $or: [{ title: regex }, { subtitle: regex }, { excerpt: regex }, { tags: regex }],
      };

      const [items, total] = await Promise.all([
        Post.find(loose).sort({ publishedAt: -1 }).skip(offset).limit(take).populate("author").lean(),
        Post.countDocuments(loose),
      ]);

      return { items, total, hasMore: offset + items.length < total, fallback: true };
    },

    sitemapPosts: async (_: unknown, { limit = 5000 }: { limit?: number }) => {
      const posts = await Post.find({ status: "published", duplicateOf: null })
        .sort({ publishedAt: -1 })
        .limit(Math.min(limit, 20000))
        .select("slug title updatedAt publishedAt coverImage category excerpt seo")
        .lean();

      return posts.map((post) => ({
        ...post,
        excerpt: post.seo?.description ?? post.excerpt ?? null,
        keywords: post.seo?.keywords ?? [],
      }));
    },

    categories: async () => {
      const rows = await Post.aggregate([
        { $match: { status: "published", duplicateOf: null } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);
      return rows.map((r) => ({ value: r._id ?? "Notícias", count: r.count }));
    },

    postTags: async (
      _: unknown,
      { limit = 200, minCount = 2 }: { limit?: number; minCount?: number },
    ) => {
      const rows = await Post.aggregate([
        { $match: { status: "published", duplicateOf: null } },
        { $unwind: "$tags" },
        { $group: { _id: "$tags", count: { $sum: 1 } } },
        { $match: { count: { $gte: Math.max(1, minCount) } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: Math.min(limit, 1000) },
      ]);
      return rows
        .filter((r) => typeof r._id === "string" && r._id.trim())
        .map((r) => ({ value: r._id, count: r.count }));
    },
  },

  Mutation: {
    createPost: async (_: unknown, { input }: { input: any }, ctx: GraphQLContext) => {
      const user = requirePermission(ctx.user, "posts:write");
      const slug = await uniqueSlug(input.title, input.slug);
      const post = await Post.create({
        ...applyPostInput(input),
        ...seoDoc(applySeo({}, input)),
        slug,
        author: input.authorId ?? user.id,
        source: { type: "team", name: null, url: null },
      });
      if (input.featured?.active) await assignFeatured(String(post._id), input.featured.position);
      return Post.findById(post._id).populate("author").lean();
    },

    updatePost: async (_: unknown, { id, input }: { id: string; input: any }, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "posts:write");
      const existing = await Post.findById(id).lean();
      const data = applySeo(applyPostInput(input), input, existing);
      if (input.slug || input.title) data.slug = await uniqueSlug(input.title, input.slug, id);
      await Post.findByIdAndUpdate(id, { $set: data });
      if (input.featured) {
        await assignFeatured(id, input.featured.active ? input.featured.position : null);
      }
      return Post.findById(id).populate("author").lean();
    },

    deletePost: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      const user = requirePermission(ctx.user, "posts:write");
      const post = await Post.findById(id).select("author").lean();
      if (!post) return false;
      // EDITOR não exclui posts de terceiros (README §Usuários).
      const isOwn = String(post.author ?? "") === user.id;
      if (user.role !== "admin" && !isOwn) {
        throw new GraphQLError("Editores não excluem posts de outros autores.", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      await Post.findByIdAndDelete(id);
      return true;
    },

    bulkUpdatePosts: async (
      _: unknown,
      { ids, status, category }: { ids: string[]; status?: string; category?: string },
      ctx: GraphQLContext,
    ) => {
      requirePermission(ctx.user, "posts:write");
      if (!ids.length) return { affected: 0, skipped: 0, message: "Nada selecionado." };
      if (!status && !category) {
        throw new GraphQLError("Escolha um status ou uma categoria para aplicar.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const data: Record<string, unknown> = {};
      if (category) data.category = category;
      if (status) {
        data.status = status;
        // Publicar em massa carimba a data em quem ainda não tinha uma.
        if (status === "published") {
          await Post.updateMany(
            { _id: { $in: ids }, publishedAt: null },
            { $set: { publishedAt: new Date() } },
          );
        }
      }

      const result = await Post.updateMany({ _id: { $in: ids } }, { $set: data });
      return {
        affected: result.modifiedCount,
        skipped: 0,
        message: `${result.modifiedCount} notícia(s) atualizada(s).`,
      };
    },

    bulkDeletePosts: async (_: unknown, { ids }: { ids: string[] }, ctx: GraphQLContext) => {
      const user = requirePermission(ctx.user, "posts:write");
      if (!ids.length) return { affected: 0, skipped: 0, message: "Nada selecionado." };

      // Editor só apaga o que é dele — a mesma regra do deletePost individual.
      const filter =
        user.role === "admin" ? { _id: { $in: ids } } : { _id: { $in: ids }, author: user.id };

      const result = await Post.deleteMany(filter);
      const skipped = ids.length - result.deletedCount;
      return {
        affected: result.deletedCount,
        skipped,
        message: skipped
          ? `${result.deletedCount} excluída(s). ${skipped} pertencem a outro autor e foram mantidas.`
          : `${result.deletedCount} notícia(s) excluída(s).`,
      };
    },

    publishPost: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "posts:write");
      const post = await Post.findByIdAndUpdate(
        id,
        { $set: { status: "published", publishedAt: new Date() } },
        { new: true },
      )
        .populate("author")
        .lean();
      if (post?.crosspost?.instagram || post?.crosspost?.x) {
        // Duplicação em redes dispara no evento de publicação (README §Interactions).
        console.log(`[crosspost] agendado para "${post.title}"`, post.crosspost);
      }
      return post;
    },

    setFeatured: async (
      _: unknown,
      { postId, position }: { postId: string; position?: number | null },
      ctx: GraphQLContext,
    ) => {
      requirePermission(ctx.user, "featured:manage");
      await assignFeatured(postId, position ?? null);
      return Post.findById(postId).populate("author").lean();
    },

    reorderFeatured: async (
      _: unknown,
      { slots }: { slots: { postId: string; position: number }[] },
      ctx: GraphQLContext,
    ) => {
      requirePermission(ctx.user, "featured:manage");
      const ids = slots.map((s) => s.postId);
      await Post.updateMany(
        { _id: { $nin: ids }, "featured.active": true },
        { $set: { "featured.active": false, "featured.position": null } },
      );
      for (const slot of slots) await assignFeatured(slot.postId, slot.position);
      return Post.find({ "featured.active": true })
        .sort({ "featured.position": 1 })
        .populate("author")
        .lean();
    },
  },

  Post: {
    id: idField,
    seo: (p: any) => ({
      description: p.seo?.description ?? p.excerpt ?? null,
      keywords: p.seo?.keywords ?? [],
      auto: p.seo?.auto ?? true,
      noindex: p.seo?.noindex ?? false,
    }),
    geo: (p: any) => p.geo ?? null,
    tags: (p: { tags?: string[] }) => p.tags ?? [],
    body: (p: { body?: string }) => p.body ?? "",
    featured: (p: { featured?: { active?: boolean; position?: number | null } }) => ({
      active: p.featured?.active ?? false,
      position: p.featured?.position ?? null,
    }),
    crosspost: (p: { crosspost?: { instagram?: boolean; x?: boolean } }) => ({
      instagram: p.crosspost?.instagram ?? false,
      x: p.crosspost?.x ?? false,
    }),
    source: (p: { source?: { type?: string; name?: string; url?: string } }) => ({
      type: p.source?.type ?? "team",
      name: p.source?.name ?? null,
      url: p.source?.url ?? null,
    }),
    duplicateOf: (p: { duplicateOf?: unknown }) => (p.duplicateOf ? String(p.duplicateOf) : null),
    duplicateSource: async (p: { duplicateOf?: unknown }) => {
      if (!p.duplicateOf) return null;
      const original = await Post.findById(p.duplicateOf).select("source").lean();
      return original?.source?.name ?? null;
    },
    credit: (p: { source?: { type?: string; name?: string } }) =>
      p.source?.type === "rss" && p.source?.name ? `via ${p.source.name} · RSS` : null,
    author: async (p: { author?: unknown }) => {
      if (!p.author) return null;
      if (typeof p.author === "object" && "name" in (p.author as object)) return p.author;
      return User.findById(p.author).lean();
    },
  },

  Author: { id: idField },
};

export type { AuthUser };
