import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const rssSourceSchema = new Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: true },
    /** Itens do RSS entram publicados automaticamente (README §RSS). */
    autoPublish: { type: Boolean, default: true },
    category: { type: String, default: "Notícias" },
    lastFetchAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    importedCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type RssSourceDoc = InferSchemaType<typeof rssSourceSchema> & {
  _id: mongoose.Types.ObjectId;
};

type RssSourceShape = InferSchemaType<typeof rssSourceSchema>;

// O cast mantém os tipos concretos do schema em `.lean()` / `.findById()`.
export const RssSource: Model<RssSourceShape> =
  (mongoose.models.RssSource as Model<RssSourceShape>) ??
  mongoose.model<RssSourceShape>("RssSource", rssSourceSchema);
