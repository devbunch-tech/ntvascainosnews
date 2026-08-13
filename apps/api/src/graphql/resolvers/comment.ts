import { GraphQLError } from "graphql";
import { moderateComment } from "@ntv/shared";
import { Comment } from "../../models/Comment.js";
import { Post } from "../../models/Post.js";
import { User } from "../../models/User.js";
import { requireAuth } from "../../lib/auth.js";
import { idField, type GraphQLContext } from "../../lib/context.js";

const MAX_LENGTH = 1500;
/** Janela anti-flood: um comentário a cada 20 s por usuário. */
const COOLDOWN_MS = 20_000;

/** Público vê só publicados; o autor vê também os próprios rejeitados. */
const visibilityFor = (ctx: GraphQLContext) =>
  ctx.user ? { $or: [{ status: "published" }, { author: ctx.user.id }] } : { status: "published" };

export const commentResolvers = {
  Query: {
    comments: async (
      _: unknown,
      { postSlug, limit = 20, offset = 0 }: { postSlug: string; limit?: number; offset?: number },
      ctx: GraphQLContext,
    ) => {
      const post = await Post.findOne({ slug: postSlug }).select("_id").lean();
      if (!post) return { items: [], total: 0, hasMore: false };

      const visibility = visibilityFor(ctx);
      const rootQuery = { post: post._id, parent: null, ...visibility };

      const [roots, rootTotal, total] = await Promise.all([
        Comment.find(rootQuery)
          .sort({ createdAt: -1 })
          .skip(offset)
          .limit(Math.min(limit, 50))
          .populate("author", "name avatarUrl")
          .lean(),
        Comment.countDocuments(rootQuery),
        // Cabeçalho mostra o total geral, respostas incluídas.
        Comment.countDocuments({ post: post._id, ...visibility }),
      ]);

      // Uma consulta só para todas as respostas da página — evita N+1.
      const replies = await Comment.find({
        parent: { $in: roots.map((root) => root._id) },
        ...visibility,
      })
        .sort({ createdAt: 1 })
        .populate("author", "name avatarUrl")
        .lean();

      const byParent = new Map<string, unknown[]>();
      for (const reply of replies) {
        const key = String(reply.parent);
        byParent.set(key, [...(byParent.get(key) ?? []), reply]);
      }

      return {
        items: roots.map((root) => ({ ...root, __replies: byParent.get(String(root._id)) ?? [] })),
        total,
        hasMore: offset + roots.length < rootTotal,
      };
    },
  },

  Mutation: {
    addComment: async (
      _: unknown,
      { postSlug, body, parentId }: { postSlug: string; body: string; parentId?: string | null },
      ctx: GraphQLContext,
    ) => {
      const me = requireAuth(ctx.user);
      const text = body.trim();

      if (text.length < 2) return { ok: false, comment: null, error: "Escreva um comentário." };
      if (text.length > MAX_LENGTH) {
        return { ok: false, comment: null, error: `Máximo de ${MAX_LENGTH} caracteres.` };
      }

      const post = await Post.findOne({ slug: postSlug }).select("_id").lean();
      if (!post) throw new GraphQLError("Notícia não encontrada.", { extensions: { code: "NOT_FOUND" } });

      // Árvore de um nível: responder a uma resposta prende no comentário-raiz.
      let parent: string | null = null;
      let replyingTo: string | null = null;
      if (parentId) {
        const target = await Comment.findById(parentId).populate("author", "name").lean();
        if (!target || String(target.post) !== String(post._id)) {
          return { ok: false, comment: null, error: "Comentário respondido não existe mais." };
        }
        parent = String(target.parent ?? target._id);
        // Só faz sentido citar o autor quando a resposta é a outra resposta:
        // responder à raiz já fica claro pela indentação.
        if (target.parent) {
          replyingTo = (target.author as { name?: string } | null)?.name ?? null;
        }
      }

      const last = await Comment.findOne({ author: me.id }).sort({ createdAt: -1 }).select("createdAt").lean();
      if (last?.createdAt && Date.now() - new Date(last.createdAt).getTime() < COOLDOWN_MS) {
        return { ok: false, comment: null, error: "Aguarde alguns segundos para comentar de novo." };
      }

      const verdict = moderateComment(text);
      if (!verdict.allowed) {
        // Fica gravado como `rejected`: o autor vê o próprio, o público não.
        await Comment.create({
          post: post._id,
          author: me.id,
          parent,
          replyingTo,
          body: text,
          status: "rejected",
          moderation: { category: verdict.category, term: verdict.term },
        });
        return { ok: false, comment: null, error: verdict.message, category: verdict.category };
      }

      const created = await Comment.create({
        post: post._id,
        author: me.id,
        parent,
        replyingTo,
        body: text,
      });
      const comment = await Comment.findById(created._id).populate("author", "name avatarUrl").lean();
      return { ok: true, comment, error: null, category: null };
    },

    removeComment: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      const me = requireAuth(ctx.user);
      const comment = await Comment.findById(id).select("author").lean();
      if (!comment) return false;

      const isStaff = me.role === "admin" || me.role === "editor";
      if (!isStaff && String(comment.author) !== me.id) {
        throw new GraphQLError("Você só pode remover os próprios comentários.", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      // Remover a raiz leva junto as respostas — thread órfã não faz sentido.
      await Comment.updateMany(
        { $or: [{ _id: id }, { parent: id }] },
        { $set: { status: "removed" } },
      );
      return true;
    },
  },

  Comment: {
    id: idField,
    parentId: (comment: any) => (comment.parent ? String(comment.parent) : null),
    replies: (comment: any) => comment.__replies ?? [],
    replyingTo: (comment: any) => comment.replyingTo ?? null,
    mine: (comment: any, _args: unknown, ctx: GraphQLContext) =>
      Boolean(ctx.user && String(comment.author?._id ?? comment.author) === ctx.user.id),
    author: async (comment: any) => {
      if (comment.author && typeof comment.author === "object" && "name" in comment.author) {
        return comment.author;
      }
      return User.findById(comment.author).select("name avatarUrl").lean();
    },
  },

  CommentAuthor: { id: idField },
};
