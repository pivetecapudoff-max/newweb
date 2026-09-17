import { nameFromFile } from "./clothingTemplate.js";

export const ACCESSORY_TYPES = [
  "Hat",
  "Hair",
  "Face",
  "Neck",
  "Shoulder",
  "Front",
  "Back",
  "Waist",
  "Shirt",
  "Pants",
  "Jacket",
  "Sweater",
  "Shorts",
  "DressSkirt",
  "Eyebrow",
  "Eyelash",
  "TShirt",
  "LeftShoe",
  "RightShoe",
] as const;

export type AccessoryTypeName = (typeof ACCESSORY_TYPES)[number];

export interface AccessoryInspect {
  format: "rbxm" | "rbxmx";
  accessoryType: AccessoryTypeName | "Unknown";
  suggestedName: string;
}

const ACCESSORY_FILE = /\.(rbxm|rbxmx)$/i;
const MESH_ONLY = /\.(obj|fbx|mesh|3ds|blend)$/i;

export function assertAccessoryFileName(fileName: string): void {
  const name = String(fileName || "");
  if (MESH_ONLY.test(name)) {
    throw new Error(
      "OBJ/FBX/mesh sozinho não vira UGC no catálogo. Monte o Accessory no Studio (Accessory Fitting Tool) e envie o .rbxm/.rbxmx."
    );
  }
  if (!ACCESSORY_FILE.test(name)) {
    throw new Error("UGC 3D precisa do seu Accessory em .rbxm ou .rbxmx, já montado no Studio.");
  }
}

export function decodeAccessoryInput(file: string): Buffer {
  const match = file.match(/^data:([^;]+);base64,(.+)$/i);
  const raw = match ? match[2] : String(file || "").replace(/^data:[^;]+;base64,/, "");
  const bytes = Buffer.from(raw, "base64");
  if (bytes.length < 40) throw new Error("Arquivo do Accessory está vazio.");
  if (bytes.length > 20 * 1024 * 1024) throw new Error("Arquivo acima de 20 MB.");
  return bytes;
}

function looksXml(bytes: Buffer): boolean {
  const head = bytes.subarray(0, 160).toString("utf8").replace(/^\uFEFF/, "").trimStart();
  return head.startsWith("<roblox") || head.startsWith("<?xml");
}

function typeFromText(text: string): AccessoryTypeName | "Unknown" {
  const xml = text.match(/<token\s+name="AccessoryType">\s*([A-Za-z]+)\s*<\/token>/i);
  if (xml && ACCESSORY_TYPES.includes(xml[1] as AccessoryTypeName)) {
    return xml[1] as AccessoryTypeName;
  }
  for (const type of ACCESSORY_TYPES) {
    if (text.includes(type)) return type;
  }
  return "Unknown";
}

export function inspectAccessoryFile(bytes: Buffer, fileName: string): AccessoryInspect {
  assertAccessoryFileName(fileName);
  const format = looksXml(bytes) || /\.rbxmx$/i.test(fileName) ? "rbxmx" : "rbxm";
  const text = bytes.toString("latin1");
  if (!/Accessory/i.test(text)) {
    throw new Error(
      "Esse arquivo não é um Accessory. No Studio, converta o Model com o Accessory Fitting Tool e exporte o .rbxm."
    );
  }
  return {
    format,
    accessoryType: typeFromText(text),
    suggestedName: nameFromFile(fileName) || "UGC Accessory",
  };
}

export function inspectAccessoryInput(input: { file: string; fileName?: string }): AccessoryInspect {
  const fileName = String(input.fileName || "accessory.rbxm");
  return inspectAccessoryFile(decodeAccessoryInput(input.file), fileName);
}
