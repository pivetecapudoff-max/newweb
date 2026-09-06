import { tokenize } from "./nlp.js";
import { loadAccount, type StoredOps } from "./account.js";
import { isHosted } from "./host.js";
import { listGroupAccess, type GroupAccess } from "./groups.js";
import { latestCycle, loadState } from "./store.js";
import { queueStats } from "./upload.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const GAP_MS = 150;
const MAX_SALE_PAGES = 4;
export const SERVER_STARTED_AT = Date.now();

let csrfToken: string | null = null;
const cache = new Map<string, { at: number; payload: DashboardPayload }>();
const CACHE_MS = 60_000;

interface AuthUser {
  id: number;
  name: string;
  displayName?: string;
}

interface SaleRow {
  created: string;
  amount: number;
  name: string;
  source?: string;
}

interface TotalsRow {
  salesTotal?: number;
  incomingRobuxTotal?: number;
  pendingRobuxTotal?: number;
  purchaseTotal?: number;
}

export interface DashboardGroup {
  id: number;
  name: string;
  role: string;
  rank: number;
  canPost: boolean;
  canViewSales: boolean;
  reason: "Owner" | "Create items" | null;
}

export interface DashboardPayload {
  connected: boolean;
  user: {
    id: number;
    name: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  groupId: number | "all";
  groups: DashboardGroup[];
  kpis: {
    todayRevenue: number;
    todaySales: number;
    totalRevenue: number;
    totalSales: number;
    sessionUploads: number;
    failed: number;
    moderated: number;
    uptimeSeconds: number;
  };
  totalsExact: boolean;
  queue: {
    pending: number;
    processing: number;
    status: "idle" | "processing";
    note: string;
  };
  weekly: { date: string; revenue: number; sales: number }[];
  recentSales: { created: string; amount: number; name: string; source: string }[];
  keywords: { term: string; count: number; robux: number }[];
  notes: string[];
  sources: {
    user: "live" | "none" | "error";
    sales: "live" | "empty" | "forbidden" | "none";
    groups: "live" | "empty" | "forbidden" | "none";
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function lastSevenDays(): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export async function robloxGet(url: string, cookie: string): Promise<{ status: number; json: unknown }> {
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

export async function validateCookie(cookie: string): Promise<AuthUser> {
  const res = await robloxGet("https://users.roblox.com/v1/users/authenticated", cookie);
  const body = res.json as AuthUser | { errors?: { message?: string }[] } | null;
  if (res.status !== 200 || !body || !("id" in body) || !body.id) {
    if (isHosted()) {
      throw new Error(
        "Roblox rejected this session from the hosted server. A cookie copied on your PC is tied to your home IP — a VPS/datacenter IP usually fails. Run Illusions on your computer to connect."
      );
    }
    throw new Error("Roblox did not accept that cookie. Use your own .ROBLOSECURITY value.");
  }
  return { id: body.id, name: body.name, displayName: body.displayName };
}

async function fetchAvatar(userId: number): Promise<string | null> {
  const res = await fetch(
    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=true`,
    { headers: { Accept: "application/json", "User-Agent": UA } }
  );
  if (!res.ok) return null;
  const payload = (await res.json()) as { data?: { imageUrl?: string }[] };
  return payload.data?.[0]?.imageUrl || null;
}

function toDashboardGroup(group: GroupAccess): DashboardGroup {
  return {
    id: group.id,
    name: group.name,
    role: group.role,
    rank: group.rank,
    canPost: group.canPost,
    canViewSales: group.canViewSales,
    reason: group.reason,
  };
}

function readAmount(row: Record<string, unknown>): number {
  const currency = row.currency as { amount?: number } | undefined;
  if (typeof currency?.amount === "number") return currency.amount;
  if (typeof row.amount === "number") return row.amount;
  return 0;
}

function readName(row: Record<string, unknown>): string {
  const details = row.details as { name?: string } | undefined;
  return details?.name || (typeof row.name === "string" ? row.name : "");
}

async function fetchSalesPages(
  cookie: string,
  urlFor: (cursor: string | null) => string
): Promise<{ rows: SaleRow[]; status: number; truncated: boolean }> {
  const rows: SaleRow[] = [];
  let cursor: string | null = null;
  let status = 200;
  let truncated = false;

  for (let page = 0; page < MAX_SALE_PAGES; page += 1) {
    if (page) await sleep(GAP_MS);
    const res = await robloxGet(urlFor(cursor), cookie);
    status = res.status;
    if (res.status === 401 || res.status === 403) return { rows, status, truncated };
    if (res.status !== 200) break;
    const payload = res.json as {
      data?: Record<string, unknown>[];
      nextPageCursor?: string | null;
    } | null;
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    let hasRecent = false;
    for (const row of payload?.data || []) {
      const created = typeof row.created === "string" ? row.created : "";
      if (!created) continue;
      const t = new Date(created).getTime();
      if (t >= eightDaysAgo) hasRecent = true;
      rows.push({
        created,
        amount: Math.max(0, readAmount(row)),
        name: readName(row),
      });
    }
    if (!hasRecent && rows.length > 0) {
      break;
    }
    cursor = payload?.nextPageCursor || null;
    if (!cursor) return { rows, status, truncated };
  }
  if (cursor) truncated = true;
  return { rows, status, truncated };
}

async function fetchTotals(
  cookie: string,
  url: string
): Promise<TotalsRow | null> {
  const res = await robloxGet(url, cookie);
  if (res.status !== 200 || !res.json || typeof res.json !== "object") return null;
  return res.json as TotalsRow;
}

function emptyWeekly(): { date: string; revenue: number; sales: number }[] {
  return lastSevenDays().map((date) => ({ date, revenue: 0, sales: 0 }));
}

function keywordsFromSales(rows: SaleRow[]): { term: string; count: number; robux: number }[] {
  const bag = new Map<string, { count: number; robux: number }>();
  for (const row of rows) {
    const terms = tokenize(row.name || "");
    const unique = [...new Set(terms.filter((term) => !term.includes(" ")))];
    for (const term of unique.slice(0, 8)) {
      const prev = bag.get(term) || { count: 0, robux: 0 };
      prev.count += 1;
      prev.robux += row.amount;
      bag.set(term, prev);
    }
  }
  return [...bag.entries()]
    .map(([term, value]) => ({ term, ...value }))
    .sort((a, b) => b.robux - a.robux || b.count - a.count)
    .slice(0, 8);
}

function keywordsFromCatalog(): { term: string; count: number; robux: number }[] {
  const cycle = latestCycle(loadState());
  if (!cycle) return [];
  const bag = new Map<string, number>();
  for (const cluster of cycle.clusters) {
    for (const row of cluster.keywords.slice(0, 3)) {
      bag.set(row.term, (bag.get(row.term) || 0) + 1);
    }
  }
  return [...bag.entries()]
    .map(([term, count]) => ({ term, count, robux: 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function emptyPayload(ops: StoredOps, notes: string[]): DashboardPayload {
  return {
    connected: false,
    user: null,
    groupId: "all",
    groups: [],
    kpis: {
      todayRevenue: 0,
      todaySales: 0,
      totalRevenue: 0,
      totalSales: 0,
      sessionUploads: ops.sessionUploads,
      failed: ops.failed,
      moderated: ops.moderated,
      uptimeSeconds: Math.floor((Date.now() - SERVER_STARTED_AT) / 1000),
    },
    totalsExact: false,
    queue: queueStats(),
    weekly: emptyWeekly(),
    recentSales: [],
    keywords: keywordsFromCatalog(),
    notes,
    sources: { user: "none", sales: "none", groups: "none" },
  };
}

export async function buildDashboard(groupIdRaw?: string): Promise<DashboardPayload> {
  const account = loadAccount();
  const ops = account?.ops || { sessionUploads: 0, failed: 0, moderated: 0 };
  const groupKey = groupIdRaw && /^\d+$/.test(groupIdRaw) ? Number(groupIdRaw) : "all";
  const cacheKey = `${account?.userId || "none"}:${groupKey}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.payload;

  if (!account) {
    const payload = emptyPayload(ops, [
      "Connect your own Roblox cookie on Account to load live sales.",
    ]);
    cache.set(cacheKey, { at: Date.now(), payload });
    return payload;
  }

  const notes: string[] = [];
  const payload = emptyPayload(ops, notes);
  payload.connected = true;
  payload.groupId = groupKey;

  try {
    const user = await validateCookie(account.cookie);
    const avatarUrl = await fetchAvatar(user.id);
    payload.user = {
      id: user.id,
      name: user.name,
      displayName: user.displayName || user.name,
      avatarUrl,
    };
    payload.sources.user = "live";
  } catch {
    payload.sources.user = "error";
    payload.notes.push("Cookie expired or rejected. Paste a fresh .ROBLOSECURITY from your own account.");
    cache.set(cacheKey, { at: Date.now(), payload });
    return payload;
  }

  let groups: DashboardGroup[] = [];
  let access: GroupAccess[] = [];
  try {
    access = await listGroupAccess(account.cookie, account.userId);
    groups = access.map(toDashboardGroup);
    payload.groups = groups;
    payload.sources.groups = groups.length ? "live" : "empty";
    if (!access.some((group) => group.canPost)) {
      notes.push("No groups you can post clothing to. Owner or Create items is required.");
    }
  } catch {
    payload.sources.groups = "forbidden";
    notes.push("Groups API refused this session.");
  }

  const saleSources: { label: string; urlFor: (cursor: string | null) => string }[] = [];
  if (groupKey === "all" || groupKey === account.userId) {
    saleSources.push({
      label: "user",
      urlFor: (cursor) => {
        const params = new URLSearchParams({
          transactionType: "Sale",
          limit: "100",
        });
        if (cursor) params.set("cursor", cursor);
        return `https://economy.roblox.com/v2/users/${account.userId}/transactions?${params}`;
      },
    });
  }
  const readable = access.filter((group) => group.canViewSales);
  const groupTargets =
    groupKey === "all"
      ? readable
      : readable.filter((group) => group.id === groupKey);
  if (typeof groupKey === "number" && !access.some((group) => group.id === groupKey)) {
    notes.push("That group is not on this account.");
  } else if (typeof groupKey === "number" && !groupTargets.length) {
    notes.push("No sale permission on that group — skipped instead of guessing.");
  }
  for (const group of groupTargets) {
    saleSources.push({
      label: `group:${group.id}`,
      urlFor: (cursor) => {
        const params = new URLSearchParams({
          transactionType: "Sale",
          limit: "100",
        });
        if (cursor) params.set("cursor", cursor);
        return `https://economy.roblox.com/v2/groups/${group.id}/transactions?${params}`;
      },
    });
  }

  const allSales: SaleRow[] = [];
  let forbidden = false;
  let truncated = false;
  let skippedForbidden = 0;
  const saleResults = await Promise.all(
    saleSources.map(async (source) => {
      const result = await fetchSalesPages(account.cookie, source.urlFor);
      return { source, result };
    })
  );
  for (const { source, result } of saleResults) {
    if (result.status === 401 || result.status === 403) {
      forbidden = true;
      skippedForbidden += 1;
      continue;
    }
    allSales.push(...result.rows.map((row) => ({ ...row, source: source.label })));
    if (result.truncated) truncated = true;
  }
  if (skippedForbidden) {
    notes.push(
      `Skipped ${skippedForbidden} sale source${skippedForbidden === 1 ? "" : "s"} Roblox refused.`
    );
  }

  if (allSales.length) payload.sources.sales = "live";
  else if (forbidden && !allSales.length) payload.sources.sales = "forbidden";
  else payload.sources.sales = "empty";

  const today = todayKey();
  const todayRows = allSales.filter((row) => dayKey(row.created) === today);
  payload.kpis.todayRevenue = todayRows.reduce((sum, row) => sum + row.amount, 0);
  payload.kpis.todaySales = todayRows.length;
  payload.kpis.totalRevenue = allSales.reduce((sum, row) => sum + row.amount, 0);
  payload.kpis.totalSales = allSales.length;
  payload.totalsExact = !truncated && !forbidden;

  if (groupKey === "all") {
    const [dayTotals, yearTotals] = await Promise.all([
      fetchTotals(
        account.cookie,
        `https://economy.roblox.com/v2/users/${account.userId}/transaction-totals?timeFrame=Day&transactionType=Sale`
      ),
      fetchTotals(
        account.cookie,
        `https://economy.roblox.com/v2/users/${account.userId}/transaction-totals?timeFrame=Year&transactionType=Sale`
      ),
    ]);
    if (dayTotals && typeof dayTotals.salesTotal === "number") {
      payload.kpis.todaySales = dayTotals.salesTotal;
    }
    if (dayTotals && typeof dayTotals.incomingRobuxTotal === "number") {
      payload.kpis.todayRevenue = dayTotals.incomingRobuxTotal;
    }
    if (yearTotals && typeof yearTotals.salesTotal === "number") {
      payload.kpis.totalSales = yearTotals.salesTotal;
      payload.totalsExact = true;
    }
    if (yearTotals && typeof yearTotals.incomingRobuxTotal === "number") {
      payload.kpis.totalRevenue = yearTotals.incomingRobuxTotal;
      payload.totalsExact = true;
    }
  }

  const weekly = emptyWeekly();
  for (const row of allSales) {
    const key = dayKey(row.created);
    const bucket = weekly.find((day) => day.date === key);
    if (!bucket) continue;
    bucket.revenue += row.amount;
    bucket.sales += 1;
  }
  payload.weekly = weekly;
  payload.recentSales = allSales
    .slice()
    .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
    .slice(0, 12)
    .map((row) => ({
      created: row.created,
      amount: row.amount,
      name: row.name || "Venda Roblox",
      source: row.source || "Roblox",
    }));

  const fromSales = keywordsFromSales(allSales);
  payload.keywords = fromSales.length ? fromSales : keywordsFromCatalog();
  if (!fromSales.length && payload.keywords.length) {
    notes.push("Top keywords are from the catalog feed — no named sales in this window.");
  }
  if (truncated) {
    notes.push("Sale history was capped at a few pages. Totals are a loaded window unless Roblox sent yearly totals.");
  }
  if (!allSales.length && payload.sources.sales === "empty") {
    notes.push("Roblox returned no Sale transactions for this filter.");
  }

  payload.notes = notes;
  cache.set(cacheKey, { at: Date.now(), payload });
  return payload;
}

export function bustDashboardCache(): void {
  cache.clear();
}
