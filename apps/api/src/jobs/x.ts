/** Entrypoint do cron de ingestão do X: `npm run x`. */
import { connectDB, disconnectDB } from "../db.js";
import { ingestAllX } from "./x-ingest.js";

const start = Date.now();
await connectDB();
const { imported, sources } = await ingestAllX();
console.log(`[x] ${imported} post(s) de ${sources} perfil(is) em ${Date.now() - start}ms`);
await disconnectDB();
