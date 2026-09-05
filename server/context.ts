import { AsyncLocalStorage } from "node:async_hooks";

export interface StoredOps {
  sessionUploads: number;
  failed: number;
  moderated: number;
}

export interface StoredAccount {
  cookie: string;
  userId: number;
  username: string;
  displayName: string | null;
  connectedAt: string;
  ops: StoredOps;
}

export interface DiscordIdentity {
  id: string;
  name: string;
  avatar: string | null;
}

export interface AuthStore {
  discord: DiscordIdentity | null;
  account: StoredAccount | null;
}

const als = new AsyncLocalStorage<AuthStore>();

export function runAuthStore<T>(store: AuthStore, fn: () => T): T {
  return als.run(store, fn);
}

export function getAuthStore(): AuthStore | undefined {
  return als.getStore();
}

export function currentDiscord(): DiscordIdentity | null {
  return als.getStore()?.discord || null;
}

export function currentOwnerKey(): string {
  return als.getStore()?.discord?.id || "local";
}
