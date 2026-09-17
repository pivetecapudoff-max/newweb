import sharp, { type Metadata } from "sharp";

export type ClothingKind = "shirt" | "pants" | "tshirt";

export interface TemplateRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const TEMPLATE_W = 585;
export const TEMPLATE_H = 559;

export const SHIRT_ISLANDS: TemplateRect[] = [
  { x: 231, y: 8, w: 128, h: 64 },
  { x: 231, y: 74, w: 128, h: 128 },
  { x: 165, y: 74, w: 64, h: 128 },
  { x: 361, y: 74, w: 64, h: 128 },
  { x: 427, y: 74, w: 128, h: 128 },
  { x: 231, y: 204, w: 128, h: 64 },
  { x: 217, y: 289, w: 64, h: 64 },
  { x: 308, y: 289, w: 64, h: 64 },
  { x: 19, y: 355, w: 64, h: 52 },
  { x: 85, y: 355, w: 64, h: 52 },
  { x: 151, y: 355, w: 64, h: 52 },
  { x: 217, y: 355, w: 64, h: 52 },
  { x: 308, y: 355, w: 64, h: 52 },
  { x: 374, y: 355, w: 64, h: 52 },
  { x: 440, y: 355, w: 64, h: 52 },
  { x: 506, y: 355, w: 64, h: 52 },
];

export const PANTS_ISLANDS: TemplateRect[] = [
  { x: 231, y: 74, w: 128, h: 56 },
  { x: 165, y: 74, w: 64, h: 56 },
  { x: 361, y: 74, w: 64, h: 56 },
  { x: 427, y: 74, w: 128, h: 56 },
  { x: 217, y: 289, w: 64, h: 64 },
  { x: 308, y: 289, w: 64, h: 64 },
  { x: 19, y: 355, w: 64, h: 128 },
  { x: 85, y: 355, w: 64, h: 128 },
  { x: 151, y: 355, w: 64, h: 128 },
  { x: 217, y: 355, w: 64, h: 128 },
  { x: 308, y: 355, w: 64, h: 128 },
  { x: 374, y: 355, w: 64, h: 128 },
  { x: 440, y: 355, w: 64, h: 128 },
  { x: 506, y: 355, w: 64, h: 128 },
  { x: 217, y: 485, w: 64, h: 64 },
  { x: 308, y: 485, w: 64, h: 64 },
];

const BLOCKED_EXT = /\.(rbxm|rbxmx|rbxl|rbxlx|fbx|obj|mesh|3ds|blend)$/i;
const ALLOWED_IMAGE_EXT = /\.(png|jpe?g)$/i;

export function assertPublishableFile(fileName: string): void {
  const name = String(fileName || "");
  if (BLOCKED_EXT.test(name)) {
    throw new Error(
      "Arquivo 3D (.rbxm/.rbxmx/mesh) não publica sozinho. Este fluxo é roupa clássica 2D (PNG/JPEG). Acessório 3D precisa do Studio: Save to Roblox → Avatar Asset."
    );
  }
  if (name.includes(".") && !ALLOWED_IMAGE_EXT.test(name)) {
    throw new Error("Use um arquivo PNG ou JPEG da sua textura ou do template 585×559.");
  }
}

export function nameFromFile(fileName: string): string {
  return String(fileName || "Classic Roblox Clothing")
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
}

function kindFromName(fileName: string): ClothingKind | null {
  const n = fileName.toLowerCase();
  if (/\b(t[\s-]?shirts?|tees?|estampas?)\b/.test(n)) return "tshirt";
  if (/\b(pants?|calcas?|calças?|shorts?|skirts?|saias?)\b/.test(n)) return "pants";
  if (/\b(shirts?|camisas?|hoodies?|moletons?)\b/.test(n)) return "shirt";
  return null;
}

function decodeImageInput(image: string): Buffer {
  const match = image.match(/^data:(image\/(?:png|jpeg|jpg));base64,(.+)$/i);
  if (image.startsWith("data:") && !match) {
    throw new Error("Use um arquivo PNG ou JPEG da sua textura ou do template 585×559.");
  }
  const raw = match ? match[2] : image.replace(/^data:[^;]+;base64,/, "");
  const bytes = Buffer.from(raw, "base64");
  if (bytes.length < 80) throw new Error("Imagem vazia.");
  if (bytes.length > 12 * 1024 * 1024) throw new Error("Imagem acima de 12 MB.");
  return bytes;
}

