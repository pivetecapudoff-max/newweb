import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bumpOps, loadAccount, loadAccountForOwner } from "./account.js";
import { currentOwnerKey } from "./context.js";
import { notifyDiscord } from "./discord.js";
import { listPostableGroups, type GroupAccess } from "./groups.js";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(rootDir, "data");
const queueDir = path.join(dataDir, "queue");
const queuePath = path.join(dataDir, "uploads.json");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export type ClothingKind = "shirt" | "pants" | "tshirt";
export type JobStatus = "queued" | "uploading" | "live" | "failed" | "moderated";

export interface UploadJob {
  id: string;
  name: string;
  description: string;
  kind: ClothingKind;
  price: number;
  groupId: number | null;
  ownerDiscordId: string | null;
  fileName: string;
  filePath: string;
  mime: string;
  status: JobStatus;
  assetId: number | null;
  catalogUrl: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

const ASSET_TYPE_ID: Record<ClothingKind, number> = {
  shirt: 11,
  pants: 12,
  tshirt: 2,
};

const ASSET_TYPE_NAME: Record<ClothingKind, string> = {
  shirt: "Shirt",
  pants: "Pants",
  tshirt: "TShirt",
};

/** Roblox upload fee for classic 2D clothing (shirt/pants: 10 R$, t-shirt: 0 R$). */
const UPLOAD_FEE: Record<ClothingKind, number> = {
  shirt: 10,
  pants: 10,
  tshirt: 0,
};

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
  return jobsForCurrentUser().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getJob(id: string): UploadJob | null {
  return jobsForCurrentUser().find((job) => job.id === id) || null;
}

export async function listUploadGroups(): Promise<GroupAccess[]> {
  const account = loadAccount();
  if (!account) return [];
  return listPostableGroups(account.cookie, account.userId);
}

function decodeImage(dataUrl: string): { bytes: Buffer; mime: string; ext: string } {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg));base64,(.+)$/i);
  const raw = match ? match[2] : dataUrl.replace(/^data:[^;]+;base64,/, "");
  const mime = match ? match[1].toLowerCase() : "image/png";
  if (mime !== "image/png" && mime !== "image/jpeg" && mime !== "image/jpg") {
    throw new Error("Use a PNG or JPEG clothing template.");
  }
  const bytes = Buffer.from(raw, "base64");
  if (bytes.length < 80) throw new Error("Image is empty.");
  if (bytes.length > 12 * 1024 * 1024) throw new Error("Image is over 12 MB.");
  return {
    bytes,
    mime: mime === "image/jpg" ? "image/jpeg" : mime,
    ext: mime.includes("png") ? "png" : "jpg",
  };
}

export function enqueueUpload(input: {
  name: string;
  description?: string;
  kind?: string;
  price?: number;
  groupId?: number | null;
  fileName?: string;
  image: string;
}): UploadJob {
  if (!loadAccount()) {
    throw new Error("Connect your own Roblox cookie on Account first.");
  }
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
  if (name.length < 2) name = "Classic Roblox Clothing";
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
    description = `${name} - High quality classic clothing piece on Roblox. Created with Farol Studio.`;
  }

  const kind = (["shirt", "pants", "tshirt"].includes(String(input.kind))
    ? input.kind
    : "shirt") as ClothingKind;
  const price = Math.max(0, Math.floor(Number(input.price) || 0));
  const image = decodeImage(String(input.image || ""));
  ensureDirs();
  const id = `up_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const filePath = path.join(queueDir, `${id}.${image.ext}`);
  writeFileSync(filePath, image.bytes);
  const job: UploadJob = {
    id,
    name,
    description,
    kind,
    price: kind === "tshirt" ? price : Math.max(price, 5),
    groupId: input.groupId && Number.isFinite(input.groupId) ? Number(input.groupId) : null,
    ownerDiscordId: currentOwnerKey() === "local" ? null : currentOwnerKey(),
    fileName: String(input.fileName || `template.${image.ext}`),
    filePath,
    mime: image.mime,
    status: "queued",
    assetId: null,
    catalogUrl: null,
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
  if (job.filePath) {
    try {
      unlinkSync(job.filePath);
    } catch {
      // already gone
    }
  }
  saveJobs(jobs.filter((row) => row.id !== id));
}

export function retryJob(id: string): UploadJob {
  if (!getJob(id)) throw new Error("Upload not found.");
  const job = patchJob(id, { status: "queued", error: null });
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
      body: bytes,
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
      creationContext: { creator, expectedPrice },
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
  for (const attempt of bodies) {
    const result = await robloxSend(cookie, attempt.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attempt.json),
    });
    if (result.status >= 200 && result.status < 300) return;
  }
}

async function processJob(job: UploadJob): Promise<void> {
  const account = await loadAccountForOwner(job.ownerDiscordId);
  if (!account) throw new Error("Connect your own Roblox cookie on Account first.");
  if (job.groupId) {
    const allowed = await listPostableGroups(account.cookie, account.userId);
    if (!allowed.some((group) => group.id === job.groupId)) {
      throw new Error("That group is not one you can post clothing to.");
    }
  }
  patchJob(job.id, { status: "uploading", error: null });
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
  try {
    await putOnSale(account.cookie, assetId, job.price);
  } catch {
    // uploaded even if sale toggle fails
  }
  patchJob(job.id, {
    status: "live",
    assetId,
    catalogUrl: `https://www.roblox.com/catalog/${assetId}`,
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
