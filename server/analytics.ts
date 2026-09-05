import { loadAccount } from "./account.js";
import { listGroupAccess, type GroupAccess } from "./groups.js";
import { robloxGet } from "./dashboard.js";

export interface BestsellerItem {
  id: number;
  name: string;
  salesCount: number;
  totalRobux: number;
  avgPrice: number;
  lastSoldAt: string;
  thumbnailUrl: string | null;
  catalogUrl: string;
  shareOfTotal: number;
}

export interface RecentSale {
  id: number;
  name: string;
  amount: number;
  buyer: string;
  created: string;
  thumbnailUrl: string | null;
}

export interface AnalyticsPayload {
  connected: boolean;
  groupId: number | "all";
  groupName: string;
  groups: { id: number; name: string; role: string; canViewSales: boolean }[];
  kpis: {
    totalSales: number;
    totalRevenue: number;
    avgTicket: number;
    todaySales: number;
    todayRevenue: number;
    topItem: {
      name: string;
      id: number;
      salesCount: number;
      totalRobux: number;
      thumbnailUrl: string | null;
    } | null;
  };
  bestsellers: BestsellerItem[];
  recentSales: RecentSale[];
  dailySales: { date: string; sales: number; revenue: number }[];
}

interface RawSale {
  id: number;
  name: string;
  amount: number;
  buyer: string;
  created: string;
}

async function fetchAssetThumbnails(ids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (!ids.length) return map;
  const unique = Array.from(new Set(ids.filter((id) => id > 0))).slice(0, 100);
  if (!unique.length) return map;
  try {
    const url = `https://thumbnails.roblox.com/v1/assets?assetIds=${unique.join(",")}&size=150x150&format=Png`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (res.ok) {
      const payload = (await res.json()) as { data?: { targetId?: number; imageUrl?: string }[] };
      for (const item of payload.data || []) {
        if (item.targetId && item.imageUrl) {
          map.set(item.targetId, item.imageUrl);
        }
      }
    }
  } catch {}
  return map;
}

const analyticsCache = new Map<string, { at: number; payload: AnalyticsPayload }>();
const CACHE_TTL_MS = 25_000;

