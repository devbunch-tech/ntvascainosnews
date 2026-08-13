import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** Jogos e classificação. Pode ser alimentado por API externa e cacheado aqui. */
const matchSchema = new Schema(
  {
    opponent: { type: String, required: true },
    date: { type: Date, required: true, index: true },
    competition: { type: String, default: "Brasileirão" },
    venue: { type: String, enum: ["home", "away"], default: "home" },
    scoreFor: { type: Number, default: null },
    scoreAgainst: { type: Number, default: null },
    /** Link de venda de ingresso — só faz sentido em jogo futuro. */
    ticketUrl: { type: String, default: null },
    /** Id na fonte externa, para o sincronizador não duplicar. */
    externalId: { type: String, default: null, index: true, sparse: true },
  },
  { timestamps: true },
);

matchSchema.virtual("result").get(function () {
  const f = this.scoreFor;
  const a = this.scoreAgainst;
  if (f == null || a == null) return null;
  return f > a ? "W" : f === a ? "D" : "L";
});

export type MatchDoc = InferSchemaType<typeof matchSchema> & { _id: mongoose.Types.ObjectId };

type MatchShape = InferSchemaType<typeof matchSchema>;

export const Match: Model<MatchShape> =
  (mongoose.models.Match as Model<MatchShape>) ??
  mongoose.model<MatchShape>("Match", matchSchema);

const clubStatSchema = new Schema(
  {
    key: { type: String, default: "current", unique: true },
    position: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    played: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
  },
  { timestamps: true },
);

type ClubStatShape = InferSchemaType<typeof clubStatSchema>;

export const ClubStat: Model<ClubStatShape> =
  (mongoose.models.ClubStat as Model<ClubStatShape>) ??
  mongoose.model<ClubStatShape>("ClubStat", clubStatSchema);
