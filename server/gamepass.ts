import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAccount } from "./account.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.resolve(rootDir, "data");
const jobsPath = path.resolve(dataDir, "gamepass_jobs.json");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

let csrfToken: string | null = null;
let isProcessingQueue = false;

export interface GamepassItemInfo {
  id: string;
  name: string;
  description: string;
  price: number;
  userBasePrice?: number;
  productId: number;
  sellerId: number;
  isForSale: boolean;
  hasRegionalPrice: boolean;
  thumbnailUrl: string | null;
  url: string;
}

export interface GamepassAutomationJob {
  id: string;
  createdAt: string;
  updatedAt: string;
  account: {
    id: number;
    name: string;
    displayName: string;
    avatarUrl: string | null;
  };
  payRegional: boolean;
  delayBetweenSeconds: number;
  status: "queued" | "processing" | "completed" | "failed" | "partial";
  totalPasses: number;
  completedPasses: number;
  passes: {
    id: string;
    url: string;
    name: string;
    price: number;
    productId?: number;
    sellerId?: number;
    thumbnailUrl?: string;
    status: "pending" | "processing" | "success" | "failed" | "skipped_regional";
    error?: string;
    purchasedAt?: string;
  }[];
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDataDir() {
  mkdirSync(dataDir, { recursive: true });
}

export function loadGamepassJobs(): GamepassAutomationJob[] {
  try {
    const raw = JSON.parse(readFileSync(jobsPath, "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveGamepassJobs(jobs: GamepassAutomationJob[]) {
  ensureDataDir();
  writeFileSync(jobsPath, JSON.stringify(jobs, null, 2), "utf8");
}

export function extractGamepassId(input: string): string | null {
  const trimmed = input.trim();
  const matchUrl = trimmed.match(/\/game-pass\/(\d+)/i);
  if (matchUrl) return matchUrl[1];
  const matchDigits = trimmed.match(/^\d{4,}/);
  if (matchDigits) return matchDigits[0];
  const matchAnyDigits = trimmed.match(/(\d{5,})/);
  if (matchAnyDigits) return matchAnyDigits[1];
  return null;
}

export async function fetchGamePassInfo(idOrUrl: string): Promise<GamepassItemInfo> {
  const id = extractGamepassId(idOrUrl);
  if (!id) {
    throw new Error(`Não foi possível identificar o ID do gamepass em: "${idOrUrl}"`);
  }

  const url = `https://apis.roblox.com/game-passes/v1/game-passes/${id}/product-info`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
  });

  if (!res.ok) {
    throw new Error(`Gamepass ${id} não encontrado ou removido (HTTP ${res.status}).`);
  }

  const data: any = await res.json();
  const name = data.Name || `GamePass_${id}`;
  const price = typeof data.PriceInRobux === "number" ? data.PriceInRobux : 0;
  const userBasePrice = typeof data.UserBasePriceInRobux === "number" ? data.UserBasePriceInRobux : price;
  const productId = Number(data.ProductId) || 0;
  const sellerId = Number(data.Creator?.CreatorTargetId || data.Creator?.Id) || 1;
  const isForSale = Boolean(data.IsForSale);
  const hasRegionalPrice = Array.isArray(data.PriceDiscountDetails) && data.PriceDiscountDetails.length > 0;

  // Fetch thumbnail
  let thumbnailUrl: string | null = null;
  try {
    const thumbRes = await fetch(
      `https://thumbnails.roblox.com/v1/game-passes?gamePassIds=${id}&size=150x150&format=Png`,
      { headers: { Accept: "application/json", "User-Agent": UA } }
    );
    if (thumbRes.ok) {
      const thumbData: any = await thumbRes.json();
      thumbnailUrl = thumbData.data?.[0]?.imageUrl || null;
    }
  } catch {
    // ignore
  }

  return {
    id,
    name,
    description: data.Description || "",
    price,
    userBasePrice,
    productId,
    sellerId,
    isForSale,
    hasRegionalPrice,
    thumbnailUrl,
    url: `https://www.roblox.com/game-pass/${id}`,
  };
}

export async function fetchGamepassAccount() {
  const account = await loadAccount();
  if (!account?.cookie) {
    throw new Error("Nenhuma conta Roblox cadastrada. Conecte sua conta em Configurações/Conta.");
  }

  let robux = 0;
  try {
    const currRes = await fetch(
      `https://economy.roblox.com/v1/users/${account.userId}/currency`,
      {
        headers: {
          Cookie: `.ROBLOSECURITY=${account.cookie}`,
          Accept: "application/json",
          "User-Agent": UA,
        },
      }
    );
    if (currRes.ok) {
      const currData: any = await currRes.json();
      robux = Number(currData.robux) || 0;
    }
  } catch {
    // ignore
  }

  let avatarUrl: string | null = null;
  try {
    const avRes = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${account.userId}&size=150x150&format=Png&isCircular=true`,
      { headers: { Accept: "application/json", "User-Agent": UA } }
    );
    if (avRes.ok) {
      const avData: any = await avRes.json();
      avatarUrl = avData.data?.[0]?.imageUrl || null;
    }
  } catch {
    // ignore
  }

  return {
    id: account.userId,
    name: account.username || `User_${account.userId}`,
    displayName: account.displayName || account.username || `User_${account.userId}`,
    robux,
    avatarUrl,
  };
}

export async function purchaseProduct(
  productId: number,
  expectedPrice: number,
  expectedSellerId: number,
  cookie: string
): Promise<{ success: boolean; error?: string }> {
  const url = `https://economy.roblox.com/v1/purchases/products/${productId}`;
  const body = JSON.stringify({
    expectedCurrency: 1,
    expectedPrice,
    expectedSellerId,
  });

  const send = async (token?: string | null) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": UA,
      Cookie: `.ROBLOSECURITY=${cookie}`,
    };
    if (token) headers["x-csrf-token"] = token;

    const res = await fetch(url, { method: "POST", headers, body });
    const newToken = res.headers.get("x-csrf-token");
    if (newToken) csrfToken = newToken;
    return { res, newToken };
  };

  let { res, newToken } = await send(csrfToken);
  if (res.status === 403 && newToken) {
    const retry = await send(newToken);
    res = retry.res;
  }

  const json: any = await res.json().catch(() => null);

  if (res.ok && json?.purchased === true) {
    return { success: true };
  }

  const reason = json?.errorMsg || json?.reason || json?.title || "Falha desconhecida na compra.";
  return { success: false, error: reason };
}

export async function createGamepassJob(input: {
  links: string[];
  payRegional: boolean;
  delayBetweenSeconds: number;
}): Promise<GamepassAutomationJob> {
  const accountInfo = await fetchGamepassAccount();
  const rawLinks = input.links.map((l) => l.trim()).filter(Boolean);

  if (rawLinks.length === 0) {
    throw new Error("Insira ao menos um link ou ID de gamepass.");
  }

  // Pre-fetch all gamepasses to validate
  const passes: GamepassAutomationJob["passes"] = [];
  for (const item of rawLinks) {
    try {
      const info = await fetchGamePassInfo(item);
      passes.push({
        id: info.id,
        url: info.url,
        name: info.name,
        price: info.price,
        productId: info.productId,
        sellerId: info.sellerId,
        thumbnailUrl: info.thumbnailUrl || undefined,
        status: "pending",
      });
    } catch (err: any) {
      const fallbackId = extractGamepassId(item) || item;
      passes.push({
        id: fallbackId,
        url: item.startsWith("http") ? item : `https://www.roblox.com/game-pass/${fallbackId}`,
        name: `Gamepass ${fallbackId}`,
        price: 0,
        status: "failed",
        error: err?.message || "Não foi possível carregar os dados deste gamepass.",
      });
    }
  }

  const job: GamepassAutomationJob = {
    id: `gp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    account: {
      id: accountInfo.id,
      name: accountInfo.name,
      displayName: accountInfo.displayName,
      avatarUrl: accountInfo.avatarUrl,
    },
    payRegional: Boolean(input.payRegional),
    delayBetweenSeconds: Math.max(0, Number(input.delayBetweenSeconds) || 0),
    status: "queued",
    totalPasses: passes.length,
    completedPasses: 0,
    passes,
  };

  const jobs = loadGamepassJobs();
  saveGamepassJobs([job, ...jobs]);

  // Trigger queue processing asynchronously
  void processGamepassQueue();

  return job;
}

export async function deleteGamepassJob(jobId: string) {
  const jobs = loadGamepassJobs();
  const filtered = jobs.filter((j) => j.id !== jobId);
  saveGamepassJobs(filtered);
}

export async function processGamepassQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    while (true) {
      const jobs = loadGamepassJobs();
      const currentJob = jobs.find((j) => j.status === "queued" || j.status === "processing");
      if (!currentJob) break;

      currentJob.status = "processing";
      currentJob.updatedAt = new Date().toISOString();
      saveGamepassJobs(jobs);

      const account = await loadAccount();
      if (!account?.cookie) {
        currentJob.status = "failed";
        currentJob.error = "Conta desconectada durante a automação.";
        saveGamepassJobs(jobs);
        break;
      }

      for (let i = 0; i < currentJob.passes.length; i++) {
        const p = currentJob.passes[i];
        if (p.status === "success" || p.status === "skipped_regional") continue;

        p.status = "processing";
        currentJob.updatedAt = new Date().toISOString();
        saveGamepassJobs(jobs);

        if (!p.productId || !p.sellerId) {
          try {
            const fresh = await fetchGamePassInfo(p.id);
            p.productId = fresh.productId;
            p.sellerId = fresh.sellerId;
            p.price = fresh.price;
            p.name = fresh.name;
            p.thumbnailUrl = fresh.thumbnailUrl || p.thumbnailUrl;
          } catch (e: any) {
            p.status = "failed";
            p.error = e?.message || "Erro ao consultar gamepass.";
            saveGamepassJobs(jobs);
            continue;
          }
        }

        const buyRes = await purchaseProduct(
          p.productId,
          p.price,
          p.sellerId,
          account.cookie
        );

        if (buyRes.success) {
          p.status = "success";
          p.purchasedAt = new Date().toISOString();
          p.error = undefined;
          currentJob.completedPasses += 1;
        } else {
          p.status = "failed";
          p.error = buyRes.error;
        }

        currentJob.updatedAt = new Date().toISOString();
        saveGamepassJobs(jobs);

        // Apply delay between passes if configured
        if (currentJob.delayBetweenSeconds > 0 && i < currentJob.passes.length - 1) {
          await sleep(currentJob.delayBetweenSeconds * 1000);
        }
      }

      // Determine final status
      const hasFailures = currentJob.passes.some((p) => p.status === "failed");
      const hasSuccess = currentJob.passes.some((p) => p.status === "success");

      if (hasSuccess && !hasFailures) {
        currentJob.status = "completed";
      } else if (hasSuccess && hasFailures) {
        currentJob.status = "partial";
      } else {
        currentJob.status = "failed";
      }

      currentJob.updatedAt = new Date().toISOString();
      saveGamepassJobs(jobs);
    }
  } finally {
    isProcessingQueue = false;
  }
}
