import dns from "node:dns/promises";
import net from "node:net";
import type { Request, Response } from "express";

/**
 * Proxy de imagem — existe para o card de story do Instagram poder ser gerado
 * em canvas: o CDN do ge.globo não manda `access-control-allow-origin`, então
 * desenhar a foto direto contamina o canvas e impede o download.
 *
 * É um proxy restrito de propósito: só GET, só http(s), só resposta de imagem,
 * com bloqueio de IP privado (SSRF) e teto de tamanho.
 */

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

/** Loopback, link-local, privados e reservados — o que não pode ser alvo. */
function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  const lower = address.toLowerCase();
  return (
    lower === "::1" ||
    lower === "::" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe80") ||
    lower.startsWith("::ffff:")
  );
}

async function assertPublicHost(hostname: string): Promise<void> {
  const records = await dns.lookup(hostname, { all: true });
  if (!records.length) throw new Error("Host não resolvido.");
  if (records.some((record) => isPrivateAddress(record.address))) {
    throw new Error("Endereço de rede interna bloqueado.");
  }
}

export async function imageProxyHandler(req: Request, res: Response) {
  const raw = String(req.query.url ?? "");
  if (!raw) return res.status(400).json({ error: "Parâmetro url é obrigatório." });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return res.status(400).json({ error: "URL inválida." });
  }
  if (!/^https?:$/.test(target.protocol)) {
    return res.status(400).json({ error: "Só http e https são aceitos." });
  }

  try {
    await assertPublicHost(target.hostname);

    const upstream = await fetch(target, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
      headers: { "user-agent": "NTVNewsBot/1.0 (+https://ntvnews.com.br)", accept: "image/*" },
    });
    if (!upstream.ok) return res.status(502).json({ error: `Origem respondeu ${upstream.status}.` });

    const type = (upstream.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!ALLOWED_TYPES.includes(type)) {
      return res.status(415).json({ error: "A URL não devolveu uma imagem." });
    }

    const declared = Number(upstream.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) return res.status(413).json({ error: "Imagem grande demais." });

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) {
      return res.status(413).json({ error: "Imagem grande demais." });
    }

    res.setHeader("content-type", type);
    res.setHeader("cache-control", "public, max-age=86400");
    // É o cabeçalho que faltava na origem — é a razão de este proxy existir.
    res.setHeader("access-control-allow-origin", "*");
    return res.send(buffer);
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : "Falha ao buscar a imagem.",
    });
  }
}
