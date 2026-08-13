import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** Classificação por competição, cacheada do Transfermarkt. */
const standingSchema = new Schema(
  {
    competition: { type: String, required: true },
    /** Slug estável usado na URL do portal: "brasileirao", "carioca"… */
    key: { type: String, required: true, unique: true },
    season: { type: String, default: null },
    sourceUrl: { type: String, default: null },
    order: { type: Number, default: 0 },
    rows: [
      {
        _id: false,
        position: Number,
        team: String,
        played: Number,
        wins: Number,
        draws: Number,
        losses: Number,
        goalsFor: Number,
        goalsAgainst: Number,
        goalDiff: Number,
        points: Number,
        /** Marca a linha do Vasco para destacar na tabela. */
        highlight: { type: Boolean, default: false },
      },
    ],
    lastSyncAt: { type: Date, default: null },
  },
  { timestamps: true },
);

type StandingShape = InferSchemaType<typeof standingSchema>;

export const Standing: Model<StandingShape> =
  (mongoose.models.Standing as Model<StandingShape>) ??
  mongoose.model<StandingShape>("Standing", standingSchema);
