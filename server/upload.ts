import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bumpOps, loadAccount, loadAccountForOwner } from "./account.js";
import { normalizeClothingImage } from "./clothingTemplate.js";
import { currentOwnerKey } from "./context.js";
import { notifyDiscord } from "./discord.js";
import { listPostableGroups, type GroupAccess } from "./groups.js";
import {
  decodeAccessoryInput,
  inspectAccessoryFile,
  type AccessoryTypeName,
} from "./ugcAccessory.js";
import { assembleUgcFromParts, buildAccessoryRbxmx } from "./ugcAssembler.js";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(rootDir, "data");
const queueDir = path.join(dataDir, "queue");
const queuePath = path.join(dataDir, "uploads.json");
const prefsPath = path.join(dataDir, "upload-prefs.json");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export type ClothingKind = "shirt" | "pants" | "tshirt";
export type UploadKind = ClothingKind | "accessory";
export type JobStatus = "queued" | "uploading" | "live" | "failed" | "moderated";

export interface UploadJob {
  id: string;
  name: string;
  description: string;
  kind: UploadKind;
  accessoryType?: AccessoryTypeName | "Unknown" | null;
  meshId?: string | number | null;
  textureId?: string | number | null;
  meshFilePath?: string | null;
  textureFilePath?: string | null;
  handleX?: number | null;
  handleY?: number | null;
  handleZ?: number | null;
  attachY?: number | null;
  price: number;
  groupId: number | null;
  ownerDiscordId: string | null;
  fileName: string;
  filePath: string;
  mime: string;
  status: JobStatus;
  assetId: number | null;
  catalogUrl: string | null;
  thumbnailUrl: string | null;
  saleWarning: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

const ASSET_TYPE_ID: Record<ClothingKind, number> = {
  shirt: 11,
  pants: 12,
  tshirt: 2,
};

const ASSET_TYPE_NAME: Record<UploadKind, string> = {
  shirt: "Shirt",
  pants: "Pants",
  tshirt: "TShirt",
  accessory: "Model",
};

/** Roblox upload fee for classic 2D clothing (shirt/pants: 10 R$, t-shirt: 0 R$). Model inventory upload is free; marketplace UGC fee is paid in Studio. */
const UPLOAD_FEE: Record<UploadKind, number> = {
  shirt: 10,
  pants: 10,
  tshirt: 0,
  accessory: 0,
};

function isClassicKind(kind: UploadKind): kind is ClothingKind {
  return kind === "shirt" || kind === "pants" || kind === "tshirt";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseActualFee(text: string): number | null {
  const match = text.match(/(?:Actual|expected) price \(?(\d+) Robux\)?/i)
    || text.match(/price.*?(\d+)\s*Robux/i);
  if (!match) return null;
  const fee = Number(match[1]);
  return Number.isFinite(fee) && fee >= 0 ? fee : null;
}

let csrfToken: string | null = null;
let pumping = false;
const thumbnailChecks = new Map<number, number>();
const saleChecks = new Map<number, number>();

function ensureDirs(): void {
  mkdirSync(queueDir, { recursive: true });
}

function loadJobs(): UploadJob[] {
  try {
    const raw = JSON.parse(readFileSync(queuePath, "utf8")) as UploadJob[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveJobs(jobs: UploadJob[]): void {
  ensureDirs();
  writeFileSync(queuePath, JSON.stringify(jobs, null, 2), "utf8");
}

function patchJob(id: string, patch: Partial<UploadJob>): UploadJob | null {
  const jobs = loadJobs();
  const index = jobs.findIndex((job) => job.id === id);
  if (index < 0) return null;
  jobs[index] = { ...jobs[index], ...patch, updatedAt: new Date().toISOString() };
  saveJobs(jobs);
  return jobs[index];
}

function ownerOf(job: UploadJob): string {
  return job.ownerDiscordId || "local";
}

function jobsForCurrentUser(): UploadJob[] {
  const owner = currentOwnerKey();
  return loadJobs().filter((job) => ownerOf(job) === owner);
}

export function queueStats(): {
  pending: number;
  processing: number;
  status: "idle" | "processing";
  note: string;
} {
  const jobs = jobsForCurrentUser();
  const pending = jobs.filter((job) => job.status === "queued").length;
  const processing = jobs.filter((job) => job.status === "uploading").length;
  return {
    pending,
    processing,
    status: processing || pending ? "processing" : "idle",
    note: pending || processing
      ? "Publishing your own shirt / pants / t-shirt files."
      : "Drop a template on Upload — Illusions posts it with your cookie.",
  };
}

export function listJobs(): UploadJob[] {
  const jobs = jobsForCurrentUser().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  void refreshPendingThumbnails(jobs).catch(() => undefined);
  void refreshPendingSales(jobs).catch(() => undefined);
  return jobs;
}

export function getJob(id: string): UploadJob | null {
  return jobsForCurrentUser().find((job) => job.id === id) || null;
}

export async function listUploadGroups(): Promise<GroupAccess[]> {
  const account = loadAccount();
  if (!account) return [];
  return listPostableGroups(account.cookie, account.userId);
}

function loadPrefs(): Record<string, number | null> {
  try {
    const raw = JSON.parse(readFileSync(prefsPath, "utf8")) as
      | Record<string, number | null>
      | { lastGroupId?: number | null };
    if ("lastGroupId" in raw) {
      return { local: raw.lastGroupId ?? null };
    }
    return raw;
  } catch {
    return {};
  }
}

export function lastUploadGroupId(): number | null {
  return loadPrefs()[currentOwnerKey()] ?? null;
}

function saveLastGroup(groupId: number | null): void {
  ensureDirs();
  const prefs = loadPrefs();
  prefs[currentOwnerKey()] = groupId;
  writeFileSync(prefsPath, JSON.stringify(prefs, null, 2), "utf8");
}

export async function enqueueUpload(input: {
  name: string;
  description?: string;
  kind?: string;
  price?: number;
  groupId?: number | null;
  fileName?: string;
  image: string;
}): Promise<UploadJob> {
  if (!loadAccount()) {
    throw new Error("Conecte o cookie da sua conta Roblox em Account primeiro.");
  }
  const fileName = String(input.fileName || "template.png");
  const normalized = await normalizeClothingImage({
    image: String(input.image || ""),
    fileName,
    kind: input.kind,
  });
  let name = String(input.name || "")
    .replace(/#\d+/g, "")
    .replace(/#/g, "")
    .replace(/\bboxers\b/gi, "Shorts")
    .replace(/\bboxer\b/gi, "Shorts")
    .replace(/\bcorset\b/gi, "Top")
    .replace(/\bthong\b/gi, "Shorts")
    .replace(/\bbra\b/gi, "Top")
    .replace(/\blingerie\b/gi, "Outfit")
    .replace(/\bpanties\b/gi, "Shorts")
    .replace(/\bpanty\b/gi, "Shorts")
    .replace(/\bunderwear\b/gi, "Pants")
    .replace(/\bbikini\b/gi, "Swimwear")
    .replace(/\bnaked\b/gi, "Classic")
    .replace(/\bnude\b/gi, "Classic")
    .replace(/\bsexy\b/gi, "Aesthetic")
    .replace(/\s+/g, " ")
    .trim();
  if (name.length < 2) name = normalized.suggestedName || "Classic Roblox Clothing";
  if (name.length > 50) name = name.slice(0, 50).trim();

  let description = String(input.description || "")
    .replace(/#\d+/g, "")
    .replace(/#/g, "")
    .replace(/\bboxers\b/gi, "Shorts")
    .replace(/\bcorset\b/gi, "Top")
    .replace(/\blingerie\b/gi, "Outfit")
    .slice(0, 500)
    .trim();
  if (!description) {
    description = `${name} — classic ${normalized.kind}.`;
  }

  const kind = normalized.kind;
  const priceRaw = Number(input.price);
  const price = kind === "tshirt"
    ? Math.max(0, Math.floor(Number.isFinite(priceRaw) ? priceRaw : 0))
    : Math.max(5, Math.floor(Number.isFinite(priceRaw) && priceRaw > 0 ? priceRaw : 5));
  const groupId = input.groupId && Number.isFinite(input.groupId) ? Number(input.groupId) : null;
  saveLastGroup(groupId);

  // Proteção contra gasto acidental de Robux por envio duplo
  const recentDuplicate = loadJobs().find(
    (j) =>
      (j.status === "queued" || j.status === "uploading" || Date.now() - new Date(j.createdAt).getTime() < 45_000) &&
      j.name.trim().toLowerCase() === name.trim().toLowerCase() &&
      j.kind === kind &&
      j.groupId === groupId
  );
  if (recentDuplicate) {
    throw new Error(
      "Este item já está na fila ou foi enviado recentemente. Bloqueamos o envio duplicado para não gastar Robux atoa."
    );
  }

  ensureDirs();
  const id = `up_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const filePath = path.join(queueDir, `${id}.png`);
  writeFileSync(filePath, normalized.png);
  const job: UploadJob = {
    id,
    name,
    description,
    kind,
    price,
    groupId,
    ownerDiscordId: currentOwnerKey() === "local" ? null : currentOwnerKey(),
    fileName: "template.png",
    filePath,
    mime: "image/png",
    status: "queued",
    assetId: null,
    catalogUrl: null,
    thumbnailUrl: null,
    saleWarning: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveJobs([job, ...loadJobs()]);
  void pumpQueue();
  return job;
}

function sanitizeItemName(raw: string, fallback: string): string {
  let name = String(raw || "")
    .replace(/#/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (name.length < 2) name = fallback;
  if (name.length > 50) name = name.slice(0, 50).trim();
  return name;
}

export async function enqueueAssembledUgc(input: {
  name?: string;
  description?: string;
  groupId?: number | null;
  accessoryType?: string;
  mesh: string;
  meshName?: string;
  texture: string;
  textureName?: string;
  meshId?: string | number | null;
  textureId?: string | number | null;
  price?: number;
}): Promise<UploadJob> {
  if (!loadAccount()) {
    throw new Error("Conecte o cookie da sua conta Roblox em Account primeiro.");
  }
  const assembled = await assembleUgcFromParts({
    mesh: input.mesh,
    meshName: input.meshName,
    texture: input.texture,
    textureName: input.textureName,
    accessoryType: input.accessoryType,
    name: input.name,
  });
  const name = sanitizeItemName(input.name || assembled.suggestedName, assembled.suggestedName);
  let description = String(input.description || "").slice(0, 500).trim();
  if (!description) description = `${name} — UGC Accessory (${assembled.accessoryType}).`;
  const groupId = input.groupId && Number.isFinite(input.groupId) ? Number(input.groupId) : null;
  saveLastGroup(groupId);

  const recentDuplicate = loadJobs().find(
    (j) =>
      (j.status === "queued" || j.status === "uploading" || Date.now() - new Date(j.createdAt).getTime() < 45_000) &&
      j.name.trim().toLowerCase() === name.trim().toLowerCase() &&
      j.kind === "accessory" &&
      j.groupId === groupId
  );
  if (recentDuplicate) {
    throw new Error(
      "Este acessório já está na fila ou foi processado recentemente. Evitamos envio duplicado para sua segurança."
    );
  }

  ensureDirs();
  const id = `ugc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const filePath = path.join(queueDir, `${id}.rbxmx`);
  const meshFilePath = path.join(queueDir, `${id}.mesh`);
  const textureFilePath = path.join(queueDir, `${id}.png`);
  writeFileSync(filePath, assembled.rbxmx, "utf8");
  writeFileSync(meshFilePath, assembled.mesh);
  writeFileSync(textureFilePath, assembled.texture);
  const job: UploadJob = {
    id,
    name,
    description,
    kind: "accessory",
    accessoryType: assembled.accessoryType,
    meshId: input.meshId || null,
    textureId: input.textureId || null,
    meshFilePath,
    textureFilePath,
    handleX: assembled.handle.x,
    handleY: assembled.handle.y,
    handleZ: assembled.handle.z,
    attachY: assembled.attachY,
    price: typeof input.price === "number" && Number.isFinite(input.price) ? Math.max(0, Math.floor(input.price)) : 0,
    groupId,
    ownerDiscordId: currentOwnerKey() === "local" ? null : currentOwnerKey(),
    fileName: `${name.replace(/[^a-zA-Z0-9_-]/g, "_") || "accessory"}.rbxmx`,
    filePath,
    mime: "application/xml",
    status: "queued",
    assetId: null,
    catalogUrl: null,
    thumbnailUrl: null,
    saleWarning: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveJobs([job, ...loadJobs()]);
  void pumpQueue();
  return job;
}

export function enqueueAccessoryUpload(input: {
  name?: string;
  description?: string;
  groupId?: number | null;
  fileName?: string;
  file: string;
  price?: number;
}): UploadJob {
  if (!loadAccount()) {
    throw new Error("Conecte o cookie da sua conta Roblox em Account primeiro.");
  }
  const fileName = String(input.fileName || "accessory.rbxm");
  const bytes = decodeAccessoryInput(input.file);
  const inspected = inspectAccessoryFile(bytes, fileName);
  let name = String(input.name || inspected.suggestedName)
    .replace(/#/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (name.length < 2) name = inspected.suggestedName;
  if (name.length > 50) name = name.slice(0, 50).trim();
  let description = String(input.description || "").slice(0, 500).trim();
  if (!description) {
    description = `${name} — UGC Accessory${inspected.accessoryType !== "Unknown" ? ` (${inspected.accessoryType})` : ""}.`;
  }
  ensureDirs();
  const id = `ugc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const ext = inspected.format === "rbxmx" ? "rbxmx" : "rbxm";
  const filePath = path.join(queueDir, `${id}.${ext}`);
  writeFileSync(filePath, bytes);
  const groupId = input.groupId && Number.isFinite(input.groupId) ? Number(input.groupId) : null;
  saveLastGroup(groupId);
  const job: UploadJob = {
    id,
    name,
    description,
    kind: "accessory",
    accessoryType: inspected.accessoryType,
    price: typeof input.price === "number" && Number.isFinite(input.price) ? Math.max(0, Math.floor(input.price)) : 0,
    groupId,
    ownerDiscordId: currentOwnerKey() === "local" ? null : currentOwnerKey(),
    fileName: `accessory.${ext}`,
    filePath,
    mime: "application/octet-stream",
    status: "queued",
    assetId: null,
    catalogUrl: null,
    thumbnailUrl: null,
    saleWarning: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveJobs([job, ...loadJobs()]);
  void pumpQueue();
  return job;
}

export function removeJob(id: string): void {
  const job = getJob(id);
  if (!job) return;
  const jobs = loadJobs();
  for (const extra of [job.filePath, job.meshFilePath, job.textureFilePath]) {
    if (!extra) continue;
    try {
      unlinkSync(extra);
    } catch {
      // already gone
    }
  }
  saveJobs(jobs.filter((row) => row.id !== id));
}

export function retryJob(id: string): UploadJob {
  if (!getJob(id)) throw new Error("Upload not found.");
  const job = patchJob(id, {
    status: "queued",
    assetId: null,
    catalogUrl: null,
    thumbnailUrl: null,
    saleWarning: null,
    error: null,
  });
  if (!job) throw new Error("Upload not found.");
  void pumpQueue();
  return job;
}

async function robloxSend(
  cookie: string,
  url: string,
  init: RequestInit
): Promise<{ status: number; text: string; json: unknown }> {
  const headers = new Headers(init.headers);
  headers.set("Cookie", `.ROBLOSECURITY=${cookie}`);
  headers.set("User-Agent", UA);
  headers.set("Accept", "application/json, text/plain, */*");
  if (csrfToken) headers.set("x-csrf-token", csrfToken);

  let res = await fetch(url, { ...init, headers });
  const token = res.headers.get("x-csrf-token");
  if (token) csrfToken = token;
  if (res.status === 403 && token) {
    headers.set("x-csrf-token", token);
    res = await fetch(url, { ...init, headers });
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, text, json };
}

function extractRobloxError(text: string, json: unknown): string {
  if (json && typeof json === "object") {
    const obj = json as Record<string, any>;
    if (typeof obj.userFacingMessage === "string" && obj.userFacingMessage.trim()) {
      return obj.userFacingMessage.trim();
    }
    if (typeof obj.message === "string" && obj.message.trim()) {
      return obj.message.trim();
    }
    if (Array.isArray(obj.errors) && obj.errors.length > 0) {
      const first = obj.errors[0];
      if (typeof first?.userFacingMessage === "string" && first.userFacingMessage.trim()) {
        return first.userFacingMessage.trim();
      }
      if (typeof first?.message === "string" && first.message.trim()) {
        return first.message.trim();
      }
    }
    if (typeof obj.error === "string" && obj.error.trim()) {
      return obj.error.trim();
    }
  }
  const clean = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return clean.slice(0, 220);
}

function looksModerated(text: string): boolean {
  return /moderat|inappropriate|not approved|rejected by|filtered/i.test(text);
}

function parseAssetId(payload: { status: number; text: string; json: unknown }): number | null {
  const direct = Number(payload.text.trim());
  if (Number.isFinite(direct) && direct > 0) return direct;
  const json = payload.json as Record<string, unknown> | null;
  if (!json) return null;
  const response = json.response as { assetId?: number; id?: number } | undefined;
  const candidates = [
    json.assetId,
    json.id,
    response?.assetId,
    response?.id,
    String(json.path || "").match(/assets\/(\d{5,})/)?.[1],
  ];
  for (const value of candidates) {
    const id = Number(value);
    if (Number.isFinite(id) && id > 0) return id;
  }
  return null;
}

async function uploadClassic(
  cookie: string,
  job: UploadJob,
  bytes: Buffer
): Promise<number> {
  if (!isClassicKind(job.kind)) {
    throw new Error("Upload clássico só aceita shirt, pants ou t-shirt.");
  }
  const params = new URLSearchParams({
    assetTypeId: String(ASSET_TYPE_ID[job.kind]),
    name: job.name,
    description: job.description || job.name,
    expectedPrice: String(UPLOAD_FEE[job.kind]),
  });
  if (job.groupId) params.set("groupId", String(job.groupId));
  const result = await robloxSend(
    cookie,
    `https://data.roblox.com/Data/Upload.ashx?${params}`,
    {
      method: "POST",
      headers: {
        "Content-Type": job.mime || "application/octet-stream",
        Requester: "Client",
      },
      body: new Blob([Uint8Array.from(bytes)], {
        type: job.mime || "application/octet-stream",
      }),
    }
  );
  const assetId = parseAssetId(result);
  if (assetId) return assetId;
  const errorMsg = extractRobloxError(result.text, result.json);
  if (looksModerated(result.text)) {
    throw Object.assign(
      new Error(`Moderação do Roblox: ${errorMsg || "Nome, descrição ou imagem reprovada pelo filtro do Roblox"}`),
      { moderated: true, raw: result.text }
    );
  }
  throw new Error(errorMsg || `Upload.ashx failed (${result.status}).`);
}

async function waitForAssetOp(cookie: string, opPath: string): Promise<number | null> {
  const path = opPath.replace(/^\//, "");
  const url = path.startsWith("http")
    ? path
    : `https://apis.roblox.com/assets/user-auth/v1/${path}`;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await sleep(1000);
    const result = await robloxSend(cookie, url, { method: "GET" });
    const json = result.json as { done?: boolean; error?: { message?: string } } | null;
    if (json?.error?.message) throw new Error(json.error.message);
    const assetId = parseAssetId(result);
    if (assetId) return assetId;
    if (json?.done) return null;
  }
  return null;
}

async function uploadUserAuth(
  cookie: string,
  job: UploadJob,
  bytes: Buffer,
  userId: number,
  expectedPrice = UPLOAD_FEE[job.kind]
): Promise<number> {
  const creator = job.groupId
    ? { groupId: String(job.groupId) }
    : { userId: String(userId) };
  const form = new FormData();
  form.append(
    "request",
    JSON.stringify({
      assetType: ASSET_TYPE_NAME[job.kind],
      displayName: job.name,
      description: job.description || job.name,
      creationContext:
        expectedPrice > 0 ? { creator, expectedPrice } : { creator },
    })
  );
  form.append(
    "fileContent",
    new Blob([new Uint8Array(bytes)], { type: job.mime }),
    job.fileName
  );
  const result = await robloxSend(cookie, "https://apis.roblox.com/assets/user-auth/v1/assets", {
    method: "POST",
    body: form,
  });
  const actualFee = parseActualFee(result.text);
  if (actualFee != null && actualFee !== expectedPrice) {
    if (actualFee > UPLOAD_FEE[job.kind]) {
      throw new Error(
        `Proteção de Saldo Farol: O Roblox solicitou uma taxa imprevista de ${actualFee} Robux (o padrão oficial é ${UPLOAD_FEE[job.kind]} Robux). Operação cancelada para proteger seu saldo.`
      );
    }
    return uploadUserAuth(cookie, job, bytes, userId, actualFee);
  }
  if (/insufficient|not enough|does not have suffiecient|cannot afford/i.test(result.text)) {
    const target = job.groupId ? "no fundo do Grupo" : "na sua conta Roblox";
    throw new Error(
      `Saldo insuficiente: O Roblox exige taxa de ${expectedPrice} Robux ${target} para enviar este ${job.kind}. Recarregue e tente novamente.`
    );
  }
  const assetId = parseAssetId(result);
  if (assetId) return assetId;
  const opPath = String((result.json as { path?: string } | null)?.path || "");
  if (opPath && /operation/i.test(opPath)) {
    const fromOp = await waitForAssetOp(cookie, opPath);
    if (fromOp) return fromOp;
  }
  const errorMsg = extractRobloxError(result.text, result.json);
  if (looksModerated(result.text)) {
    throw Object.assign(
      new Error(`Moderação do Roblox: ${errorMsg || "Nome, descrição ou imagem reprovada pelo filtro do Roblox"}`),
      { moderated: true, raw: result.text }
    );
  }
  throw new Error(errorMsg || `Asset API failed (${result.status}).`);
}

async function uploadNamedAsset(
  cookie: string,
  userId: number,
  groupId: number | null,
  assetType: "Decal" | "Mesh" | "Model",
  name: string,
  description: string,
  bytes: Buffer,
  fileName: string,
  mime: string
): Promise<number> {
  const creator = groupId ? { groupId: String(groupId) } : { userId: String(userId) };
  const form = new FormData();
  form.append(
    "request",
    JSON.stringify({
      assetType,
      displayName: name,
      description,
      creationContext: { creator },
    })
  );
  form.append("fileContent", new Blob([new Uint8Array(bytes)], { type: mime }), fileName);
  const result = await robloxSend(cookie, "https://apis.roblox.com/assets/user-auth/v1/assets", {
    method: "POST",
    body: form,
  });
  const assetId = parseAssetId(result);
  if (assetId) return assetId;
  const opPath = String((result.json as { path?: string } | null)?.path || "");
  if (opPath && /operation/i.test(opPath)) {
    const fromOp = await waitForAssetOp(cookie, opPath);
    if (fromOp) return fromOp;
  }
  const errorMsg = extractRobloxError(result.text, result.json);
  if (looksModerated(result.text)) {
    throw Object.assign(
      new Error(`Moderação do Roblox: ${errorMsg || "Arquivo reprovado pelo filtro do Roblox"}`),
      { moderated: true, raw: result.text }
    );
  }
  throw new Error(errorMsg || `Falha ao enviar ${assetType} (${result.status}).`);
}

async function uploadMeshAsset(
  cookie: string,
  userId: number,
  groupId: number | null,
  name: string,
  description: string,
  bytes: Buffer
): Promise<number> {
  const params = new URLSearchParams({
    assetTypeId: "4",
    name,
    description: description || name,
  });
  if (groupId) params.set("groupId", String(groupId));
  const result = await robloxSend(
    cookie,
    `https://data.roblox.com/Data/Upload.ashx?${params}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        Requester: "Client",
      },
      body: new Blob([Uint8Array.from(bytes)], {
        type: "application/octet-stream",
      }),
    }
  );
  const assetId = parseAssetId(result);
  if (assetId) return assetId;
  const errorMsg = extractRobloxError(result.text, result.json);
  if (looksModerated(result.text)) {
    throw Object.assign(
      new Error(`Moderação do Roblox no Mesh: ${errorMsg || "Malha reprovada pelo filtro do Roblox"}`),
      { moderated: true, raw: result.text }
    );
  }
  throw new Error(
    errorMsg ||
      "O Roblox restringe envio de malhas raw via API web sem passar pelo Studio. Use o botão de Download no painel para abrir o acessório montado no Roblox Studio e publicar com 1 clique (Save to Roblox → Avatar Asset)."
  );
}

async function resolveImageIdFromDecal(
  cookie: string,
  decalId: string | number
): Promise<string | null> {
  const headers: Record<string, string> = {
    "User-Agent": "Roblox/WinInet",
    "Cookie": `.ROBLOSECURITY=${cookie}`,
    "Accept": "text/xml, application/xml, */*",
  };
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      if (attempt > 1) {
        await sleep(1500);
      }
      const res = await fetch(`https://assetdelivery.roblox.com/v1/asset/?id=${decalId}`, { headers });
      if (!res.ok) continue;
      const text = await res.text();
      const match = text.match(/<url>.*?(?:id=|\/\/)(\d+).*?<\/url>/i) || text.match(/id=(\d+)/i);
      if (match && match[1] && match[1] !== String(decalId)) {
        console.log(`[Upload] Decal ${decalId} resolvido para ID Real da Imagem: ${match[1]}`);
        return match[1];
      }
    } catch (err: any) {
      console.warn(`[Upload] Tentativa ${attempt} de resolução do Image ID a partir do Decal ${decalId}:`, err?.message);
    }
  }
  return null;
}

async function fetchRobux(cookie: string, userId: number): Promise<number | null> {
  try {
    const result = await robloxSend(cookie, `https://economy.roblox.com/v1/users/${userId}/currency`, {
      method: "GET",
    });
    const robux = Number((result.json as { robux?: number } | null)?.robux);
    return Number.isFinite(robux) ? robux : null;
  } catch {
    return null;
  }
}

async function fetchGroupRobux(cookie: string, groupId: number): Promise<number | null> {
  try {
    const result = await robloxSend(cookie, `https://economy.roblox.com/v1/groups/${groupId}/currency`, {
      method: "GET",
    });
    const robux = Number((result.json as { robux?: number } | null)?.robux);
    return Number.isFinite(robux) ? robux : null;
  } catch {
    return null;
  }
}

async function fetchCatalogThumb(assetId: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://thumbnails.roblox.com/v1/assets?assetIds=${assetId}&size=420x420&format=Png&isCircular=false`,
      { headers: { "User-Agent": UA, Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: Array<{ state?: string; imageUrl?: string }>;
    };
    const row = json.data?.[0];
    return row?.imageUrl && String(row.state || "").toLowerCase() === "completed"
      ? row.imageUrl
      : null;
  } catch {
    return null;
  }
}

async function waitForCatalogThumb(assetId: number): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const imageUrl = await fetchCatalogThumb(assetId);
    if (imageUrl) return imageUrl;
    if (attempt < 2) await sleep(1500);
  }
  return null;
}

async function refreshPendingThumbnails(jobs: UploadJob[]): Promise<void> {
  const now = Date.now();
  const pending = jobs
    .filter((job) => job.status === "live" && job.assetId && !job.thumbnailUrl)
    .filter((job) => {
      const last = thumbnailChecks.get(job.assetId!) || 0;
      if (now - last < 30_000) return false;
      thumbnailChecks.set(job.assetId!, now);
      return true;
    })
    .slice(0, 8);

  await Promise.all(
    pending.map(async (job) => {
      const thumbnailUrl = await fetchCatalogThumb(job.assetId!);
      if (thumbnailUrl) patchJob(job.id, { thumbnailUrl });
    })
  );
}

async function putOnSale(cookie: string, assetId: number, price: number): Promise<void> {
  const bodies = [
    {
      url: `https://itemconfiguration.roblox.com/v1/assets/${assetId}/release`,
      json: {
        saleStatus: "OnSale",
        priceConfiguration: { priceInRobux: price },
        quantityLimitPerUser: 0,
      },
    },
    {
      url: "https://itemconfiguration.roblox.com/v1/collectibles",
      json: {
        assetId,
        isLimited: false,
        saleStatus: "OnSale",
        quantityLimitPerUser: 0,
        priceConfiguration: { priceInRobux: price },
      },
    },
  ];
  let lastError = "O Roblox não ativou a venda do item.";
  for (const attempt of bodies) {
    const result = await robloxSend(cookie, attempt.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attempt.json),
    });
    if (result.status >= 200 && result.status < 300) return;
    lastError = extractRobloxError(result.text, result.json) || `HTTP ${result.status}`;
  }
  throw new Error(lastError);
}

async function refreshPendingSales(jobs: UploadJob[]): Promise<void> {
  const now = Date.now();
  const pending = jobs
    .filter((job) => job.status === "live" && job.assetId && job.saleWarning && job.kind !== "accessory")
    .filter((job) => {
      const last = saleChecks.get(job.assetId!) || 0;
      if (now - last < 60_000) return false;
      saleChecks.set(job.assetId!, now);
      return true;
    })
    .slice(0, 4);

  await Promise.all(
    pending.map(async (job) => {
      const account = await loadAccountForOwner(job.ownerDiscordId);
      if (!account) return;
      try {
        await putOnSale(account.cookie, job.assetId!, job.price);
        patchJob(job.id, { saleWarning: null });
      } catch {
        // Moderation can take hours. A later dashboard poll retries automatically.
      }
    })
  );
}

async function processJob(job: UploadJob): Promise<void> {
  const account = await loadAccountForOwner(job.ownerDiscordId);
  if (!account) throw new Error("Conecte o cookie da sua conta Roblox em Account primeiro.");
  if (job.groupId) {
    const allowed = await listPostableGroups(account.cookie, account.userId);
    if (!allowed.some((group) => group.id === job.groupId)) {
      throw new Error("Esse grupo não tem permissão para publicar roupa.");
    }
  }
  patchJob(job.id, { status: "uploading", error: null });
  const fee = UPLOAD_FEE[job.kind];
  if (job.kind === "accessory") {
    let bytes = readFileSync(job.filePath);
    let textureId: string | number | null = null;
    let meshId: string | number | null = null;

    if (job.meshFilePath && job.textureFilePath) {
      // 1. Textura: Prioriza o ID real aprovado do catálogo se fornecido (evita bloqueio de permissão de grupo e moderação)
      if (job.textureId && /^\d+$/.test(String(job.textureId).trim()) && String(job.textureId).trim() !== "0") {
        textureId = String(job.textureId).trim();
        console.log(`[Upload] Usando Texture ID público oficial aprovado: ${textureId}`);
      } else {
        try {
          const uploadedDecalId = await uploadNamedAsset(
            account.cookie,
            account.userId,
            job.groupId,
            "Decal",
            `${job.name} Texture`,
            job.description,
            readFileSync(job.textureFilePath),
            "texture.png",
            "image/png"
          );
          console.log(`[Upload] Decal criado (${uploadedDecalId}). Resolvendo Image Asset ID real...`);
          const resolvedImageId = await resolveImageIdFromDecal(account.cookie, uploadedDecalId);
          if (resolvedImageId) {
            textureId = resolvedImageId;
            console.log(`[Upload] Image Asset ID resolvido com sucesso: ${textureId}`);
          } else {
            textureId = uploadedDecalId;
          }
        } catch (texErr: any) {
          console.warn("[Upload] Warning uploading texture decal to account:", texErr?.message);
        }
      }

      // 2. Malha: usa o ID fornecido (do cloner/catálogo) ou tenta upload via API
      if (job.meshId && /^\d+$/.test(String(job.meshId).trim()) && String(job.meshId).trim() !== "0") {
        meshId = String(job.meshId).trim();
      } else {
        try {
          meshId = await uploadMeshAsset(
            account.cookie,
            account.userId,
            job.groupId,
            `${job.name} Mesh`,
            job.description,
            readFileSync(job.meshFilePath)
          );
        } catch (meshErr: any) {
          console.warn("[Upload] Raw mesh direct upload restricted by Roblox:", meshErr?.message);
        }
      }

      // 3. Monta o .rbxmx oficial Studio-Ready com o Image ID da sua conta e Attachment calibrado
      const rbxmx = buildAccessoryRbxmx({
        name: job.name,
        accessoryType: (job.accessoryType && job.accessoryType !== "Unknown" ? job.accessoryType : "Hat"),
        meshId: meshId || "",
        textureId: textureId || "",
        handle: {
          x: job.handleX || 1,
          y: job.handleY || 1,
          z: job.handleZ || 1,
        },
        attachY: job.attachY || 0.05,
      });
      writeFileSync(job.filePath, rbxmx, "utf8");
      bytes = Buffer.from(rbxmx, "utf8");
    }

    // 4. Salva o Model montado no inventário da conta
    let assetId: number | null = null;
    try {
      assetId = await uploadNamedAsset(
        account.cookie,
        account.userId,
        job.groupId,
        "Model",
        job.name,
        job.description,
        bytes,
        job.fileName,
        "application/octet-stream"
      );
    } catch (modelErr: any) {
      console.warn("[Upload] Model inventory upload notice:", modelErr?.message);
    }

    const thumbnailUrl = assetId ? await waitForCatalogThumb(assetId) : null;
    const saleWarning =
      "Acessório Studio-Ready montado! Textura própria (Image) vinculada à sua conta. Para publicar no Marketplace: abra o .rbxmx no Studio → Salvar na Roblox como Avatar Item.";

    patchJob(job.id, {
      status: "live",
      assetId,
      catalogUrl: assetId ? `https://www.roblox.com/library/${assetId}` : null,
      thumbnailUrl,
      saleWarning,
      error: null,
    });
    await bumpOps({ sessionUploads: 1 }, job.ownerDiscordId);
    void notifyDiscord({
      title: "UGC Accessory pronto",
      body: `${job.name} montado com sucesso.`,
      fields: [
        { name: "Tipo", value: job.accessoryType || "Accessory", inline: true },
        { name: "Asset ID", value: assetId ? String(assetId) : "Download .rbxmx", inline: true },
      ],
      color: 0x3d9e6a,
    });
    return;
  }
  if (fee > 0) {
    const robux = job.groupId
      ? await fetchGroupRobux(account.cookie, job.groupId)
      : await fetchRobux(account.cookie, account.userId);
    if (robux != null && robux < fee) {
      const target = job.groupId ? "no fundo do grupo" : "na sua conta";
      throw new Error(
        `Saldo insuficiente: O Roblox cobra ${fee} Robux ${target} para enviar este ${job.kind}. Recarregue e tente novamente.`
      );
    }
  }
  const bytes = readFileSync(job.filePath);
  let assetId: number | null = null;
  let lastError = "";
  for (const run of [
    () => uploadClassic(account.cookie, job, bytes),
    () => uploadUserAuth(account.cookie, job, bytes, account.userId),
  ]) {
    try {
      assetId = await run();
      break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if ((error as { moderated?: boolean }).moderated) {
        throw error;
      }
    }
  }
  if (!assetId) throw new Error(lastError || "Roblox did not return an asset id.");
  let saleWarning: string | null = null;
  try {
    await putOnSale(account.cookie, assetId, job.price);
  } catch {
    saleWarning = "Publicado, venda não ligada.";
  }
  const thumbnailUrl = await waitForCatalogThumb(assetId);
  patchJob(job.id, {
    status: "live",
    assetId,
    catalogUrl: `https://www.roblox.com/catalog/${assetId}`,
    thumbnailUrl,
    saleWarning,
    error: null,
  });
  await bumpOps({ sessionUploads: 1 }, job.ownerDiscordId);
  void notifyDiscord({
    title: "Shirt posted",
    body: `${job.name} is live on your account.`,
    fields: [
      { name: "Type", value: job.kind, inline: true },
      { name: "Asset", value: String(assetId), inline: true },
      { name: "Price", value: `R$ ${job.price}`, inline: true },
    ],
    color: 0x3d9e6a,
  });
}

export async function pumpQueue(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    while (true) {
      const next = loadJobs().find((job) => job.status === "queued");
      if (!next) break;
      try {
        await processJob(next);
      } catch (error) {
        const moderated = Boolean((error as { moderated?: boolean }).moderated);
        patchJob(next.id, {
          status: moderated ? "moderated" : "failed",
          error: error instanceof Error ? error.message : String(error),
        });
        await bumpOps(moderated ? { moderated: 1 } : { failed: 1 }, next.ownerDiscordId);
        void notifyDiscord({
          title: moderated ? "Upload moderated" : "Upload failed",
          body: next.name,
          fields: [{ name: "Detail", value: error instanceof Error ? error.message : String(error) }],
          color: 0xb45555,
        });
      }
    }
  } finally {
    pumping = false;
  }
}
