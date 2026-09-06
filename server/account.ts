import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
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
const accountsDir = path.join(dataDir, "accounts");

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

function userAccountPath(discordId: string): string {
  const safeId = String(discordId).replace(/[^0-9a-zA-Z_-]/g, "");
  return path.join(accountsDir, `${safeId}.json`);
}

export function loadAccountForDiscordUser(discordId?: string | null): StoredAccount | null {
  if (!discordId) return null;
  try {
    const file = userAccountPath(discordId);
    if (!existsSync(file)) return null;
    const raw = JSON.parse(readFileSync(file, "utf8")) as StoredAccount;
    if (!raw?.cookie || !raw.userId) return null;
    return {
      ...raw,
      ops: { ...EMPTY_OPS, ...(raw.ops || {}) },
    };
  } catch {
    return null;
  }
}

export function saveAccountForDiscordUser(discordId: string, account: StoredAccount): void {
  if (!discordId) return;
  mkdirSync(accountsDir, { recursive: true });
  writeFileSync(userAccountPath(discordId), JSON.stringify(account, null, 2), "utf8");
}

export function deleteAccountForDiscordUser(discordId: string): void {
  if (!discordId) return;
  try {
    const file = userAccountPath(discordId);
    if (existsSync(file)) unlinkSync(file);
  } catch {}
}

export function loadAccount(): StoredAccount | null {
  const store = getAuthStore();
  if (!store) return null;
  if (store.account) return store.account;
  if (store.discord?.id) {
    const acc = loadAccountForDiscordUser(store.discord.id);
    store.account = acc;
    return acc;
  }
  return null;
}

export async function loadAccountForOwner(ownerDiscordId?: string | null): Promise<StoredAccount | null> {
  if (!ownerDiscordId) return null;
  if (cloudConfigured()) {
    return fetchCloudAccount(ownerDiscordId);
  }
  return loadAccountForDiscordUser(ownerDiscordId);
}

export async function saveAccount(account: StoredAccount): Promise<void> {
  const store = getAuthStore();
  const discord = store?.discord || currentDiscord();
  if (!discord?.id) {
    throw new Error("Faça login com o Discord primeiro para conectar sua conta Roblox.");
  }
  if (store) store.account = account;
  if (cloudConfigured()) {
    await upsertCloudAccount(discord, account);
    return;
  }
  saveAccountForDiscordUser(discord.id, account);
}

export async function clearAccount(): Promise<void> {
  const store = getAuthStore();
  const discord = store?.discord || currentDiscord();
  if (store) store.account = null;
  if (discord?.id) {
    if (cloudConfigured()) {
      await upsertCloudAccount(discord, null);
    } else {
      deleteAccountForDiscordUser(discord.id);
    }
  }
}

export function publicAccount() {
  const account = loadAccount();
  const discord = currentDiscord();
  if (!account || !discord) {
    return {
      connected: false,
      userId: null,
      username: null,
      displayName: null,
      connectedAt: null,
      ops: { ...EMPTY_OPS },
      discordEnabled: true,
      discord: discord || null,
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
