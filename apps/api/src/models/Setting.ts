import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** Documento único (singleton) — sempre lido/gravado com key: "site". */
const settingSchema = new Schema(
  {
    key: { type: String, default: "site", unique: true },
    siteName: { type: String, default: "NTV News" },
    logoUrl: { type: String, default: "/assets/logo.svg" },
    url: { type: String, default: "https://ntvascainosnews.com.br" },
    maintenance: { type: Boolean, default: false },
    /** Ícone da aba e dos favoritos. Enviado em Configurações → Geral. */
    faviconUrl: { type: String, default: null },
    seo: {
      title: { type: String, default: "NTV News — Notícias do Vasco da Gama" },
      description: {
        type: String,
        default: "O portal do torcedor vascaíno. Notícias, mercado da bola, tabela e Loja NTV.",
      },
      ogImage: { type: String, default: null },
      keywords: { type: [String], default: [] },
      /** Verificação do Search Console (a meta google-site-verification). */
      googleVerification: { type: String, default: null },
      /** @id da organização no JSON-LD; alimenta o Knowledge Panel. */
      organizationName: { type: String, default: "NTV News" },
      foundingDate: { type: String, default: null },
    },
    /** Redes do rodapé. `url` é o link do ícone; `connected`/`handle` seguem
     *  servindo à duplicação automática de posts. */
    socialAccounts: {
      instagram: {
        connected: { type: Boolean, default: false },
        handle: { type: String, default: null },
        url: { type: String, default: "https://instagram.com/ntvnews" },
      },
      x: {
        connected: { type: Boolean, default: false },
        handle: { type: String, default: null },
        url: { type: String, default: "https://x.com/ntvnews" },
      },
      youtube: {
        connected: { type: Boolean, default: false },
        handle: { type: String, default: null },
        url: { type: String, default: "https://www.youtube.com/@natorcidavascaino" },
      },
      facebook: {
        connected: { type: Boolean, default: false },
        handle: { type: String, default: null },
        url: { type: String, default: "" },
      },
      tiktok: {
        connected: { type: Boolean, default: false },
        handle: { type: String, default: null },
        url: { type: String, default: "" },
      },
    },
    /** Ordem e visibilidade dos widgets da sidebar, configuradas no admin.
     *  A posição no array é a ordem; chave desconhecida é descartada na
     *  leitura por `resolveSidebarWidgets`. Vazio = usa o padrão do código. */
    sidebar: {
      widgets: {
        type: [
          {
            _id: false,
            key: { type: String, required: true },
            visible: { type: Boolean, default: true },
          },
        ],
        default: [],
      },
      /** Quantas campanhas a sidebar exibe. */
      adLimit: { type: Number, default: 2 },
    },
    /** Origem dos jogos exibidos na sidebar. */
    matches: {
      transfermarktUrl: {
        type: String,
        default: "https://www.transfermarkt.com.br/vasco-da-gama/spielplan/verein/978",
      },
      lastSyncAt: { type: Date, default: null },
      lastError: { type: String, default: null },
      lastCount: { type: Number, default: 0 },
      season: { type: String, default: null },
    },
    /** Estado da leitura de boatos, transferências e classificação. */
    market: {
      lastSyncAt: { type: Date, default: null },
      lastError: { type: String, default: null },
    },
    /** Canal lido pelo widget "No YouTube". O channelId é resolvido a partir da
     *  URL na primeira sincronização e fica cacheado aqui. */
    youtube: {
      channelUrl: { type: String, default: "https://www.youtube.com/@natorcidavascaino" },
      channelId: { type: String, default: null },
      channelTitle: { type: String, default: null },
      lastSyncAt: { type: Date, default: null },
      lastError: { type: String, default: null },
    },
  },
  { timestamps: true },
);

export type SettingDoc = InferSchemaType<typeof settingSchema> & {
  _id: mongoose.Types.ObjectId;
};

type SettingShape = InferSchemaType<typeof settingSchema>;

export const Setting: Model<SettingShape> =
  (mongoose.models.Setting as Model<SettingShape>) ??
  mongoose.model<SettingShape>("Setting", settingSchema);

export async function getSettings() {
  const existing = await Setting.findOne({ key: "site" });
  if (existing) return existing;
  return Setting.create({ key: "site" });
}
