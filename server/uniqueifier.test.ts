import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { uniqueifyAccessory } from "./uniqueifier.js";

test("uniqueifyAccessory applies UV rotation, jitter, face shuffle, and PNG salt", async () => {
  const sampleObj = `v 0.0 1.0 0.0\nv 1.0 0.0 0.0\nv -1.0 0.0 0.0\nv 0.0 0.0 1.0\nvt 0.2 0.8\nvt 0.5 0.5\nvt 0.9 0.1\nvn 0 1 0\nf 1/1/1 2/2/1 3/3/1\nf 1/1/1 3/3/1 4/3/1\nf 1/1/1 4/3/1 2/2/1\n`;

  const samplePng = await sharp({
    create: { width: 64, height: 64, channels: 4, background: "#00ffaa" },
  })
    .png()
    .toBuffer();

  const result = await uniqueifyAccessory({
    obj: sampleObj,
    texture: samplePng,
    config: {
      uvRotation: true,
      faceShuffle: true,
      vertexJitter: true,
      pngSalt: true,
      jitterEpsilon: 0.00002,
    },
  });

  assert.ok(result.obj !== sampleObj, "OBJ should be transformed");
  assert.ok(result.texture !== samplePng, "Texture buffer should be transformed");
  assert.equal(result.applied.length, 4, "All 4 transformations should be applied");

  // Check that face count remains the same
  const origFaces = sampleObj.split("\n").filter((l) => l.startsWith("f "));
  const newFaces = result.obj.split("\n").filter((l) => l.startsWith("f "));
  assert.equal(newFaces.length, origFaces.length, "Face count must match");

  // Check UV rotation formula: (0.2, 0.8) -> u'=0.8, v'=1.0-0.2=0.8
  assert.match(result.obj, /vt 0\.8 0\.8/);
});
