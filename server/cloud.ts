import type { StoredAccount, StoredOps } from "./context.js";
import { decryptSecret, encryptSecret } from "./secret.js";

interface CloudRow {
  discord_id: string;
  discord_name: string | null;
  discord_avatar: string | null;
  roblox_user_id: number | null;
  roblox_username: string | null;
  roblox_display_name: string | null;
  cookie_blob: string | null;
  ops: StoredOps | null;
  connected_at: string | null;
}

function supabaseConfig(): { url: string; key: string } | null {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!url || !key) return null;
  return { url, key };
}

export function cloudConfigured(): boolean {
  return Boolean(
    supabaseConfig() &&
      process.env.DISCORD_CLIENT_ID &&
      process.env.DISCORD_CLIENT_SECRET &&
      (process.env.SESSION_SECRET || "").length >= 16
  );
}

async function sb<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cfg = supabaseConfig();
  if (!cfg) throw new Error("Supabase is not configured.");
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.slice(0, 220) || `Supabase ${res.status}`);
  }
  const text = await res.text();
  if (!text) return [] as T;
  return JSON.parse(text) as T;
}

export async function fetchCloudAccount(discordId: string): Promise<StoredAccount | null> {
  const rows = await sb<CloudRow[]>(
    `illusions_users?discord_id=eq.${encodeURIComponent(discordId)}&select=*&limit=1`
  );
  const row = rows[0];
  if (!row?.cookie_blob || !row.roblox_user_id) return null;
  let cookie: string;
  try {
    cookie = decryptSecret(row.cookie_blob);
  } catch {
    return null;
  }
  if (!cookie) return null;
  return {
    cookie,
    userId: Number(row.roblox_user_id),
    username: row.roblox_username || "",
    displayName: row.roblox_display_name,
    connectedAt: row.connected_at || new Date().toISOString(),
    ops: {
      sessionUploads: Number(row.ops?.sessionUploads || 0),
      failed: Number(row.ops?.failed || 0),
      moderated: Number(row.ops?.moderated || 0),
    },
  };
}

export async function upsertCloudAccount(
  discord: { id: string; name: string; avatar: string | null },
  account: StoredAccount | null
): Promise<void> {
  await sb("illusions_users?on_conflict=discord_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      discord_id: discord.id,
      discord_name: discord.name,
      discord_avatar: discord.avatar,
      roblox_user_id: account?.userId ?? null,
      roblox_username: account?.username ?? null,
      roblox_display_name: account?.displayName ?? null,
      cookie_blob: account ? encryptSecret(account.cookie) : null,
      ops: account?.ops || { sessionUploads: 0, failed: 0, moderated: 0 },
      connected_at: account?.connectedAt ?? null,
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function touchDiscordProfile(discord: {
  id: string;
  name: string;
  avatar: string | null;
}): Promise<void> {
  await sb("illusions_users?on_conflict=discord_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      discord_id: discord.id,
      discord_name: discord.name,
      discord_avatar: discord.avatar,
      updated_at: new Date().toISOString(),
    }),
  });
}
