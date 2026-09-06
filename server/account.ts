import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudConfigured, fetchCloudAccount, upsertCloudAccount } from "./cloud.js";
import {
  currentDiscord,
  getAuthStore,
  type StoredAccount,
  type StoredOps,
} from "./context.js";
import { isHosted } from "./host.js";

export type { StoredAccount, StoredOps };

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(rootDir, "data");
const accountPath = path.join(dataDir, "account.json");

const EMPTY_OPS: StoredOps = {
  sessionUploads: 0,
  failed: 0,
  moderated: 0,
};

export function sanitizeCookie(raw: string): string {
  let value = String(raw || "").trim();
  value = value.replace(/^["']+|["']+$/g, "").trim();
  value = value.replace(/^Cookie:\s*/i, "");
  const embedded = value.match(/\.ROBLOSECURITY\s*=\s*([^;]+)/i);
  if (embedded) value = embedded[1];
  value = value.replace(/^\.ROBLOSECURITY\s*=\s*/i, "").trim();
  value = value.replace(/^["']+|["';]+$/g, "").trim();
  return value;
}

export function cookieFromBody(body: unknown): string {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const packed = String(raw.session || "");
  if (packed) {
    try {
      return sanitizeCookie(Buffer.from(packed, "base64").toString("utf8"));
    } catch {
      return "";
    }
  }
  return sanitizeCookie(String(raw.cookie || ""));
}

export function loadLocalAccount(): StoredAccount | null {
  try {
    const raw = JSON.parse(readFileSync(accountPath, "utf8")) as StoredAccount;
    if (!raw?.cookie || !raw.userId) return null;
    return {
      ...raw,
      ops: { ...EMPTY_OPS, ...(raw.ops || {}) },
    };
  } catch {
    return null;
  }
}

function saveLocalAccount(account: StoredAccount): void {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(accountPath, JSON.stringify(account, null, 2), "utf8");
}

function clearLocalAccount(): void {
  try {
    unlinkSync(accountPath);
  } catch {
    // already gone
  }
}

export function loadAccount(): StoredAccount | null {
  const store = getAuthStore();
  if (store) return store.account;
  return loadLocalAccount();
}

export async function loadAccountForOwner(ownerDiscordId?: string | null): Promise<StoredAccount | null> {
  if (ownerDiscordId && cloudConfigured()) {
    return fetchCloudAccount(ownerDiscordId);
  }
  if (cloudConfigured()) return null;
  return loadLocalAccount();
}

export async function saveAccount(account: StoredAccount): Promise<void> {
  const store = getAuthStore();
  if (store) store.account = account;
  const discord = store?.discord || currentDiscord();
  if (discord && cloudConfigured()) {
    await upsertCloudAccount(discord, account);
    return;
  }
  saveLocalAccount(account);
}

export async function clearAccount(): Promise<void> {
  const store = getAuthStore();
  const discord = store?.discord || currentDiscord();
  if (store) store.account = null;
  if (discord && cloudConfigured()) {
    await upsertCloudAccount(discord, null);
    return;
  }
  clearLocalAccount();
}

export function publicAccount() {
  const account = loadAccount();
  const discord = currentDiscord();
  if (!account) {
    return {
      connected: false,
      userId: null,
      username: null,
      displayName: null,
      connectedAt: null,
      ops: { ...EMPTY_OPS },
      discordEnabled: true,
      discord,
      hosted: isHosted(),
    };
  }
  return {
    connected: true,
    userId: account.userId,
    username: account.username,
    displayName: account.displayName,
    connectedAt: account.connectedAt,
    ops: account.ops,
    discordEnabled: true,
    discord,
    hosted: isHosted(),
  };
}

export function cookieOf(): string | null {
  return loadAccount()?.cookie || null;
}

export async function bumpOps(
  delta: Partial<StoredOps>,
  ownerDiscordId?: string | null
): Promise<StoredOps> {
  const account =
    (ownerDiscordId ? await loadAccountForOwner(ownerDiscordId) : loadAccount()) ||
    loadAccount();
  if (!account) return { ...EMPTY_OPS };
  account.ops = {
    sessionUploads: account.ops.sessionUploads + (delta.sessionUploads || 0),
    failed: account.ops.failed + (delta.failed || 0),
    moderated: account.ops.moderated + (delta.moderated || 0),
  };
  const store = getAuthStore();
  if (store?.account && (!ownerDiscordId || store.discord?.id === ownerDiscordId)) {
    store.account = account;
  }
  if (ownerDiscordId && cloudConfigured()) {
    await upsertCloudAccount(
      { id: ownerDiscordId, name: account.username, avatar: null },
      account
    );
    return account.ops;
  }
  await saveAccount(account);
  return account.ops;
}
