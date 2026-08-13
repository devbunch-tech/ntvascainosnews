import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const pollSchema = new Schema(
  {
    player: {
      name: { type: String, required: true },
      position: { type: String, default: "" },
      club: { type: String, default: "" },
      photo: { type: String, default: null },
    },
    question: { type: String, default: "É um bom reforço para o Vasco?" },
    votes: {
      good: { type: Number, default: 0 },
      bad: { type: Number, default: 0 },
    },
    status: { type: String, enum: ["open", "closed"], default: "open", index: true },
    order: { type: Number, default: 0 },
    /** Preenchidos quando a enquete nasce de um boato do Transfermarkt. */
    externalId: { type: String, default: null, index: true, sparse: true },
    fee: { type: String, default: null },
    probability: { type: Number, default: null },
    rumouredAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type PollDoc = InferSchemaType<typeof pollSchema> & { _id: mongoose.Types.ObjectId };

type PollShape = InferSchemaType<typeof pollSchema>;

// O cast mantém os tipos concretos do schema em `.lean()` / `.findById()`.
export const Poll: Model<PollShape> =
  (mongoose.models.Poll as Model<PollShape>) ??
  mongoose.model<PollShape>("Poll", pollSchema);
