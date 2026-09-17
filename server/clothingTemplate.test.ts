import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  normalizeClothingImage,
  SHIRT_ISLANDS,
  TEMPLATE_H,
  TEMPLATE_W,
} from "./clothingTemplate.js";

function dataUrl(buffer: Buffer): string {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

async function solid(width: number, height: number, color = "#ff3366"): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: color,
    },
  })
    .png()
    .toBuffer();
}

async function alphaAt(buffer: Buffer, left: number, top: number): Promise<number> {
  const { data } = await sharp(buffer)
    .extract({ left, top, width: 1, height: 1 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data[3];
}

test("maps an arbitrary texture only onto official shirt islands", async () => {
  const result = await normalizeClothingImage({
    image: dataUrl(await solid(640, 640)),
    fileName: "pink-shirt.png",
  });
  const metadata = await sharp(result.png).metadata();

  assert.equal(result.kind, "shirt");
  assert.equal(metadata.width, TEMPLATE_W);
  assert.equal(metadata.height, TEMPLATE_H);
  assert.equal(await alphaAt(result.png, 2, 2), 0);
  assert.equal(await alphaAt(result.png, 250, 120), 255);
  assert.equal(await alphaAt(result.png, 295, 40), 0);
});

test("detects pants from the filename and paints leg islands", async () => {
  const result = await normalizeClothingImage({
    image: dataUrl(await solid(768, 512, "#2255cc")),
    fileName: "blue-pants.png",
  });

  assert.equal(result.kind, "pants");
  assert.equal(await alphaAt(result.png, 30, 400), 255);
  assert.equal(await alphaAt(result.png, 2, 2), 0);
});

test("keeps classic T-shirt artwork square", async () => {
  const result = await normalizeClothingImage({
    image: dataUrl(await solid(900, 600, "#33aa55")),
    fileName: "logo-tshirt.png",
  });
  const metadata = await sharp(result.png).metadata();

  assert.equal(result.kind, "tshirt");
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 512);
  assert.equal(result.suggestedPrice, 0);
});

test("recognizes and preserves an existing 2x template layout", async () => {
  const islandInputs = await Promise.all(
    SHIRT_ISLANDS.map(async (rect) => ({
      input: await solid(rect.w, rect.h, "#111111"),
      left: rect.x,
      top: rect.y,
    }))
  );
  const template = await sharp({
    create: {
      width: TEMPLATE_W,
      height: TEMPLATE_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(islandInputs)
    .resize(TEMPLATE_W * 2, TEMPLATE_H * 2, { kernel: "nearest" })
    .png()
    .toBuffer();

  const result = await normalizeClothingImage({
    image: dataUrl(template),
    fileName: "existing-template.png",
  });

  assert.equal(result.kind, "shirt");
  assert.equal(result.alreadyTemplate, true);
  assert.equal((await sharp(result.png).metadata()).width, TEMPLATE_W);
});

test("rejects 3D files with the Studio guidance", async () => {
  await assert.rejects(
    () =>
      normalizeClothingImage({
        image: "ignored",
        fileName: "accessory.rbxm",
      }),
    /Save to Roblox/
  );
});
