import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Perfil do X (Twitter) monitorado pela ingestão automática.
 *
 * A leitura usa o endpoint não-documentado de sindicação de timeline (o mesmo
 * que o widget de embed do X consome) — não há API de leitura gratuita
 * oficial. `lastError` é o que avisa no admin quando o X mudar o formato e
 * quebrar o parser (ver jobs/x-ingest.ts).
 */
const xSourceSchema = new Schema(
  {
    /** @handle sem o "@". */
    handle: { type: String, required: true, unique: true, trim: true },
    /** Nome de exibição, usado no título e no crédito do post. */
    name: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    /** Itens entram publicados automaticamente, como no RSS. */
    autoPublish: { type: Boolean, default: true },
    category: { type: String, default: "Notícias" },
    lastFetchAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    importedCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type XSourceDoc = InferSchemaType<typeof xSourceSchema> & {
  _id: mongoose.Types.ObjectId;
};

type XSourceShape = InferSchemaType<typeof xSourceSchema>;

export const XSource: Model<XSourceShape> =
  (mongoose.models.XSource as Model<XSourceShape>) ??
  mongoose.model<XSourceShape>("XSource", xSourceSchema);
