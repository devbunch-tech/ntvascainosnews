import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const productSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, default: null },
    /** Link do marketplace — abre em nova aba, rel="noopener sponsored". */
    externalUrl: { type: String, required: true },
    marketplace: { type: String, default: "Shopee", index: true },
    category: { type: String, default: null, index: true },
    visible: { type: Boolean, default: true, index: true },
    soldOut: { type: Boolean, default: false },
    highlighted: { type: Boolean, default: false },
    clicks: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type ProductDoc = InferSchemaType<typeof productSchema> & {
  _id: mongoose.Types.ObjectId;
};

type ProductShape = InferSchemaType<typeof productSchema>;

// O cast mantém os tipos concretos do schema em `.lean()` / `.findById()`.
export const Product: Model<ProductShape> =
  (mongoose.models.Product as Model<ProductShape>) ??
  mongoose.model<ProductShape>("Product", productSchema);
