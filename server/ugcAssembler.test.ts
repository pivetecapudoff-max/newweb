import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { assembleUgcFromParts, buildAccessoryRbxmx } from "./ugcAssembler.js";

function dataUrl(buffer: Buffer, mime = "image/png"): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

test("assembles a hat Accessory from obj + texture", async () => {
  const obj = Buffer.from(`v -1 0 -1\nv 1 0 -1\nv 1 1 1\nv -1 1 1\nf 1 2 3\nf 1 3 4\n`);
  const png = await sharp({
    create: { width: 32, height: 32, channels: 4, background: "#ff00aa" },
  })
    .png()
    .toBuffer();

  const assembled = await assembleUgcFromParts({
    mesh: dataUrl(obj, "text/plain"),
    meshName: "pink-hat.obj",
    texture: dataUrl(png),
    textureName: "pink.png",
  });

  assert.equal(assembled.accessoryType, "Hat");
  assert.equal(assembled.attachment, "HatAttachment");
  assert.match(assembled.rbxmx, /class="Accessory"/);
  assert.match(assembled.rbxmx, /HatAttachment/);
  assert.ok(assembled.triangleCount >= 2);
  assert.ok(assembled.mesh.toString("utf8").startsWith("version 1.00"));
});

test("writes mesh and texture ids into the Accessory", () => {
  const xml = buildAccessoryRbxmx({
    name: "Hair Test",
    accessoryType: "Hair",
    meshId: 11,
    textureId: 22,
    handle: { x: 1, y: 1, z: 1 },
    attachY: 0.4,
  });
  assert.match(xml, /rbxassetid:\/\/11/);
  assert.match(xml, /rbxassetid:\/\/22/);
  assert.match(xml, /HairAttachment/);
});

test("emits <null></null> instead of rbxassetid://0 for empty or zero ids", () => {
  const xml = buildAccessoryRbxmx({
    name: "Crown Test",
    accessoryType: "Hat",
    meshId: "0",
    textureId: "",
    handle: { x: 1, y: 1, z: 1 },
    attachY: 0.1,
  });
  assert.match(xml, /<Content name="MeshId"><null><\/null><\/Content>/);
  assert.match(xml, /<Content name="TextureId"><null><\/null><\/Content>/);
  assert.doesNotMatch(xml, /rbxassetid:\/\/0/);
});
