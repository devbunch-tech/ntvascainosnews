import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Voto de visitante **sem login**.
 *
 * Voto de usuário logado continua em `users.pollVotes` — é a fonte confiável.
 * Aqui a identidade é um id anônimo que o portal grava num cookie de longa
 * duração; sem cookie, cai no par IP + user-agent.
 *
 * Isso segura o clique repetido do mesmo navegador, mas **não é à prova de
 * fraude**: quem limpar o cookie ou trocar de aba anônima vota de novo. É a
 * troca consciente por não exigir cadastro.
 */
const pollVoteSchema = new Schema(
  {
    poll: { type: Schema.Types.ObjectId, ref: "Poll", required: true, index: true },
    voter: { type: String, required: true },
    choice: { type: String, enum: ["good", "bad"], required: true },
  },
  { timestamps: true },
);

pollVoteSchema.index({ poll: 1, voter: 1 }, { unique: true });

type PollVoteShape = InferSchemaType<typeof pollVoteSchema>;

export const PollVote: Model<PollVoteShape> =
  (mongoose.models.PollVote as Model<PollVoteShape>) ??
  mongoose.model<PollVoteShape>("PollVote", pollVoteSchema);
