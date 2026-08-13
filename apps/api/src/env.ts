import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Carrega também o .env da raiz do monorepo (fonte única em dev).
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../.env") });

export const env = {
  mongoUri: process.env.MONGODB_URI ?? "mongodb://localhost:27017/ntv_news",
  port: Number(process.env.API_PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-nao-usar-em-producao",
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173,http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  uploadsDir: path.resolve(here, "..", process.env.UPLOADS_DIR ?? "./uploads"),
  publicApiUrl: process.env.PUBLIC_API_URL ?? "http://localhost:4000",
  /** Token gratuito da football-data.org. Sem ele, os jogos são só os do admin. */
  footballDataToken: process.env.FOOTBALL_DATA_TOKEN ?? "",
  isProd: process.env.NODE_ENV === "production",
};
