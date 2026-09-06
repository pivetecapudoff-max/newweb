import { attachThumbnails } from "./thumbnails.js";
import type { CatalogItem } from "./types.js";

const BASE_URL = "https://catalog.roblox.com/v1/search/items/details";
const UA = "Farol/1.0 (+local UGC research; polite catalog reads)";

export interface MarketScanOptions {
  strategy?: "bestselling" | "favorited" | "recent" | "sales" | "price_asc";
  timePeriod?: "all" | "day" | "week" | "month";
  keywords?: string;
  groupId?: string | number;
  scanMode?: "fixed" | "rotation";
  limit?: number;
  assetType?: "both" | "shirts" | "pants" | "tshirts" | "ugc";
  shirtPantsRatio?: number; // 0 to 100, default 50
  rotationKeywords?: string[];
}

export interface ScannedMarketItem {
  id: number;
  itemType: string;
  assetType: number | null;
  name: string;
  description: string;
  creatorId: number;
  creatorName: string;
  creatorType: string;
  createdAt: string | null;
  favoriteCount: number;
  price: number | null;
  thumbnailUrl: string | null;
  category: string;
  assetTypeName: string;
  collectibleItemId?: string | null;
}

export interface MarketScanResult {
  ok: boolean;
  items: ScannedMarketItem[];
  total: number;
  summary: {
    avgPrice: number;
    totalFavorites: number;
    shirtCount: number;
    pantsCount: number;
    ugcCount: number;
    topKeywords: string[];
  };
  options: MarketScanOptions;
}

function resolveAssetTypeName(assetType: number | null, subcategory?: string): string {
  if (assetType === 11 || subcategory === "ClassicShirts") return "Shirt";
  if (assetType === 12 || subcategory === "ClassicPants") return "Pants";
  if (assetType === 2 || subcategory === "ClassicTShirts") return "T-Shirt";
  if (
    assetType === 8 ||
    assetType === 41 ||
    assetType === 42 ||
    assetType === 43 ||
    assetType === 44 ||
    assetType === 45 ||
    assetType === 46 ||
    assetType === 47
  ) {
    return "UGC Accessory";
  }
  return "Asset";
}

async function fetchRobloxCatalog(params: {
  category: string;
  subcategory?: string;
  keyword?: string;
  creatorTargetId?: string | number;
  creatorType?: string;
  sortType: string;
  sortAggregation?: string;
  limit: number;
}): Promise<any[]> {
  const url = new URL(BASE_URL);
  url.searchParams.set("category", params.category);
  if (params.subcategory) url.searchParams.set("subcategory", params.subcategory);
  if (params.keyword && params.keyword.trim()) url.searchParams.set("keyword", params.keyword.trim());
  if (params.creatorTargetId) {
    url.searchParams.set("creatorTargetId", String(params.creatorTargetId).trim());
    url.searchParams.set("creatorType", params.creatorType || "Group");
  }
  url.searchParams.set("sortType", params.sortType);
  if (params.sortAggregation) url.searchParams.set("sortAggregation", params.sortAggregation);

  // Roblox catalog details endpoint strictly accepts limit of 10, 28, or 30
  const apiLimit = params.limit <= 10 ? "10" : params.limit <= 28 ? "28" : "30";
  url.searchParams.set("limit", apiLimit);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": UA,
      },
    });

    if (!res.ok) {
      console.warn(`[MarketScanner] Roblox API returned ${res.status}: ${res.statusText}`);
      return [];
    }

    const json = (await res.json()) as { data?: any[] };
    return json.data || [];
  } catch (err) {
    console.error("[MarketScanner] Request failed:", err);
    return [];
  }
}

