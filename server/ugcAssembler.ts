import sharp from "sharp";
import { convertRobloxMeshToObj } from "./meshConverter.js";
import { nameFromFile } from "./clothingTemplate.js";
import {
  ACCESSORY_TYPES,
  type AccessoryTypeName,
} from "./ugcAccessory.js";

export interface MeshGeometry {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

export interface PreFlightReport {
  triangleCount: number;
  triangleBudget: number;
  trianglePassed: boolean;
  textureWidth: number;
  textureHeight: number;
  texturePassed: boolean;
  boundingBox: { width: number; height: number; depth: number };
  boundsPassed: boolean;
  uvIntegrity: boolean;
  overallPassed: boolean;
  repaired: boolean;
}

export interface AssembledUgc {
  accessoryType: AccessoryTypeName;
  suggestedName: string;
  triangleCount: number;
  scale: number;
  attachment: string;
  mesh: Buffer;
  texture: Buffer;
  rbxmx: string;
  geometry: MeshGeometry;
  textureDataUrl: string;
  handle: { x: number; y: number; z: number };
  attachY: number;
  preFlight: PreFlightReport;
}

const RIGID_TYPES: AccessoryTypeName[] = [
  "Hat",
  "Hair",
  "Face",
  "Neck",
  "Shoulder",
  "Front",
  "Back",
  "Waist",
];

const ATTACHMENT: Record<AccessoryTypeName, string> = {
  Hat: "HatAttachment",
  Hair: "HairAttachment",
  Face: "FaceFrontAttachment",
  Neck: "NeckAttachment",
  Shoulder: "RightCollarAttachment",
  Front: "BodyFrontAttachment",
  Back: "BodyBackAttachment",
  Waist: "WaistBackAttachment",
  Shirt: "BodyFrontAttachment",
  Pants: "WaistBackAttachment",
  Jacket: "BodyFrontAttachment",
  Sweater: "BodyFrontAttachment",
  Shorts: "WaistBackAttachment",
  DressSkirt: "WaistBackAttachment",
  Eyebrow: "FaceFrontAttachment",
  Eyelash: "FaceFrontAttachment",
  TShirt: "BodyFrontAttachment",
  LeftShoe: "LeftFootAttachment",
  RightShoe: "RightFootAttachment",
};

const TARGET_SIZE: Record<string, number> = {
  Hat: 1.45,
  Hair: 2.05,
  Face: 0.95,
  Neck: 1.1,
  Shoulder: 1.2,
  Front: 1.35,
  Back: 1.6,
  Waist: 1.25,
};

function decodeData(input: string, label: string): Buffer {
  const match = input.match(/^data:([^;]+);base64,(.+)$/i);
  const raw = match ? match[2] : String(input || "").replace(/^data:[^;]+;base64,/, "");
  const bytes = Buffer.from(raw, "base64");
  if (bytes.length < 40) throw new Error(`${label} está vazio.`);
  if (bytes.length > 20 * 1024 * 1024) throw new Error(`${label} acima de 20 MB.`);
  return bytes;
}

function typeFromName(fileName: string, fallback: AccessoryTypeName = "Hat"): AccessoryTypeName {
  const n = fileName.toLowerCase();
  if (/\b(hair|cabelo|pelo)\b/.test(n)) return "Hair";
  if (/\b(face|rosto|mask|mascara)\b/.test(n)) return "Face";
  if (/\b(neck|pescoco|colar|chain)\b/.test(n)) return "Neck";
  if (/\b(shoulder|ombro|wing|asa)\b/.test(n)) return "Shoulder";
  if (/\b(back|costas|cape|capa)\b/.test(n)) return "Back";
  if (/\b(front|peito|chest)\b/.test(n)) return "Front";
  if (/\b(waist|cintura|belt)\b/.test(n)) return "Waist";
  if (/\b(hat|bone|cap|beanie|chapeu|chapéu)\b/.test(n)) return "Hat";
  return fallback;
}

function parseObj(text: string): MeshGeometry {
  const positions: number[][] = [];
  const normals: number[][] = [];
  const uvs: number[][] = [];
  const out: MeshGeometry = { positions: [], normals: [], uvs: [], indices: [] };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("v ")) {
      const [, x, y, z] = line.split(/\s+/);
      positions.push([Number(x), Number(y), Number(z)]);
    } else if (line.startsWith("vn ")) {
      const [, x, y, z] = line.split(/\s+/);
      normals.push([Number(x), Number(y), Number(z)]);
    } else if (line.startsWith("vt ")) {
      const [, u, v] = line.split(/\s+/);
      uvs.push([Number(u), Number(v)]);
    } else if (line.startsWith("f ")) {
      const parts = line.slice(2).trim().split(/\s+/);
      const face = parts.map((part) => {
        const [vi, ti, ni] = part.split("/").map((n) => (n ? Number(n) : 0));
        return { vi, ti, ni };
      });
      for (let i = 1; i < face.length - 1; i++) {
        for (const corner of [face[0], face[i], face[i + 1]]) {
          const p = positions[corner.vi - 1];
          if (!p) continue;
          const n = normals[corner.ni - 1] || [0, 1, 0];
          const t = uvs[corner.ti - 1] || [0, 0];
          out.indices.push(out.positions.length / 3);
          out.positions.push(p[0], p[1], p[2]);
          out.normals.push(n[0], n[1], n[2]);
          out.uvs.push(t[0], t[1]);
        }
      }
    }
  }
  if (out.indices.length < 3) throw new Error("O mesh não tem triângulos suficientes.");
  return out;
}

