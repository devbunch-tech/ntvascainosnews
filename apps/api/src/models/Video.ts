import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** Vídeos do canal, alimentados pelo feed público do YouTube (sem API key). */
const videoSchema = new Schema(
  {
    videoId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    thumbnail: { type: String, default: null },
    url: { type: String, required: true },
    publishedAt: { type: Date, required: true, index: true },
    channelTitle: { type: String, default: null },
  },
  { timestamps: true },
);

type VideoShape = InferSchemaType<typeof videoSchema>;

export const Video: Model<VideoShape> =
  (mongoose.models.Video as Model<VideoShape>) ??
  mongoose.model<VideoShape>("Video", videoSchema);
