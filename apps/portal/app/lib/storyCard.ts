/**
 * Gera o card 1080×1920 que o usuário posta no story do Instagram.
 *
 * O Instagram não aceita compartilhar link de terceiro por URL — o fluxo real
 * é publicar uma imagem e colar o link no sticker. Este módulo produz essa imagem.
 */

const WIDTH = 1080;
const HEIGHT = 1920;
const PADDING = 72;

const INK = "#101014";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    image.src = src;
  });
}

/** Desenha cobrindo a área (equivalente a object-fit: cover). */
function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export interface StoryCardInput {
  title: string;
  category: string;
  credit?: string | null;
  imageUrl?: string | null;
  /** Base da API — a foto passa pelo /image-proxy para o canvas não ser contaminado. */
  apiUrl: string;
  siteLabel?: string;
}

export async function buildStoryCard(input: StoryCardInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");

  // A fonte precisa estar carregada antes de medir/desenhar o texto.
  if (document.fonts?.ready) {
    try {
      await document.fonts.load("800 64px Archivo");
      await document.fonts.ready;
    } catch {
      /* segue com a fonte de fallback */
    }
  }

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Foto ocupa a metade de cima.
  const photoHeight = 1180;
  if (input.imageUrl) {
    try {
      const proxied = `${input.apiUrl}/image-proxy?url=${encodeURIComponent(input.imageUrl)}`;
      drawCover(ctx, await loadImage(proxied), 0, 0, WIDTH, photoHeight);
    } catch {
      /* sem foto: o card sai só com a tipografia sobre preto */
    }
  }

  // Degradê para a manchete ter contraste sobre qualquer foto.
  const gradient = ctx.createLinearGradient(0, photoHeight - 620, 0, photoHeight);
  gradient.addColorStop(0, "rgba(16,16,20,0)");
  gradient.addColorStop(1, INK);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, photoHeight - 620, WIDTH, 620);

  let cursorY = photoHeight + 40;

  // Badge da categoria.
  ctx.font = '800 30px Archivo, sans-serif';
  const label = input.category.toUpperCase();
  const labelWidth = ctx.measureText(label).width;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(PADDING, cursorY - 46, labelWidth + 40, 62);
  ctx.fillStyle = INK;
  ctx.fillText(label, PADDING + 20, cursorY - 4);
  cursorY += 78;

  // Manchete.
  ctx.fillStyle = "#ffffff";
  ctx.font = '800 76px Archivo, sans-serif';
  const lines = wrapText(ctx, input.title, WIDTH - PADDING * 2).slice(0, 6);
  for (const line of lines) {
    ctx.fillText(line, PADDING, cursorY);
    cursorY += 90;
  }

  if (input.credit) {
    ctx.fillStyle = "#8a8a92";
    ctx.font = '500 30px Archivo, sans-serif';
    ctx.fillText(input.credit, PADDING, cursorY + 16);
  }

  // Rodapé com a marca.
  try {
    const logo = await loadImage("/assets/logo.svg");
    const logoHeight = 64;
    const logoWidth = (logo.width / logo.height) * logoHeight;
    ctx.save();
    ctx.filter = "invert(1)"; // o SVG tem paths pretos; no fundo escuro vai em branco
    ctx.drawImage(logo, PADDING, HEIGHT - 150, logoWidth, logoHeight);
    ctx.restore();
  } catch {
    ctx.fillStyle = "#ffffff";
    ctx.font = '900 54px Archivo, sans-serif';
    ctx.fillText("NTV NEWS", PADDING, HEIGHT - 100);
  }

  ctx.fillStyle = "#8a8a92";
  ctx.font = '700 28px Archivo, sans-serif';
  ctx.textAlign = "right";
  ctx.fillText(input.siteLabel ?? "ntvnews.com.br", WIDTH - PADDING, HEIGHT - 104);
  ctx.textAlign = "left";

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível gerar a imagem."))),
      "image/png",
    );
  });
}
