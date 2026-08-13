import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** Eventos crus para os stat-cards do dashboard (visitas, cliques na Loja). */
const eventSchema = new Schema({
  type: { type: String, enum: ["visit", "shop_click", "post_view"], required: true, index: true },
  ref: { type: String, default: null },
  createdAt: { type: Date, default: Date.now, index: true },
});

export type EventDoc = InferSchemaType<typeof eventSchema> & { _id: mongoose.Types.ObjectId };

type EventShape = InferSchemaType<typeof eventSchema>;

export const Event: Model<EventShape> =
  (mongoose.models.Event as Model<EventShape>) ??
  mongoose.model<EventShape>("Event", eventSchema);
