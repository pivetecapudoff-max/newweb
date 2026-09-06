import type { CatalogItem } from "./types.js";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const BATCH = 50;
const GAP_MS = 800;

interface ThumbRow {
  targetId?: number;
  state?: string;
  imageUrl?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchBatch(url: string): Promise<ThumbRow[]> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
    });
    if (res.status === 429) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (!res.ok) return [];
    const payload = (await res.json()) as { data?: ThumbRow[] };
    return payload.data || [];
  }
  return [];
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export async function attachThumbnails(items: CatalogItem[]): Promise<void> {
  const assets = items.filter((item) => item.itemType !== "Bundle");
  const bundles = items.filter((item) => item.itemType === "Bundle");
  const byId = new Map(items.map((item) => [item.id, item]));
  let first = true;

  for (const group of chunk(assets, BATCH)) {
    if (!first) await sleep(GAP_MS);
    first = false;
    const ids = group.map((item) => item.id).join(",");
    const rows = await fetchBatch(
      `https://thumbnails.roblox.com/v1/assets?assetIds=${ids}&size=420x420&format=Png&isCircular=false`
    );
    for (const row of rows) {
      if (row.state !== "Completed" || !row.imageUrl || !row.targetId) continue;
      const item = byId.get(row.targetId);
      if (item) item.thumbnailUrl = row.imageUrl;
    }
  }

  for (const group of chunk(bundles, BATCH)) {
    if (!first) await sleep(GAP_MS);
    first = false;
    const ids = group.map((item) => item.id).join(",");
    const rows = await fetchBatch(
      `https://thumbnails.roblox.com/v1/bundles/thumbnails?bundleIds=${ids}&size=420x420&format=Png`
    );
    for (const row of rows) {
      if (row.state !== "Completed" || !row.imageUrl || !row.targetId) continue;
      const item = byId.get(row.targetId);
      if (item) item.thumbnailUrl = row.imageUrl;
    }
  }
}
