import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const commentSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    /** Resposta a outro comentário. A árvore é achatada em um nível:
     *  responder a uma resposta prende no mesmo comentário-raiz. */
    parent: { type: Schema.Types.ObjectId, ref: "Comment", default: null, index: true },
    /** Nome de quem foi respondido — só é gravado quando a resposta aponta para
     *  outra resposta, já que responder à raiz fica óbvio pela indentação. */
    replyingTo: { type: String, default: null },
    body: { type: String, required: true, trim: true, maxlength: 1500 },
    /** `rejected` guarda o que a moderação barrou — o autor vê, o público não. */
    status: {
      type: String,
      enum: ["published", "rejected", "removed"],
      default: "published",
      index: true,
    },
    moderation: {
      category: { type: String, enum: ["profanity", "politics", null], default: null },
      term: { type: String, default: null },
    },
  },
  { timestamps: true },
);

commentSchema.index({ post: 1, parent: 1, createdAt: -1 });

type CommentShape = InferSchemaType<typeof commentSchema>;

export const Comment: Model<CommentShape> =
  (mongoose.models.Comment as Model<CommentShape>) ??
  mongoose.model<CommentShape>("Comment", commentSchema);
