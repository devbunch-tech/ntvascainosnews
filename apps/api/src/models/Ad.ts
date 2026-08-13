import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** Espaço de anunciante. Sem rede de terceiros: a peça é hospedada pelo portal. */
const adSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    advertiser: { type: String, default: null },
    imageUrl: { type: String, default: null },
    targetUrl: { type: String, required: true },
    /** Onde a peça aparece no portal. */
    placement: {
      type: String,
      enum: ["sidebar", "in_article", "footer", "shop"],
      default: "sidebar",
      index: true,
    },
    active: { type: Boolean, default: true, index: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    weight: { type: Number, default: 1 },
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  { timestamps: true },
);

type AdShape = InferSchemaType<typeof adSchema>;

export const Ad: Model<AdShape> =
  (mongoose.models.Ad as Model<AdShape>) ?? mongoose.model<AdShape>("Ad", adSchema);
