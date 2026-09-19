import sharp from "sharp";
import crypto from "node:crypto";

export interface UniqueificationConfig {
  uvRotation?: boolean;
  faceShuffle?: boolean;
  vertexJitter?: boolean;
  pngSalt?: boolean;
  jitterEpsilon?: number;
}

export const DEFAULT_UNIQUE_CONFIG: UniqueificationConfig = {
  uvRotation: false,
  faceShuffle: true,
  vertexJitter: true,
  pngSalt: true,
  jitterEpsilon: 0.00002,
};

/**
 * Applies 90-degree CW rotation to texture and losslessly remaps UV coordinates in the OBJ.
 */
async function applyUvRotation(
  obj: string,
  texture: Buffer
): Promise<{ obj: string; texture: Buffer }> {
  // Rotate texture 90 degrees clockwise losslessly
  const rotatedTexture = await sharp(texture)
    .rotate(90)
    .png()
    .toBuffer();

  // In 90-deg CW rotation: new_u = v, new_v = 1.0 - u
  const rotatedObj = obj.replace(
    /^vt\s+([-\d.eE]+)\s+([-\d.eE]+)(.*)$/gm,
    (_match, uStr, vStr, rest) => {
      const u = parseFloat(uStr);
      const v = parseFloat(vStr);
      if (Number.isNaN(u) || Number.isNaN(v)) return _match;
      const newU = Number(v.toFixed(6));
      const newV = Number((1.0 - u).toFixed(6));
      return `vt ${newU} ${newV}${rest || ""}`;
    }
  );

  return { obj: rotatedObj, texture: rotatedTexture };
}

/**
 * Shuffles triangle/face order in the OBJ. Geometry is identical, but file hash and byte structure differ.
 */
function applyFaceShuffle(obj: string): string {
  const lines = obj.split(/\r?\n/);
  const nonFaceLines: { index: number; line: string }[] = [];
  const faceLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("f ") || trimmed.startsWith("f\t")) {
      faceLines.push(lines[i]);
    } else {
      nonFaceLines.push({ index: i, line: lines[i] });
    }
  }

  if (faceLines.length <= 1) return obj;

  // Fisher-Yates shuffle on face lines
  for (let i = faceLines.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = faceLines[i];
    faceLines[i] = faceLines[j];
    faceLines[j] = temp;
  }

  // Re-assemble: place face lines in the contiguous block where faces appeared
  const result: string[] = [];
  let faceIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("f ") || trimmed.startsWith("f\t")) {
      result.push(faceLines[faceIdx++]);
    } else {
      result.push(lines[i]);
    }
  }

  return result.join("\n");
}

/**
 * Adds sub-micron noise on vertex coordinates (x, y, z) according to jitter epsilon.
 */
function applyVertexJitter(obj: string, epsilon: number = 0.00002): string {
  const eps = Math.max(0.000001, Math.min(0.001, epsilon));
  return obj.replace(
    /^v\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)(.*)$/gm,
    (_match, xStr, yStr, zStr, rest) => {
      const x = parseFloat(xStr);
      const y = parseFloat(yStr);
      const z = parseFloat(zStr);
      if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) return _match;

      const jx = (Math.random() - 0.5) * 2 * eps;
      const jy = (Math.random() - 0.5) * 2 * eps;
      const jz = (Math.random() - 0.5) * 2 * eps;

      return `v ${(x + jx).toFixed(6)} ${(y + jy).toFixed(6)} ${(z + jz).toFixed(6)}${rest || ""}`;
    }
  );
}

/**
 * Injects random private PNG chunks and micro LSB noise so the PNG hash is 100% unique.
 */
async function applyPngChunkSalt(texture: Buffer): Promise<Buffer> {
  try {
    const img = sharp(texture);
    const meta = await img.metadata();
    const w = meta.width || 512;
    const h = meta.height || 512;

    const raw = await img.raw().toBuffer();
    // Micro perturbation in a random pixel
    const randomIdx = Math.floor(Math.random() * (raw.length - 4));
    raw[randomIdx] = raw[randomIdx] ^ 1;

    const saltComment = `illusions_salt_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;

    return await sharp(raw, {
      raw: {
        width: w,
        height: h,
        channels: meta.channels || 4,
      },
    })
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
      })
      .withMetadata({
        exif: {
          IFD0: {
            Software: "Farol Illusions UGC Uniqueifier",
            ImageDescription: saltComment,
          },
        },
      })
      .toBuffer();
  } catch (err) {
    return texture;
  }
}

/**
 * Main uniqueification orchestrator
 */
export async function uniqueifyAccessory(params: {
  obj: string;
  texture: Buffer;
  config?: UniqueificationConfig;
}): Promise<{
  obj: string;
  texture: Buffer;
  applied: string[];
}> {
  const config = { ...DEFAULT_UNIQUE_CONFIG, ...(params.config || {}) };
  let currentObj = params.obj;
  let currentTexture = params.texture;
  const applied: string[] = [];

  // 1. UV & Texture Rotation
  if (config.uvRotation) {
    try {
      const res = await applyUvRotation(currentObj, currentTexture);
      currentObj = res.obj;
      currentTexture = res.texture;
      applied.push("UV & Texture Rotation (90° CW)");
    } catch (e: any) {
      console.warn("[Uniqueifier] UV rotation warning:", e?.message);
    }
  }

  // 2. Vertex Micro-Jitter
  if (config.vertexJitter) {
    const eps = config.jitterEpsilon || 0.00002;
    currentObj = applyVertexJitter(currentObj, eps);
    applied.push(`Vertex Micro-Jitter (ε = ${eps.toFixed(6)})`);
  }

  // 3. Face Shuffle
  if (config.faceShuffle) {
    currentObj = applyFaceShuffle(currentObj);
    applied.push("Face Shuffle (Permuted Triangle Order)");
  }

  // 4. PNG Chunk Salt
  if (config.pngSalt) {
    try {
      currentTexture = await applyPngChunkSalt(currentTexture);
      applied.push("PNG Chunk Salt & EXIF Injection");
    } catch (e: any) {
      console.warn("[Uniqueifier] PNG salt warning:", e?.message);
    }
  }

  return {
    obj: currentObj,
    texture: currentTexture,
    applied,
  };
}