function fitGeometry(geo: MeshGeometry, accessoryType: AccessoryTypeName): { scale: number } {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < geo.positions.length; i += 3) {
    minX = Math.min(minX, geo.positions[i]);
    minY = Math.min(minY, geo.positions[i + 1]);
    minZ = Math.min(minZ, geo.positions[i + 2]);
    maxX = Math.max(maxX, geo.positions[i]);
    maxY = Math.max(maxY, geo.positions[i + 1]);
    maxZ = Math.max(maxZ, geo.positions[i + 2]);
  }
  const spanX = Math.max(0.001, maxX - minX);
  const spanY = Math.max(0.001, maxY - minY);
  const spanZ = Math.max(0.001, maxZ - minZ);
  const longest = Math.max(spanX, spanY, spanZ);
  const scale = (TARGET_SIZE[accessoryType] || 1.4) / longest;
  const midX = (minX + maxX) / 2;
  const midZ = (minZ + maxZ) / 2;
  for (let i = 0; i < geo.positions.length; i += 3) {
    geo.positions[i] = (geo.positions[i] - midX) * scale;
    geo.positions[i + 1] = (geo.positions[i + 1] - minY) * scale;
    geo.positions[i + 2] = (geo.positions[i + 2] - midZ) * scale;
  }
  return { scale };
}

function toRobloxMeshV1(geo: MeshGeometry): Buffer {
  const faces = geo.indices.length / 3;
  const chunks: string[] = [`version 1.00\n${faces}\n`];
  for (let i = 0; i < geo.indices.length; i++) {
    const idx = geo.indices[i];
    const px = geo.positions[idx * 3];
    const py = geo.positions[idx * 3 + 1];
    const pz = geo.positions[idx * 3 + 2];
    const nx = geo.normals[idx * 3] || 0;
    const ny = geo.normals[idx * 3 + 1] || 1;
    const nz = geo.normals[idx * 3 + 2] || 0;
    const u = geo.uvs[idx * 2] || 0;
    const v = 1 - (geo.uvs[idx * 2 + 1] || 0);
    chunks.push(
      `[${px.toFixed(6)},${py.toFixed(6)},${pz.toFixed(6)}][${nx.toFixed(6)},${ny.toFixed(6)},${nz.toFixed(6)}][${u.toFixed(6)},${v.toFixed(6)}]`
    );
  }
  chunks.push("\n");
  return Buffer.from(chunks.join(""), "utf8");
}

function handleSize(geo: MeshGeometry): { x: number; y: number; z: number } {
  let maxX = 0.2, maxY = 0.2, maxZ = 0.2;
  for (let i = 0; i < geo.positions.length; i += 3) {
    maxX = Math.max(maxX, Math.abs(geo.positions[i]) * 2);
    maxY = Math.max(maxY, Math.abs(geo.positions[i + 1]));
    maxZ = Math.max(maxZ, Math.abs(geo.positions[i + 2]) * 2);
  }
  return {
    x: Math.max(0.4, Number(maxX.toFixed(3))),
    y: Math.max(0.4, Number(maxY.toFixed(3))),
    z: Math.max(0.4, Number(maxZ.toFixed(3))),
  };
}

