const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const GAP_MS = 280;
const CACHE_MS = 60_000;

export interface GroupAccess {
  id: number;
  name: string;
  role: string;
  rank: number;
  canPost: boolean;
  canViewSales: boolean;
  reason: "Owner" | "Create items" | null;
  isOwner: boolean;
  createItems: boolean;
  manageItems: boolean;
}

let csrfToken: string | null = null;
const cache = new Map<string, { at: number; groups: GroupAccess[] }>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function robloxGet(cookie: string, url: string): Promise<{ status: number; json: unknown }> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": UA,
    Cookie: `.ROBLOSECURITY=${cookie}`,
  };
  if (csrfToken) headers["x-csrf-token"] = csrfToken;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    let res = await fetch(url, { headers });
    const token = res.headers.get("x-csrf-token");
    if (token) {
      csrfToken = token;
      headers["x-csrf-token"] = token;
    }
    if (res.status === 403 && token && attempt === 0) {
      res = await fetch(url, { headers });
    }
    if (res.status === 429) {
      await sleep(1600 * (attempt + 1));
      continue;
    }
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  }
  return { status: 429, json: null };
}

interface MembershipRow {
  isOwner?: boolean;
  canConfigure?: boolean;
  userRole?: { role?: { id?: number; name?: string; rank?: number } };
  permissions?: {
    groupEconomyPermissions?: {
      createItems?: boolean;
      manageItems?: boolean;
      viewGroupPayouts?: boolean;
    };
  };
}

interface RolePerms {
  permissions?: {
    groupEconomyPermissions?: {
      createItems?: boolean;
      manageItems?: boolean;
      viewGroupPayouts?: boolean;
    };
  };
}

function decide(input: {
  id: number;
  name: string;
  role: string;
  rank: number;
  isOwner?: boolean;
  createItems?: boolean;
  manageItems?: boolean;
  viewGroupPayouts?: boolean;
}): GroupAccess {
  const isOwner = Boolean(input.isOwner) || input.rank === 255;
  const createItems = Boolean(input.createItems);
  const manageItems = Boolean(input.manageItems);
  const canPost = isOwner || createItems;
  const reason: GroupAccess["reason"] = isOwner ? "Owner" : createItems ? "Create items" : null;
  return {
    id: input.id,
    name: input.name,
    role: input.role || (isOwner ? "Owner" : "Member"),
    rank: input.rank,
    canPost,
    canViewSales: isOwner || Boolean(input.viewGroupPayouts) || createItems || manageItems,
    reason,
    isOwner,
    createItems,
    manageItems,
  };
}

async function readMembership(
  cookie: string,
  groupId: number,
  roleId: number
): Promise<Pick<
  GroupAccess,
  "isOwner" | "createItems" | "manageItems" | "canViewSales"
> & { viewGroupPayouts: boolean } | null> {
  const membership = await robloxGet(
    cookie,
    `https://groups.roblox.com/v1/groups/${groupId}/membership?includeNotificationPreferences=false`
  );
  if (membership.status === 200 && membership.json && typeof membership.json === "object") {
    const row = membership.json as MembershipRow;
    const econ = row.permissions?.groupEconomyPermissions;
    return {
      isOwner: Boolean(row.isOwner),
      createItems: Boolean(econ?.createItems),
      manageItems: Boolean(econ?.manageItems),
      canViewSales: Boolean(econ?.viewGroupPayouts || row.isOwner || econ?.createItems),
      viewGroupPayouts: Boolean(econ?.viewGroupPayouts),
    };
  }

  const perms = await robloxGet(
    cookie,
    `https://groups.roblox.com/v1/groups/${groupId}/roles/${roleId}/permissions`
  );
  if (perms.status === 200 && perms.json && typeof perms.json === "object") {
    const econ = (perms.json as RolePerms).permissions?.groupEconomyPermissions;
    return {
      isOwner: false,
      createItems: Boolean(econ?.createItems),
      manageItems: Boolean(econ?.manageItems),
      canViewSales: Boolean(econ?.viewGroupPayouts || econ?.createItems || econ?.manageItems),
      viewGroupPayouts: Boolean(econ?.viewGroupPayouts),
    };
  }
  return null;
}

export async function listGroupAccess(cookie: string, userId: number): Promise<GroupAccess[]> {
  const key = String(userId);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.groups;

  const roles = await robloxGet(cookie, `https://groups.roblox.com/v2/users/${userId}/groups/roles`);
  const rows =
    (roles.json as {
      data?: {
        group?: { id: number; name: string };
        role?: { id?: number; name?: string; rank?: number };
      }[];
    } | null)?.data || [];

  const groups: GroupAccess[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const id = row.group?.id;
    if (!id) continue;
    if (i) await sleep(GAP_MS);
    const roleId = row.role?.id || 0;
    const flags = roleId ? await readMembership(cookie, id, roleId) : null;
    groups.push(
      decide({
        id,
        name: row.group?.name || "Group",
        role: row.role?.name || "Member",
        rank: row.role?.rank || 0,
        isOwner: flags?.isOwner,
        createItems: flags?.createItems,
        manageItems: flags?.manageItems,
        viewGroupPayouts: flags?.viewGroupPayouts,
      })
    );
  }

  groups.sort((a, b) => Number(b.canPost) - Number(a.canPost) || a.name.localeCompare(b.name));
  cache.set(key, { at: Date.now(), groups });
  return groups;
}

export async function listPostableGroups(cookie: string, userId: number): Promise<GroupAccess[]> {
  return (await listGroupAccess(cookie, userId)).filter((group) => group.canPost);
}

export function bustGroupCache(): void {
  cache.clear();
}
