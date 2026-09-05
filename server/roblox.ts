import type { CatalogCategory, CatalogItem } from "./types.js";

const BASE = "https://catalog.roblox.com/v1/search/items/details";
const MIN_GAP_MS = 1300;
const UA = "Farol/1.0 (+local UGC research; polite catalog reads)";

const CATEGORY_QUERY: Record<
  CatalogCategory,
  {
    category: string;
    subcategory?: string;
    salesTypeFilter?: string;
    accept: (item: RawItem) => boolean;
  }
> = {
  shirts: {
    category: "Clothing",
    subcategory: "ClassicShirts",
    accept: (item) => item.itemType === "Asset" && item.assetType === 11,
  },
  pants: {
    category: "Clothing",
    subcategory: "ClassicPants",
    accept: (item) => item.itemType === "Asset" && item.assetType === 12,
  },
  tshirts: {
    category: "Clothing",
    subcategory: "ClassicTShirts",
    accept: (item) => item.itemType === "Asset" && item.assetType === 2,
  },
  characters: {
    category: "All",
    accept: (item) => item.itemType === "Bundle",
  },
  collectibles: {
    category: "Accessories",
    salesTypeFilter: "2",
    accept: (item) => item.itemType === "Asset",
  },
};

interface RawItem {
  id: number;
  itemType?: string;
  assetType?: number;
  name?: string;
  creatorTargetId?: number;
  creatorName?: string;
  itemCreatedUtc?: string;
  favoriteCount?: number;
  price?: number;
  lowestPrice?: number;
  collectibleItemId?: string;
  itemRestrictions?: string[];
  saleCount?: number;
  purchaseCount?: number;
  sales?: number;
}

interface SearchPage {
  nextPageCursor?: string | null;
  data?: RawItem[];
}

let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function politeGet(url: string): Promise<SearchPage> {
  const wait = Math.max(0, MIN_GAP_MS - (Date.now() - lastRequestAt));
  if (wait) await sleep(wait);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    lastRequestAt = Date.now();
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": UA,
      },
    });

    if (res.status === 429) {
      await sleep(2500 * (attempt + 1));
      continue;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Catálogo Roblox ${res.status}${body ? `: ${body.slice(0, 180)}` : ""}`);
    }
    return (await res.json()) as SearchPage;
  }

  throw new Error("Catálogo Roblox recusou a leitura (429). Tente de novo em alguns minutos.");
}

function firstCount(...values: unknown[]): number | null {
  let found: number | null = null;
  for (const value of values) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) continue;
    if (found == null || value > found) found = value;
  }
  return found;
}

function normalize(raw: RawItem, category: CatalogCategory): CatalogItem | null {
  if (!raw?.id || !raw.name) return null;
  const saleCount = firstCount(raw.saleCount, raw.purchaseCount, raw.sales);
  return {
    id: raw.id,
    itemType: raw.itemType || "Asset",
    assetType: raw.assetType ?? null,
    name: String(raw.name).trim(),
    creatorId: raw.creatorTargetId || 0,
    creatorName: raw.creatorName || "desconhecido",
    createdAt: raw.itemCreatedUtc || null,
    favoriteCount: raw.favoriteCount || 0,
    price: raw.lowestPrice ?? raw.price ?? null,
    category,
    thumbnailUrl: null,
    collectibleItemId: raw.collectibleItemId || null,
    itemRestrictions: raw.itemRestrictions || [],
    saleCount,
    demandField: (saleCount || 0) > 0 ? "vendas" : "favoritos",
  };
}

async function fetchCategory(
  key: CatalogCategory,
  pages: number
): Promise<CatalogItem[]> {
  const spec = CATEGORY_QUERY[key];
  const items: CatalogItem[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < pages; page += 1) {
    const params = new URLSearchParams({
      category: spec.category,
      limit: "30",
      sortType: "3",
    });
    if (spec.subcategory) params.set("subcategory", spec.subcategory);
    if (spec.salesTypeFilter) params.set("salesTypeFilter", spec.salesTypeFilter);
    if (cursor) params.set("cursor", cursor);

    const payload = await politeGet(`${BASE}?${params.toString()}`);
    for (const raw of payload.data || []) {
      if (!spec.accept(raw)) continue;
      const item = normalize(raw, key);
      if (item) items.push(item);
    }
    cursor = payload.nextPageCursor || null;
    if (!cursor) break;
  }

  return items;
}

export async function fetchRecentCatalog(
  categories: CatalogCategory[],
  pagesPerCategory: number
): Promise<CatalogItem[]> {
  const unique = [...new Set(categories)];
  const all: CatalogItem[] = [];
  const seen = new Set<string>();
  const errors: string[] = [];

  for (const category of unique) {
    try {
      const batch = await fetchCategory(category, pagesPerCategory);
      for (const item of batch) {
        const key = `${item.itemType}:${item.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        all.push(item);
      }
    } catch (error) {
      errors.push(`${category}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!all.length) {
    throw new Error(
      errors[0] || "The public API returned no usable items in this scan."
    );
  }

  return all;
}
