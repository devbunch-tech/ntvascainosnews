import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** Chaveamento de copa (mata-mata), por fase. */
const bracketSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    competition: { type: String, required: true },
    sourceUrl: { type: String, default: null },
    order: { type: Number, default: 0 },
    rounds: [
      {
        _id: false,
        name: String,
        order: Number,
        ties: [
          {
            _id: false,
            home: String,
            away: String,
            score: { type: String, default: null },
            date: { type: Date, default: null },
            highlight: { type: Boolean, default: false },
          },
        ],
      },
    ],
    lastSyncAt: { type: Date, default: null },
  },
  { timestamps: true },
);

type BracketShape = InferSchemaType<typeof bracketSchema>;

export const Bracket: Model<BracketShape> =
  (mongoose.models.Bracket as Model<BracketShape>) ??
  mongoose.model<BracketShape>("Bracket", bracketSchema);
