import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const postSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    subtitle: { type: String, default: null },
    coverImage: { type: String, default: null },
    coverCredit: { type: String, default: null },
    /** HTML do editor rich-text. */
    body: { type: String, default: "" },
    excerpt: { type: String, default: null },
    category: { type: String, default: "Notícias", index: true },
    tags: { type: [String], default: [] },
    author: { type: Schema.Types.ObjectId, ref: "User", default: null },
    source: {
      type: { type: String, enum: ["team", "rss"], default: "team", index: true },
      name: { type: String, default: null },
      url: { type: String, default: null },
    },
    /** Chave de dedupe da ingestão RSS (guid do item). */
    externalId: { type: String, default: null, index: true, sparse: true },
    /** Impressão digital do título, para pegar a mesma notícia vinda de
     *  feeds diferentes — onde o guid não ajuda. */
    dedupeKey: { type: String, default: null, index: true, sparse: true },
    /** Quando preenchido, esta é uma cópia: fica fora do portal e aponta para
     *  a versão ativa. Não apagamos — a duplicata segue auditável no admin. */
    duplicateOf: { type: Schema.Types.ObjectId, ref: "Post", default: null, index: true },
    status: {
      type: String,
      enum: ["draft", "published", "scheduled"],
      default: "draft",
      index: true,
    },
    publishedAt: { type: Date, default: null, index: true },
    featured: {
      active: { type: Boolean, default: false, index: true },
      position: { type: Number, enum: [1, 2, 3, null], default: null },
    },
    crosspost: {
      instagram: { type: Boolean, default: false },
      x: { type: Boolean, default: false },
    },
    views: { type: Number, default: 0 },
    /** SEO do post. `auto` marca o que foi gerado — editar no admin desliga a
     *  geração automática para aquele campo. */
    seo: {
      description: { type: String, default: null },
      keywords: { type: [String], default: [] },
      auto: { type: Boolean, default: true },
      noindex: { type: Boolean, default: false },
    },
    geo: {
      placename: { type: String, default: null },
      region: { type: String, default: null },
      position: { type: String, default: null },
    },
  },
  { timestamps: true },
);

// Busca do portal: título pesa mais que subtítulo, que pesa mais que o corpo.
// `portuguese` liga o stemming (plural, conjugação) e a lista de stopwords.
postSchema.index(
  { title: "text", subtitle: "text", excerpt: "text", tags: "text", body: "text" },
  {
    name: "post_search",
    default_language: "portuguese",
    weights: { title: 10, subtitle: 5, excerpt: 4, tags: 4, body: 1 },
  },
);
postSchema.index({ status: 1, publishedAt: -1 });

export type PostDoc = InferSchemaType<typeof postSchema> & { _id: mongoose.Types.ObjectId };

type PostShape = InferSchemaType<typeof postSchema>;

// O cast mantém os tipos concretos do schema em `.lean()` / `.findById()`.
export const Post: Model<PostShape> =
  (mongoose.models.Post as Model<PostShape>) ??
  mongoose.model<PostShape>("Post", postSchema);