function attachY(geo: MeshGeometry, type: AccessoryTypeName): number {
  let maxY = 0;
  for (let i = 1; i < geo.positions.length; i += 3) maxY = Math.max(maxY, geo.positions[i]);
  if (type === "Hair") return Number((maxY * 0.42).toFixed(3));
  if (type === "Face") return Number((maxY * 0.5).toFixed(3));
  if (type === "Back" || type === "Front") return Number((maxY * 0.55).toFixed(3));
  return 0.05;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildAccessoryRbxmx(input: {
  name: string;
  accessoryType: AccessoryTypeName;
  meshId: number | string;
  textureId: number | string;
  handle: { x: number; y: number; z: number };
  attachY: number;
}): string {
  const attachment = ATTACHMENT[input.accessoryType] || "HatAttachment";
  const meshUrl = `rbxassetid://${input.meshId}`;
  const textureUrl = `rbxassetid://${input.textureId}`;
  return `<?xml version="1.0" encoding="utf-8"?>
<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">
  <Item class="Accessory">
    <Properties>
      <string name="Name">${escapeXml(input.name)}</string>
      <token name="AccessoryType">${input.accessoryType}</token>
    </Properties>
    <Item class="Part">
      <Properties>
        <string name="Name">Handle</string>
        <bool name="Anchored">false</bool>
        <bool name="CanCollide">false</bool>
        <bool name="CastShadow">false</bool>
        <float name="Transparency">0</float>
        <Vector3 name="size">
          <X>${input.handle.x}</X>
          <Y>${input.handle.y}</Y>
          <Z>${input.handle.z}</Z>
        </Vector3>
        <token name="shape">1</token>
      </Properties>
      <Item class="SpecialMesh">
        <Properties>
          <token name="MeshType">5</token>
          <Content name="MeshId"><url>${meshUrl}</url></Content>
          <Content name="TextureId"><url>${textureUrl}</url></Content>
          <Vector3 name="Scale">
            <X>1</X>
            <Y>1</Y>
            <Z>1</Z>
          </Vector3>
        </Properties>
      </Item>
      <Item class="Attachment">
        <Properties>
          <string name="Name">${attachment}</string>
          <Vector3 name="Position">
            <X>0</X>
            <Y>${input.attachY}</Y>
            <Z>0</Z>
          </Vector3>
        </Properties>
      </Item>
    </Item>
  </Item>
</roblox>
`;
}

export function decimateGeometry(geo: MeshGeometry, maxTriangles = 4000): MeshGeometry {
  const currentFaces = geo.indices.length / 3;
  if (currentFaces <= maxTriangles) return geo;

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < geo.positions.length; i += 3) {
    minX = Math.min(minX, geo.positions[i]);
    minY = Math.min(minY, geo.positions[i + 1]);
    minZ = Math.min(minZ, geo.positions[i + 2]);
    maxX = Math.max(maxX, geo.positions[i]);
    maxY = Math.max(maxY, geo.positions[i + 1]);
    maxZ = Math.max(maxZ, geo.positions[i + 2]);
  }
  const sizeX = Math.max(0.0001, maxX - minX);
  const sizeY = Math.max(0.0001, maxY - minY);
  const sizeZ = Math.max(0.0001, maxZ - minZ);

  let low = 8;
  let high = 140;
  let bestOut: MeshGeometry = geo;

  for (let iter = 0; iter < 8; iter++) {
    const grid = Math.floor((low + high) / 2);
    const cellMap = new Map<string, number>();
    const remap = new Int32Array(geo.positions.length / 3);
    const newPositions: number[] = [];
    const newNormals: number[] = [];
    const newUvs: number[] = [];

    const numVerts = geo.positions.length / 3;
    for (let v = 0; v < numVerts; v++) {
      const x = geo.positions[v * 3];
      const y = geo.positions[v * 3 + 1];
      const z = geo.positions[v * 3 + 2];
      const gx = Math.min(grid - 1, Math.floor(((x - minX) / sizeX) * grid));
      const gy = Math.min(grid - 1, Math.floor(((y - minY) / sizeY) * grid));
      const gz = Math.min(grid - 1, Math.floor(((z - minZ) / sizeZ) * grid));
      const key = `${gx}_${gy}_${gz}`;

      let targetIdx = cellMap.get(key);
      if (targetIdx === undefined) {
        targetIdx = newPositions.length / 3;
        cellMap.set(key, targetIdx);
        newPositions.push(x, y, z);
        newNormals.push(geo.normals[v * 3] || 0, geo.normals[v * 3 + 1] || 1, geo.normals[v * 3 + 2] || 0);
        newUvs.push(geo.uvs[v * 2] || 0, geo.uvs[v * 2 + 1] || 0);
      }
      remap[v] = targetIdx;
    }

    const newIndices: number[] = [];
    const numFaces = geo.indices.length / 3;
    for (let f = 0; f < numFaces; f++) {
      const i0 = remap[geo.indices[f * 3]];
      const i1 = remap[geo.indices[f * 3 + 1]];
      const i2 = remap[geo.indices[f * 3 + 2]];
      if (i0 !== i1 && i1 !== i2 && i0 !== i2) {
        newIndices.push(i0, i1, i2);
      }
    }

    const resFaces = newIndices.length / 3;
    if (resFaces <= maxTriangles && resFaces > 0) {
      bestOut = { positions: newPositions, normals: newNormals, uvs: newUvs, indices: newIndices };
      low = grid + 1;
    } else {
      high = grid - 1;
    }
  }

  return bestOut.indices.length >= 3 ? bestOut : geo;
}

