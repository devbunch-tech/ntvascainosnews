import { GraphQLError } from "graphql";
import { Poll } from "../../models/Poll.js";
import { PollVote } from "../../models/PollVote.js";
import { User } from "../../models/User.js";
import { requirePermission } from "../../lib/auth.js";
import { idField, type GraphQLContext } from "../../lib/context.js";

/**
 * O que este usuário já votou.
 *
 * Logado: `users.pollVotes`, que é a fonte confiável e sobrevive a troca de
 * navegador. Sem login: a coleção `pollvotes`, chaveada pelo id anônimo.
 */
async function myVotes(ctx: GraphQLContext): Promise<Map<string, string>> {
  if (ctx.user) {
    const user = await User.findById(ctx.user.id).select("pollVotes").lean();
    return new Map((user?.pollVotes ?? []).map((v: any) => [String(v.poll), v.choice as string]));
  }

  const votes = await PollVote.find({ voter: ctx.voterId }).select("poll choice").lean();
  return new Map(votes.map((v) => [String(v.poll), v.choice as string]));
}

export const pollResolvers = {
  Query: {
    polls: async (
      _: unknown,
      { status, limit = 50 }: { status?: string; limit?: number },
      ctx: GraphQLContext,
    ) => {
      const polls = await Poll.find(status ? { status } : {})
        .sort({ order: 1, createdAt: -1 })
        .limit(Math.min(limit, 100))
        .lean();
      const votes = await myVotes(ctx);
      return polls.map((p) => ({ ...p, __myVote: votes.get(String(p._id)) ?? null }));
    },
  },

  Mutation: {
    /**
     * Voto na enquete. **Não exige login** — a ideia é medir o clique da
     * torcida, não cadastrar gente. A dedupe é por conta (quando logado) ou
     * pelo id anônimo do navegador.
     */
    votePoll: async (
      _: unknown,
      { pollId, choice }: { pollId: string; choice: "good" | "bad" },
      ctx: GraphQLContext,
    ) => {
      const poll = await Poll.findById(pollId);
      if (!poll || poll.status !== "open") {
        throw new GraphQLError("Enquete indisponível.", { extensions: { code: "BAD_USER_INPUT" } });
      }

      if (ctx.user) {
        const user = await User.findById(ctx.user.id);
        if (!user) throw new GraphQLError("Usuário não encontrado.");

        const already = (user.pollVotes ?? []).find((v: any) => String(v.poll) === pollId);
        if (already) {
          throw new GraphQLError("Você já votou nesta enquete.", {
            extensions: { code: "ALREADY_VOTED" },
          });
        }

        poll.votes ??= { good: 0, bad: 0 };
        poll.votes[choice] = (poll.votes[choice] ?? 0) + 1;
        await poll.save();

        user.pollVotes.push({ poll: poll._id, choice, votedAt: new Date() } as never);
        await user.save();

        return { ...poll.toObject(), __myVote: choice };
      }

      // Anônimo: o índice único (poll, voter) é quem garante um voto por
      // navegador. Inserir primeiro e só então contar evita corrida.
      try {
        await PollVote.create({ poll: poll._id, voter: ctx.voterId, choice });
      } catch (error) {
        const duplicate = (error as { code?: number })?.code === 11000;
        if (duplicate) {
          throw new GraphQLError("Você já votou nesta enquete.", {
            extensions: { code: "ALREADY_VOTED" },
          });
        }
        throw error;
      }

      poll.votes ??= { good: 0, bad: 0 };
      poll.votes[choice] = (poll.votes[choice] ?? 0) + 1;
      await poll.save();

      return { ...poll.toObject(), __myVote: choice };
    },

    createPoll: async (_: unknown, args: any, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "posts:write");
      const poll = await Poll.create({
        player: {
          name: args.playerName,
          position: args.position ?? "",
          club: args.club ?? "",
          photo: args.photo ?? null,
        },
        ...(args.question ? { question: args.question } : {}),
      });
      return poll.toObject();
    },

    closePoll: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "posts:write");
      return Poll.findByIdAndUpdate(id, { $set: { status: "closed" } }, { new: true }).lean();
    },
  },

  Poll: {
    id: idField,
    totalVotes: (p: any) => (p.votes?.good ?? 0) + (p.votes?.bad ?? 0),
    myVote: (p: any) => p.__myVote ?? null,
    // Agregado público — as barras do widget "Mercado da Bola" o consomem sempre.
    goodPercent: (p: any) => {
      const good = p.votes?.good ?? 0;
      const total = good + (p.votes?.bad ?? 0);
      return total === 0 ? 0 : Math.round((good / total) * 100);
    },
  },
};
