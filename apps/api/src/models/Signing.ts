import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** Contratações e saídas confirmadas da temporada. */
const signingSchema = new Schema(
  {
    externalId: { type: String, default: null, index: true, sparse: true },
    playerName: { type: String, required: true },
    /** Nome normalizado (sem acento, minúsculo). É por ele que o cadastro
     *  manual e o registro do Transfermarkt se reconhecem como o mesmo
     *  jogador — os `externalId` dos dois são diferentes por natureza. */
    nameKey: { type: String, default: null, index: true },
    position: { type: String, default: null },
    age: { type: Number, default: null },
    club: { type: String, default: null },
    fee: { type: String, default: null },
    photo: { type: String, default: null },
    /** `in` = chegou ao Vasco, `out` = saiu. */
    direction: { type: String, enum: ["in", "out"], default: "in", index: true },
    season: { type: String, default: null },
    date: { type: Date, default: null, index: true },
    /** Posição na tabela do Transfermarkt. A página não expõe a data da
     *  transferência, mas lista os reforços relevantes primeiro — então a
     *  ordem da fonte é o melhor sinal de recência que temos. */
    order: { type: Number, default: 0, index: true },
  },
  { timestamps: true },
);

type SigningShape = InferSchemaType<typeof signingSchema>;

export const Signing: Model<SigningShape> =
  (mongoose.models.Signing as Model<SigningShape>) ??
  mongoose.model<SigningShape>("Signing", signingSchema);