export async function scanMarketCatalog(options: MarketScanOptions): Promise<MarketScanResult> {
  const requestedLimit = Math.max(1, Math.min(100, options.limit || 10));
  const strategy = options.strategy || "bestselling";
  const timePeriod = options.timePeriod || "all";
  const assetType = options.assetType || "both";
  const ratio = typeof options.shirtPantsRatio === "number" ? Math.max(0, Math.min(100, options.shirtPantsRatio)) : 50;

  // Map strategy to Roblox sortType
  let sortType = "5"; // Bestselling
  if (strategy === "favorited") sortType = "1";
  else if (strategy === "recent") sortType = "4";
  else if (strategy === "price_asc") sortType = "2";
  else if (strategy === "sales" || strategy === "bestselling") sortType = "5";

  // Map timePeriod to Roblox sortAggregation
  let sortAggregation: string | undefined = "5"; // All Time
  if (timePeriod === "day") sortAggregation = "1";
  else if (timePeriod === "week") sortAggregation = "2";
  else if (timePeriod === "month") sortAggregation = "3";
  else if (timePeriod === "all") sortAggregation = "5";

  // Keywords handling (Fixed Amount or Rotation)
  let keywordsList: string[] = [];
  if (options.scanMode === "rotation" && options.rotationKeywords && options.rotationKeywords.length > 0) {
    keywordsList = options.rotationKeywords.filter((k) => k.trim().length > 0);
  } else if (options.keywords && options.keywords.trim()) {
    keywordsList = [options.keywords.trim()];
  } else {
    keywordsList = [""];
  }

  const rawAccumulator: any[] = [];
  const seenIds = new Set<number>();

  for (const kw of keywordsList) {
    if (rawAccumulator.length >= requestedLimit) break;

    if (assetType === "both") {
      const shirtQuota = Math.max(1, Math.round((requestedLimit * ratio) / 100));
      const pantsQuota = Math.max(1, requestedLimit - shirtQuota);

      const [shirts, pants] = await Promise.all([
        fetchRobloxCatalog({
          category: "Clothing",
          subcategory: "ClassicShirts",
          keyword: kw,
          creatorTargetId: options.groupId,
          sortType,
          sortAggregation,
          limit: shirtQuota,
        }),
        fetchRobloxCatalog({
          category: "Clothing",
          subcategory: "ClassicPants",
          keyword: kw,
          creatorTargetId: options.groupId,
          sortType,
          sortAggregation,
          limit: pantsQuota,
        }),
      ]);

      for (const item of shirts.slice(0, shirtQuota)) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          rawAccumulator.push({ ...item, _subcat: "ClassicShirts" });
        }
      }
      for (const item of pants.slice(0, pantsQuota)) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          rawAccumulator.push({ ...item, _subcat: "ClassicPants" });
        }
      }
    } else if (assetType === "shirts") {
      const shirts = await fetchRobloxCatalog({
        category: "Clothing",
        subcategory: "ClassicShirts",
        keyword: kw,
        creatorTargetId: options.groupId,
        sortType,
        sortAggregation,
        limit: requestedLimit,
      });
      for (const item of shirts) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          rawAccumulator.push({ ...item, _subcat: "ClassicShirts" });
        }
      }
    } else if (assetType === "pants") {
      const pants = await fetchRobloxCatalog({
        category: "Clothing",
        subcategory: "ClassicPants",
        keyword: kw,
        creatorTargetId: options.groupId,
        sortType,
        sortAggregation,
        limit: requestedLimit,
      });
      for (const item of pants) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          rawAccumulator.push({ ...item, _subcat: "ClassicPants" });
        }
      }
    } else if (assetType === "tshirts") {
      const tshirts = await fetchRobloxCatalog({
        category: "Clothing",
        subcategory: "ClassicTShirts",
        keyword: kw,
        creatorTargetId: options.groupId,
        sortType,
        sortAggregation,
        limit: requestedLimit,
      });
      for (const item of tshirts) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          rawAccumulator.push({ ...item, _subcat: "ClassicTShirts" });
        }
      }
    } else if (assetType === "ugc") {
      const ugcs = await fetchRobloxCatalog({
        category: "Accessories",
        keyword: kw,
        creatorTargetId: options.groupId,
        sortType,
        sortAggregation,
        limit: requestedLimit,
      });
      for (const item of ugcs) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          rawAccumulator.push({ ...item, _subcat: "Accessories" });
        }
      }
    }
  }

  // Slice to requested limit
  const selectedRaw = rawAccumulator.slice(0, requestedLimit);

  // Convert to CatalogItem array to use attachThumbnails
  const catalogItems: CatalogItem[] = selectedRaw.map((raw) => ({
    id: raw.id,
    itemType: raw.itemType || "Asset",
    assetType: raw.assetType ?? null,
    name: String(raw.name || "Item Roblox").trim(),
    creatorId: raw.creatorTargetId || 0,
    creatorName: raw.creatorName || "Desconhecido",
    createdAt: raw.itemCreatedUtc || null,
    favoriteCount: raw.favoriteCount || 0,
    price: raw.lowestPrice ?? raw.price ?? null,
    category: (raw._subcat === "ClassicPants" ? "pants" : raw._subcat === "Accessories" ? "collectibles" : "shirts") as any,
    thumbnailUrl: null,
    collectibleItemId: raw.collectibleItemId || null,
    itemRestrictions: raw.itemRestrictions || [],
    saleCount: raw.saleCount ?? null,
    demandField: "favoritos",
  }));

  try {
    await attachThumbnails(catalogItems);
  } catch (err) {
    console.warn("[MarketScanner] Could not attach thumbnails:", err);
  }

  // Map to ScannedMarketItem
  const finalItems: ScannedMarketItem[] = catalogItems.map((ci, idx) => {
    const raw = selectedRaw[idx] || {};
    return {
      id: ci.id,
      itemType: ci.itemType,
      assetType: ci.assetType,
      name: ci.name,
      description: String(raw.description || ""),
      creatorId: ci.creatorId,
      creatorName: ci.creatorName,
      creatorType: raw.creatorType || "Group",
      createdAt: ci.createdAt,
      favoriteCount: ci.favoriteCount,
      price: ci.price,
      thumbnailUrl: ci.thumbnailUrl,
      category: ci.category,
      assetTypeName: resolveAssetTypeName(ci.assetType, raw._subcat),
      collectibleItemId: ci.collectibleItemId,
    };
  });

  // Calculate summary metrics
  const prices = finalItems
    .map((i) => i.price)
    .filter((p): p is number => typeof p === "number" && p > 0 && p <= 100000);
  const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 5;
  const totalFavorites = finalItems.reduce((acc, i) => acc + (i.favoriteCount || 0), 0);
  const shirtCount = finalItems.filter((i) => i.assetTypeName === "Shirt").length;
  const pantsCount = finalItems.filter((i) => i.assetTypeName === "Pants").length;
  const ugcCount = finalItems.filter((i) => i.assetTypeName === "UGC Accessory").length;

  return {
    ok: true,
    items: finalItems,
    total: finalItems.length,
    summary: {
      avgPrice,
      totalFavorites,
      shirtCount,
      pantsCount,
      ugcCount,
      topKeywords: keywordsList.filter(Boolean),
    },
    options,
  };
}