async function opaqueRatio(buf: Buffer, rect: TemplateRect): Promise<number> {
  const { data, info } = await sharp(buf)
    .extract({
      left: rect.x,
      top: rect.y,
      width: rect.w,
      height: rect.h,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let opaque = 0;
  for (let i = 3; i < data.length; i += info.channels) {
    if (data[i] > 24) opaque += 1;
  }
  return opaque / (rect.w * rect.h);
}

function isTemplateSize(w: number, h: number): boolean {
  const r = w / h;
  const target = TEMPLATE_W / TEMPLATE_H;
  return Math.abs(r - target) < 0.03 && w >= 400 && h >= 380;
}

async function detectKind(
  templateSized: Buffer,
  fileName: string,
  named: ClothingKind | null
): Promise<{ kind: ClothingKind; alreadyTemplate: boolean }> {
  const fromName = kindFromName(fileName);
  const torso = await opaqueRatio(templateSized, { x: 231, y: 74, w: 128, h: 128 });
  const sleeve = await opaqueRatio(templateSized, { x: 217, y: 289, w: 64, h: 64 });
  const leg = await opaqueRatio(templateSized, { x: 217, y: 355, w: 64, h: 128 });
  const corner = await opaqueRatio(templateSized, { x: 0, y: 0, w: 24, h: 24 });
  const alreadyTemplate = corner < 0.2 && (torso > 0.12 || leg > 0.12 || sleeve > 0.12);
  const shapeKind: ClothingKind = leg > 0.35 && torso < 0.65 ? "pants" : "shirt";
  const templateKind = fromName && fromName !== "tshirt" ? fromName : shapeKind;

  if (named) {
    return {
      kind: named,
      alreadyTemplate: named !== "tshirt" && alreadyTemplate && templateKind === named,
    };
  }

  if (fromName === "tshirt") return { kind: "tshirt", alreadyTemplate: false };
  if (alreadyTemplate) {
    if (fromName) return { kind: fromName, alreadyTemplate: true };
    return { kind: shapeKind, alreadyTemplate: true };
  }
  if (fromName) return { kind: fromName, alreadyTemplate: false };
  return { kind: "shirt", alreadyTemplate: false };
}

async function coverIsland(src: Buffer, rect: TemplateRect): Promise<Buffer> {
  return sharp(src)
    .resize(rect.w, rect.h, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
}

async function paintIslands(src: Buffer, islands: TemplateRect[]): Promise<Buffer> {
  const composites = await Promise.all(
    islands.map(async (rect) => ({
      input: await coverIsland(src, rect),
      left: rect.x,
      top: rect.y,
    }))
  );
  return sharp({
    create: {
      width: TEMPLATE_W,
      height: TEMPLATE_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

async function punchNeckHole(png: Buffer): Promise<Buffer> {
  const hole = await sharp({
    create: {
      width: TEMPLATE_W,
      height: TEMPLATE_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="${TEMPLATE_W}" height="${TEMPLATE_H}">
            <ellipse cx="295" cy="40" rx="28" ry="22" fill="white"/>
            <ellipse cx="295" cy="78" rx="22" ry="8" fill="white"/>
          </svg>`
        ),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  return sharp(png)
    .composite([{ input: hole, blend: "dest-out" }])
    .png()
    .toBuffer();
}

async function normalizeTshirtArtwork(bytes: Buffer): Promise<Buffer> {
  return sharp(bytes)
    .resize(512, 512, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

export interface NormalizeResult {
  kind: ClothingKind;
  png: Buffer;
  alreadyTemplate: boolean;
  suggestedName: string;
  suggestedPrice: number;
  dataUrl: string;
}

export async function normalizeClothingImage(input: {
  image: string;
  fileName?: string;
  kind?: string;
}): Promise<NormalizeResult> {
  const fileName = String(input.fileName || "template.png");
  assertPublishableFile(fileName);
  const bytes = decodeImageInput(String(input.image || ""));
  let meta: Metadata;
  try {
    meta = await sharp(bytes).metadata();
  } catch {
    throw new Error("Use um PNG ou JPEG da sua textura ou do template 585×559.");
  }
  const w = meta.width || 0;
  const h = meta.height || 0;
  if (w < 32 || h < 32) throw new Error("Imagem pequena demais para virar um template.");

  const named = ["shirt", "pants", "tshirt"].includes(String(input.kind))
    ? (input.kind as ClothingKind)
    : null;

  if (named === "tshirt" || (!named && kindFromName(fileName) === "tshirt")) {
    const png = await normalizeTshirtArtwork(bytes);
    const suggestedName = nameFromFile(fileName) || "Classic T-Shirt";
    return {
      kind: "tshirt",
      png,
      alreadyTemplate: false,
      suggestedName,
      suggestedPrice: 0,
      dataUrl: `data:image/png;base64,${png.toString("base64")}`,
    };
  }

  const templateSized = await sharp(bytes)
    .resize(TEMPLATE_W, TEMPLATE_H, { fit: "fill" })
    .png()
    .toBuffer();

  const detected = await detectKind(
    templateSized,
    fileName,
    named
  );

  if (detected.kind === "tshirt") {
    const png = await normalizeTshirtArtwork(bytes);
    return {
      kind: "tshirt",
      png,
      alreadyTemplate: false,
      suggestedName: nameFromFile(fileName) || "Classic T-Shirt",
      suggestedPrice: 0,
      dataUrl: `data:image/png;base64,${png.toString("base64")}`,
    };
  }

  let png: Buffer;
  if (detected.alreadyTemplate && isTemplateSize(w, h)) {
    png = templateSized;
  } else {
    png = await paintIslands(bytes, detected.kind === "pants" ? PANTS_ISLANDS : SHIRT_ISLANDS);
    if (detected.kind === "shirt") png = await punchNeckHole(png);
  }

  const front = await opaqueRatio(
    png,
    detected.kind === "pants" ? { x: 217, y: 355, w: 64, h: 128 } : { x: 231, y: 74, w: 128, h: 128 }
  );
  if (front < 0.04) throw new Error("A imagem não preencheu as ilhas do template. Envie uma textura ou o molde 585×559.");

  const suggestedName = nameFromFile(fileName) || "Classic Roblox Clothing";
  return {
    kind: detected.kind,
    png,
    alreadyTemplate: detected.alreadyTemplate,
    suggestedName,
    suggestedPrice: 5,
    dataUrl: `data:image/png;base64,${png.toString("base64")}`,
  };
}