export async function assembleUgcFromParts(input: {
  mesh: string;
  meshName?: string;
  texture: string;
  textureName?: string;
  accessoryType?: string;
  name?: string;
  autoRepair?: boolean;
}): Promise<AssembledUgc> {
  const meshName = String(input.meshName || "model.obj");
  if (/\.(fbx|blend|3ds)$/i.test(meshName)) {
    throw new Error("Exporte o mesh como OBJ ou .mesh do Roblox. FBX não é montado neste fluxo.");
  }
  if (/\.(rbxm|rbxmx)$/i.test(meshName)) {
    throw new Error("Esse já é um arquivo do Studio. Use a aba de Accessory pronto, ou envie OBJ/.mesh + PNG.");
  }

  const meshBytes = decodeData(input.mesh, "Mesh");
  const textureBytes = decodeData(input.texture, "Textura");
  let obj = meshBytes.toString("utf8");
  if (!/^\s*v\s+/m.test(obj) || meshBytes.subarray(0, 8).toString("utf8").startsWith("version")) {
    const converted = await convertRobloxMeshToObj(meshBytes);
    if (!converted) throw new Error("Não deu para ler esse mesh. Envie um OBJ ou um .mesh do Roblox.");
    obj = converted;
  }

  const named = ACCESSORY_TYPES.includes(String(input.accessoryType) as AccessoryTypeName)
    ? (input.accessoryType as AccessoryTypeName)
    : typeFromName(`${meshName} ${input.name || ""}`);
  const accessoryType = RIGID_TYPES.includes(named) ? named : "Hat";

  let geometry = parseObj(obj);
  let originalTriangles = geometry.indices.length / 3;
  let repaired = false;

  // Auto-repair decimation if requested and over budget (4000)
  if (input.autoRepair && originalTriangles > 4000) {
    geometry = decimateGeometry(geometry, 4000);
    repaired = true;
  }

  const { scale } = fitGeometry(geometry, accessoryType);
  const triangles = geometry.indices.length / 3;

  // Compute bounding box dimensions (in Roblox studs)
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < geometry.positions.length; i += 3) {
    minX = Math.min(minX, geometry.positions[i]);
    minY = Math.min(minY, geometry.positions[i + 1]);
    minZ = Math.min(minZ, geometry.positions[i + 2]);
    maxX = Math.max(maxX, geometry.positions[i]);
    maxY = Math.max(maxY, geometry.positions[i + 1]);
    maxZ = Math.max(maxZ, geometry.positions[i + 2]);
  }
  const bbox = {
    width: Number(Math.max(0.1, maxX - minX).toFixed(2)),
    height: Number(Math.max(0.1, maxY - minY).toFixed(2)),
    depth: Number(Math.max(0.1, maxZ - minZ).toFixed(2)),
  };

  // Inspect texture metadata
  const texMeta = await sharp(textureBytes).metadata();
  let texW = texMeta.width || 1024;
  let texH = texMeta.height || 1024;
  let textureBuffer = textureBytes;

  if (input.autoRepair && (texW > 1024 || texH > 1024)) {
    textureBuffer = await sharp(textureBytes)
      .resize(1024, 1024, { fit: "inside" })
      .png()
      .toBuffer();
    texW = 1024;
    texH = 1024;
    repaired = true;
  } else {
    textureBuffer = await sharp(textureBytes).png().toBuffer();
  }

  const trianglePassed = triangles <= 4000;
  const texturePassed = texW <= 1024 && texH <= 1024;
  const boundsPassed = bbox.width <= 4.0 && bbox.height <= 4.0 && bbox.depth <= 4.0;
  const uvIntegrity = geometry.uvs.length >= 2;
  const overallPassed = trianglePassed && texturePassed && boundsPassed;

  const preFlight: PreFlightReport = {
    triangleCount: triangles,
    triangleBudget: 4000,
    trianglePassed,
    textureWidth: texW,
    textureHeight: texH,
    texturePassed,
    boundingBox: bbox,
    boundsPassed,
    uvIntegrity,
    overallPassed,
    repaired,
  };

  const mesh = toRobloxMeshV1(geometry);
  const suggestedName = String(input.name || "").trim() || nameFromFile(meshName) || "UGC Accessory";
  const handle = handleSize(geometry);
  const y = attachY(geometry, accessoryType);
  const rbxmx = buildAccessoryRbxmx({
    name: suggestedName,
    accessoryType,
    meshId: "PENDING_MESH",
    textureId: "PENDING_TEXTURE",
    handle,
    attachY: y,
  });

  return {
    accessoryType,
    suggestedName,
    triangleCount: triangles,
    scale,
    attachment: ATTACHMENT[accessoryType],
    mesh,
    texture: textureBuffer,
    rbxmx,
    geometry,
    textureDataUrl: `data:image/png;base64,${textureBuffer.toString("base64")}`,
    handle,
    attachY: y,
    preFlight,
  };
}
