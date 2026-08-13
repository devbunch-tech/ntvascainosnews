/** Entrypoint do cron de ingestão RSS: `npm run rss`.
 *  Em produção (Render/Fly) registrar como Cron Job a cada 10–15 min. */
import { connectDB, disconnectDB } from "../db.js";
import { ingestAll } from "./ingest.js";

const start = Date.now();
await connectDB();
const { imported, sources } = await ingestAll();
console.log(`[rss] ${imported} post(s) de ${sources} fonte(s) em ${Date.now() - start}ms`);
await disconnectDB();