export async function buildAnalytics(groupIdRaw?: string): Promise<AnalyticsPayload> {
  const account = loadAccount();
  if (!account || !account.cookie) {
    return {
      connected: false,
      groupId: "all",
      groupName: "Nenhuma conta conectada",
      groups: [],
      kpis: {
        totalSales: 0,
        totalRevenue: 0,
        avgTicket: 0,
        todaySales: 0,
        todayRevenue: 0,
        topItem: null,
      },
      bestsellers: [],
      recentSales: [],
      dailySales: [],
    };
  }

  const cacheKey = `${account.userId}:${groupIdRaw || "all"}`;
  const cached = analyticsCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.payload;
  }

  let access: GroupAccess[] = [];
  try {
    access = await listGroupAccess(account.cookie, account.userId);
  } catch {}

  const readableGroups = access.filter((g) => g.canViewSales);
  let targetGroupId: number | "all" = "all";
  let activeGroupName = "Todas as Lojas (Consolidado)";

  if (groupIdRaw === "all" || !groupIdRaw) {
    targetGroupId = "all";
    activeGroupName = "Todas as Lojas (Consolidado)";
  } else if (/^[0-9]+$/.test(groupIdRaw)) {
    targetGroupId = Number(groupIdRaw);
    const found = access.find((g) => g.id === targetGroupId);
    if (found) activeGroupName = found.name;
  }

  const rawSales: RawSale[] = [];
  const groupsToFetch = targetGroupId === "all" ? readableGroups.slice(0, 3) : readableGroups.filter((g) => g.id === targetGroupId);
  const maxPages = targetGroupId === "all" ? 1 : 4;

  for (const group of groupsToFetch) {
    let cursor: string | null = null;
    for (let page = 0; page < maxPages; page++) {
      const params = new URLSearchParams({
        transactionType: "Sale",
        limit: "100",
      });
      if (cursor) params.set("cursor", cursor);

      const res = await robloxGet(
        `https://economy.roblox.com/v2/groups/${group.id}/transactions?${params.toString()}`,
        account.cookie
      );
      if (res.status !== 200 || !res.json) break;

      const payload = res.json as {
        data?: {
          id?: number;
          created?: string;
          details?: { id?: number; name?: string };
          currency?: { amount?: number };
          agent?: { name?: string };
          amount?: number;
          name?: string;
        }[];
        nextPageCursor?: string | null;
      };

      for (const row of payload.data || []) {
        const id = Number(row.details?.id || 0);
        const name = String(row.details?.name || row.name || "Asset");
        const amount = Math.max(0, Number(row.currency?.amount ?? row.amount ?? 0));
        const buyer = String(row.agent?.name || "Roblox User");
        const created = String(row.created || new Date().toISOString());
        rawSales.push({ id, name, amount, buyer, created });
      }
      cursor = payload.nextPageCursor || null;
      if (!cursor) break;
    }
  }

  const itemMap = new Map<number | string, {
    id: number;
    name: string;
    salesCount: number;
    totalRobux: number;
    lastSoldAt: string;
  }>();

  const todayStr = new Date().toISOString().slice(0, 10);
  let todaySales = 0;
  let todayRevenue = 0;
  let totalRevenue = 0;

  const dailyBuckets = new Map<string, { sales: number; revenue: number }>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dailyBuckets.set(key, { sales: 0, revenue: 0 });
  }

  for (const s of rawSales) {
    const key = s.id > 0 ? s.id : s.name;
    const existing = itemMap.get(key);
    if (existing) {
      existing.salesCount += 1;
      existing.totalRobux += s.amount;
      if (new Date(s.created) > new Date(existing.lastSoldAt)) {
        existing.lastSoldAt = s.created;
      }
    } else {
      itemMap.set(key, {
        id: s.id,
        name: s.name,
        salesCount: 1,
        totalRobux: s.amount,
        lastSoldAt: s.created,
      });
    }
    totalRevenue += s.amount;

    const day = s.created.slice(0, 10);
    if (day === todayStr) {
      todaySales += 1;
      todayRevenue += s.amount;
    }

    const bucket = dailyBuckets.get(day);
    if (bucket) {
      bucket.sales += 1;
      bucket.revenue += s.amount;
    }
  }

  const sortedItems = Array.from(itemMap.values()).sort((a, b) => b.salesCount - a.salesCount);
  const topItemIds = sortedItems.map((item) => item.id).filter((id) => id > 0);
  const thumbs = await fetchAssetThumbnails(topItemIds);

  const bestsellers: BestsellerItem[] = sortedItems.map((item) => ({
    id: item.id,
    name: item.name,
    salesCount: item.salesCount,
    totalRobux: item.totalRobux,
    avgPrice: Math.round(item.totalRobux / Math.max(1, item.salesCount)),
    lastSoldAt: item.lastSoldAt,
    thumbnailUrl: thumbs.get(item.id) || null,
    catalogUrl: item.id > 0 ? `https://www.roblox.com/catalog/${item.id}` : "#",
    shareOfTotal: rawSales.length > 0 ? Math.round((item.salesCount / rawSales.length) * 100) : 0,
  }));

  const recentSales: RecentSale[] = rawSales.slice(0, 30).map((s) => ({
    id: s.id,
    name: s.name,
    amount: s.amount,
    buyer: s.buyer,
    created: s.created,
    thumbnailUrl: thumbs.get(s.id) || null,
  }));

  const top = bestsellers[0] || null;

  const result: AnalyticsPayload = {
    connected: true,
    groupId: targetGroupId,
    groupName: activeGroupName,
    groups: access.map((g) => ({
      id: g.id,
      name: g.name,
      role: g.role,
      canViewSales: g.canViewSales,
    })),
    kpis: {
      totalSales: rawSales.length,
      totalRevenue,
      avgTicket: rawSales.length > 0 ? Math.round(totalRevenue / rawSales.length) : 0,
      todaySales,
      todayRevenue,
      topItem: top
        ? {
            name: top.name,
            id: top.id,
            salesCount: top.salesCount,
            totalRobux: top.totalRobux,
            thumbnailUrl: top.thumbnailUrl,
          }
        : null,
    },
    bestsellers,
    recentSales,
    dailySales: Array.from(dailyBuckets.entries()).map(([date, data]) => ({
      date,
      sales: data.sales,
      revenue: data.revenue,
    })),
  };

  analyticsCache.set(cacheKey, { at: Date.now(), payload: result });
  return result;
}