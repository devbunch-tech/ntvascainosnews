import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import multer from "multer";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { env } from "./env.js";
import { connectDB } from "./db.js";
import { typeDefs } from "./graphql/typeDefs.js";
import { resolvers } from "./graphql/resolvers/index.js";
import { userFromToken } from "./lib/auth.js";
import type { GraphQLContext } from "./lib/context.js";
import { imageProxyHandler } from "./lib/imageProxy.js";
import { startScheduler } from "./scheduler.js";

await connectDB();

const app = express();

app.use(
  cors({
    origin(origin, cb) {
      // Sem Origin = server-to-server (SSR do Hydrogen, curl) — liberado.
      if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`Origin não permitida: ${origin}`));
    },
    credentials: true,
  }),
);

app.get("/health", (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

// ---- Uploads (avatar, capa, foto de produto) ----
fs.mkdirSync(env.uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: env.uploadsDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB (README §Inscrição)
  fileFilter: (_req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"].includes(file.mimetype);
    if (!ok) return cb(new Error("Envie JPG, PNG ou WEBP de até 2 MB."));
    cb(null, true);
  },
});

app.use("/uploads", express.static(env.uploadsDir, { maxAge: "30d" }));

// Usado pelo card de story do Instagram (canvas precisa de CORS na imagem).
app.get("/image-proxy", imageProxyHandler);

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Arquivo ausente." });
  res.json({ url: `${env.publicApiUrl}/uploads/${req.file.filename}` });
});

app.use((err: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!err) return next();
  res.status(400).json({ error: err.message });
});

// ---- GraphQL ----
const server = new ApolloServer<GraphQLContext>({
  typeDefs,
  resolvers,
  introspection: true,
});
await server.start();

app.use(
  "/graphql",
  express.json({ limit: "2mb" }),
  expressMiddleware(server, {
    context: async ({ req }): Promise<GraphQLContext> => ({
      user: await userFromToken(req.headers.authorization),
      fingerprint: `${req.ip}|${req.headers["user-agent"] ?? ""}`,
      voterId:
        (req.headers["x-voter-id"] as string | undefined) ||
        `ip:${req.ip}|${req.headers["user-agent"] ?? ""}`,
    }),
  }),
);

app.listen(env.port, () => {
  console.log(`[api] GraphQL na porta ${env.port}`);
  console.log(`[api] uploads em ${env.uploadsDir}`);
  // Depois do listen: o health check do Render precisa responder antes de
  // qualquer job começar a disputar CPU.
  startScheduler(env.isProd);
});
