import type { CatalogItem, DemandField } from "./types.js";

const UA = "Farol/1.0 (+local UGC research; polite catalog reads)";
const CATALOG_DETAILS = "https://catalog.roblox.com/v1/catalog/items/details";
const MARKETPLACE_DETAILS = "https://apis.roblox.com/marketplace-items/v1/items/details";
const BATCH = 30;
const GAP_MS = 1300;

let csrfToken: string | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function preferCount(...values: unknown[]): number | null {
  let found: number | null = null;
  for (const value of values) {
    const n = asCount(value);
    if (n == null) continue;
    if (found == null || n > found) found = n;
  }
  return found;
}

export function demandOf(item: CatalogItem): number {
  if ((item.saleCount || 0) > 0) return item.saleCount || 0;
  return item.favoriteCount || 0;
}

export function demandFieldOf(item: CatalogItem): DemandField {
  return (item.saleCount || 0) > 0 ? "vendas" : "favoritos";
}

interface CatalogDetailsRow {
  id?: number;
  itemType?: string;
  saleCount?: number;
  purchaseCount?: number;
  sales?: number;
  favoriteCount?: number;
  collectibleItemId?: string;
  itemRestrictions?: string[];
}

interface MarketplaceRow {
  itemTargetId?: number;
  collectibleItemId?: string;
  sales?: number;
}

async function csrfPost(url: string, body: unknown): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": UA,
  };
  if (csrfToken) headers["x-csrf-token"] = csrfToken;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    let res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const token = res.headers.get("x-csrf-token");
    if (token) {
      csrfToken = token;
      headers["x-csrf-token"] = token;
    }
    if (res.status === 403 && token && attempt === 0) {
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    }
    if (res.status === 429) {
      await sleep(2500 * (attempt + 1));
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${url} ${res.status}${text ? `: ${text.slice(0, 160)}` : ""}`);
    }
    return res.json();
  }
  throw new Error(`${url} recusou a leitura (429).`);
}

async function fetchCatalogDetails(
  items: CatalogItem[]
): Promise<Map<number, CatalogDetailsRow>> {
  const out = new Map<number, CatalogDetailsRow>();
  for (let i = 0; i < items.length; i += BATCH) {
    if (i) await sleep(GAP_MS);
    const chunk = items.slice(i, i + BATCH);
    const payload = (await csrfPost(CATALOG_DETAILS, {
      items: chunk.map((item) => ({
        itemType: item.itemType === "Bundle" ? "Bundle" : "Asset",
        id: item.id,
      })),
    })) as { data?: CatalogDetailsRow[] };
    for (const row of payload.data || []) {
      if (typeof row.id === "number") out.set(row.id, row);
    }
  }
  return out;
}

async function fetchMarketplaceSales(
  collectibleIds: string[]
): Promise<Map<string, MarketplaceRow>> {
  const unique = [...new Set(collectibleIds.filter(Boolean))];
  const out = new Map<string, MarketplaceRow>();
  for (let i = 0; i < unique.length; i += BATCH) {
    if (i) await sleep(GAP_MS);
    const itemIds = unique.slice(i, i + BATCH);
    const payload = await csrfPost(MARKETPLACE_DETAILS, { itemIds });
    const rows = Array.isArray(payload) ? (payload as MarketplaceRow[]) : [];
    for (const row of rows) {
      if (row.collectibleItemId) out.set(row.collectibleItemId, row);
    }
  }
  return out;
}

async function fetchResaleSales(id: number): Promise<number | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(`https://economy.roblox.com/v1/assets/${id}/resale-data`, {
      headers: { Accept: "application/json", "User-Agent": UA },
    });
    if (res.status === 429) {
      await sleep(1800 * (attempt + 1));
      continue;
    }
    if (!res.ok) return null;
    const payload = (await res.json()) as { sales?: number };
    return asCount(payload.sales);
  }
  return null;
}

export async function attachSales(items: CatalogItem[]): Promise<void> {
  const catalogRows = await fetchCatalogDetails(items);
  for (const item of items) {
    const row = catalogRows.get(item.id);
    if (!row) continue;
    if (row.collectibleItemId) item.collectibleItemId = row.collectibleItemId;
    if (row.itemRestrictions) item.itemRestrictions = row.itemRestrictions;
    if (typeof row.favoriteCount === "number") {
      item.favoriteCount = row.favoriteCount;
    }
    const fromCatalog = preferCount(item.saleCount, row.saleCount, row.purchaseCount, row.sales);
    if (fromCatalog != null) item.saleCount = fromCatalog;
  }

  const marketplaceRows = await fetchMarketplaceSales(
    items.map((item) => item.collectibleItemId || "").filter(Boolean)
  );
  for (const item of items) {
    const row = item.collectibleItemId ? marketplaceRows.get(item.collectibleItemId) : undefined;
    const fromMarket = preferCount(item.saleCount, row?.sales);
    if (fromMarket != null) item.saleCount = fromMarket;
  }

  const limiteds = items.filter((item) => {
    const restricted = (item.itemRestrictions || []).some((flag) =>
      /limited/i.test(flag)
    );
    return restricted && !(item.saleCount && item.saleCount > 0);
  });
  for (let i = 0; i < limiteds.length; i += 1) {
    if (i) await sleep(220);
    const sales = await fetchResaleSales(limiteds[i].id);
    const merged = preferCount(limiteds[i].saleCount, sales);
    if (merged != null) limiteds[i].saleCount = merged;
  }

  for (const item of items) {
    item.demandField = demandFieldOf(item);
  }
}
