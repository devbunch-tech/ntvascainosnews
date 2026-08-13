import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, default: null },
    avatarUrl: { type: String, default: null },
    bio: { type: String, default: null },
    role: {
      type: String,
      enum: ["admin", "editor", "reader"],
      default: "reader",
      index: true,
    },
    preferences: {
      newsletter: { type: Boolean, default: true },
      matchAlerts: { type: Boolean, default: false },
      shopNews: { type: Boolean, default: false },
    },
    /** Um voto por usuário por enquete (README §Enquete). */
    pollVotes: [
      {
        _id: false,
        poll: { type: Schema.Types.ObjectId, ref: "Poll", required: true },
        choice: { type: String, enum: ["good", "bad"], required: true },
        votedAt: { type: Date, default: Date.now },
      },
    ],
    /** Preenchido quando a conta vier do Customer Account API da Shopify.
     *  Em localhost fica nulo — o login é o de e-mail/senha desta API.
     *  Ver docs/shopify-oxygen.md §Login com conta Shopify. */
    shopifyCustomerId: { type: String, default: null, index: true, sparse: true },
    lastLoginAt: { type: Date, default: null },
    invitePending: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };

type UserShape = InferSchemaType<typeof userSchema>;

// O cast mantém os tipos concretos do schema em `.lean()` / `.findById()`.
export const User: Model<UserShape> =
  (mongoose.models.User as Model<UserShape>) ??
  mongoose.model<UserShape>("User", userSchema);
