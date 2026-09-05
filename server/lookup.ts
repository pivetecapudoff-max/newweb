const UA = "Farol/1.0 (+local UGC research; polite asset reads)";

const ASSET_TYPE: Record<number, string> = {
  1: "Image",
  2: "T-shirt",
  8: "Hat",
  11: "Shirt",
  12: "Pants",
  13: "Decal",
  41: "Hair",
  42: "Face Accessory",
  43: "Neck",
  44: "Shoulder",
  45: "Front",
  46: "Back",
  47: "Waist",
  64: "T-shirt Accessory",
  65: "Shirt Accessory",
  66: "Pants Accessory",
  67: "Jacket",
  68: "Sweater",
  69: "Shorts",
  72: "Dress Skirt",
};

let csrfToken: string | null = null;

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
      await new Promise((resolve) => setTimeout(resolve, 1600 * (attempt + 1)));
      continue;
    }
    if (!res.ok) return null;
    return res.json();
  }
  return null;
}

async function attachDemand(look: AssetLook): Promise<void> {
  const catalog = (await csrfPost("https://catalog.roblox.com/v1/catalog/items/details", {
    items: [{ itemType: "Asset", id: look.id }],
  })) as { data?: { id?: number; favoriteCount?: number; price?: number; saleCount?: number; sales?: number; collectibleItemId?: string }[] } | null;
  const row = catalog?.data?.find((item) => item.id === look.id);
  if (row) {
    if (typeof row.favoriteCount === "number") look.favorites = row.favoriteCount;
    if (typeof row.price === "number") look.price = row.price;
    if (typeof row.saleCount === "number") look.sales = row.saleCount;
    if (typeof row.sales === "number" && (look.sales || 0) < row.sales) look.sales = row.sales;
    if (row.collectibleItemId) {
      const market = await csrfPost("https://apis.roblox.com/marketplace-items/v1/items/details", {
        itemIds: [row.collectibleItemId],
      });
      const marketRow = Array.isArray(market)
        ? (market as { sales?: number }[])[0]
        : null;
      if (typeof marketRow?.sales === "number") look.sales = marketRow.sales;
    }
  }
  look.demandField = (look.sales || 0) > 0 ? "sales" : "favorites";
}

export interface AssetLook {
  id: number;
  name: string;
  description: string;
  assetTypeId: number;
  assetType: string;
  creatorName: string | null;
  creatorType: string | null;
  createdAt: string | null;
  thumbnailUrl: string | null;
  storeUrl: string;
  catalogUrl: string;
  sales: number | null;
  favorites: number | null;
  price: number | null;
  demandField: "sales" | "favorites";
}

export function parseAssetId(raw: string): number | null {
  const text = String(raw || "").trim();
  if (!text) return null;
  const fromUrl = text.match(
    /(?:store\/asset|catalog|library|item)\/(?:\D*\/)?(\d{5,})/i
  );
  const id = Number(fromUrl?.[1] || text.match(/^(\d{5,})$/)?.[1] || 0);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function parseGroupId(raw: string): number | null {
  const text = String(raw || "").trim();
  if (!text) return null;
  const fromUrl = text.match(/(?:groups|communities)\/(\d{2,})/i);
  const id = Number(fromUrl?.[1] || text.match(/^(\d{2,})$/)?.[1] || 0);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export interface GroupStore {
  groupId: number;
  groupName: string;
  memberCount: number | null;
  itemCount: number;
  roles: { id: number; name: string; rank: number; memberCount: number }[];
  items: AssetLook[];
}

interface CatalogRow {
  id?: number;
  name?: string;
  description?: string;
  assetType?: number;
  creatorName?: string;
  creatorType?: string;
  itemCreatedUtc?: string;
}

async function fetchThumbs(ids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const res = await fetch(
      `https://thumbnails.roblox.com/v1/assets?assetIds=${batch.join(",")}&size=420x420&format=Png&isCircular=false`,
      { headers: { Accept: "application/json", "User-Agent": UA } }
    );
    if (!res.ok) continue;
    const payload = (await res.json()) as {
      data?: { targetId?: number; state?: string; imageUrl?: string }[];
    };
    for (const row of payload.data || []) {
      if (row.state === "Completed" && row.targetId && row.imageUrl) {
        map.set(row.targetId, row.imageUrl);
      }
    }
  }
  return map;
}

async function catalogGet(url: string): Promise<Response> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
    });
    if (res.status !== 429) return res;
    await new Promise((resolve) => setTimeout(resolve, 1600 * (attempt + 1)));
  }
  return fetch(url, { headers: { Accept: "application/json", "User-Agent": UA } });
}

export async function lookupGroupStore(raw: string): Promise<GroupStore | null> {
  const groupId = parseGroupId(raw);
  if (!groupId) return null;

  const groupRes = await catalogGet(`https://groups.roblox.com/v1/groups/${groupId}`);
  if (!groupRes.ok) return null;
  const group = (await groupRes.json()) as { id?: number; name?: string; memberCount?: number };
  if (!group.id) return null;

  const rolesRes = await catalogGet(`https://groups.roblox.com/v1/groups/${groupId}/roles`);
  const rolesPayload = rolesRes.ok
    ? ((await rolesRes.json()) as {
        roles?: { id?: number; name?: string; rank?: number; memberCount?: number }[];
      })
    : null;
  const roles = (rolesPayload?.roles || [])
    .filter((role) => role.id && role.name && typeof role.rank === "number")
    .map((role) => ({
      id: Number(role.id),
      name: String(role.name),
      rank: Number(role.rank),
      memberCount: Number(role.memberCount || 0),
    }))
    .sort((a, b) => b.rank - a.rank);

  const ids: number[] = [];
  let cursor = "";
  for (let page = 0; page < 10; page += 1) {
    const params = new URLSearchParams({
      creatorType: "2",
      creatorTargetId: String(groupId),
      limit: "30",
    });
    if (cursor) params.set("cursor", cursor);
    const res = await catalogGet(`https://catalog.roblox.com/v1/search/items?${params}`);
    if (!res.ok) break;
    const payload = (await res.json()) as {
      nextPageCursor?: string | null;
      data?: { id?: number }[];
    };
    for (const row of payload.data || []) {
      const id = Number(row.id);
      if (id > 0 && !ids.includes(id)) ids.push(id);
    }
    cursor = payload.nextPageCursor || "";
    if (!cursor) break;
  }

  const details = new Map<number, CatalogRow>();
  cursor = "";
  for (let page = 0; page < 10; page += 1) {
    const params = new URLSearchParams({
      creatorType: "2",
      creatorTargetId: String(groupId),
      limit: "30",
    });
    if (cursor) params.set("cursor", cursor);
    const res = await catalogGet(
      `https://catalog.roblox.com/v1/search/items/details?${params}`
    );
    if (!res.ok) break;
    const payload = (await res.json()) as {
      nextPageCursor?: string | null;
      data?: CatalogRow[];
    };
    for (const row of payload.data || []) {
      if (row.id) details.set(Number(row.id), row);
    }
    cursor = payload.nextPageCursor || "";
    if (!cursor) break;
  }

  const rows: CatalogRow[] = ids.map(
    (id) => details.get(id) || { id, name: `Asset ${id}` }
  );

  const thumbs = await fetchThumbs(rows.map((row) => Number(row.id)));
  const items: AssetLook[] = rows.map((row) => {
    const id = Number(row.id);
    const typeId = Number(row.assetType || 0);
    return {
      id,
      name: row.name || `Asset ${id}`,
      description: row.description || "",
      assetTypeId: typeId,
      assetType: ASSET_TYPE[typeId] || `Type ${typeId}`,
      creatorName: row.creatorName || group.name || null,
      creatorType: row.creatorType || "Group",
      createdAt: row.itemCreatedUtc || null,
      thumbnailUrl: thumbs.get(id) || null,
      storeUrl: `https://create.roblox.com/store/asset/${id}`,
      catalogUrl: `https://www.roblox.com/catalog/${id}`,
      sales: null,
      favorites: null,
      price: null,
      demandField: "favorites" as const,
    };
  });

  // Batch enrich items with prices, live favorites and UGC Limited sales
  for (let i = 0; i < items.length; i += 30) {
    const chunk = items.slice(i, i + 30);
    try {
      const catalogRes = (await csrfPost("https://catalog.roblox.com/v1/catalog/items/details", {
        items: chunk.map((item) => ({ itemType: "Asset", id: item.id })),
      })) as {
        data?: {
          id?: number;
          favoriteCount?: number;
          price?: number;
          saleCount?: number;
          sales?: number;
          collectibleItemId?: string;
        }[];
      } | null;

      const collectibleIds: string[] = [];
      for (const row of catalogRes?.data || []) {
        const item = items.find((it) => it.id === row.id);
        if (!item) continue;
        if (typeof row.favoriteCount === "number") item.favorites = row.favoriteCount;
        if (typeof row.price === "number") item.price = row.price;
        if (typeof row.saleCount === "number") item.sales = row.saleCount;
        if (typeof row.sales === "number" && (item.sales || 0) < row.sales) item.sales = row.sales;
        if (row.collectibleItemId) collectibleIds.push(row.collectibleItemId);
      }

      if (collectibleIds.length > 0) {
        const market = await csrfPost("https://apis.roblox.com/marketplace-items/v1/items/details", {
          itemIds: collectibleIds,
        });
        const mRows = Array.isArray(market) ? (market as { itemTargetId?: number; sales?: number }[]) : [];
        for (const mRow of mRows) {
          if (mRow.itemTargetId && typeof mRow.sales === "number") {
            const item = items.find((it) => it.id === mRow.itemTargetId);
            if (item) item.sales = mRow.sales;
          }
        }
      }
    } catch {}
  }

  for (const item of items) {
    item.demandField = (item.sales || 0) > 0 ? "sales" : "favorites";
  }

  return {
    groupId: group.id,
    groupName: group.name || `Group ${group.id}`,
    memberCount: typeof group.memberCount === "number" ? group.memberCount : null,
    itemCount: items.length,
    roles,
    items,
  };
}

export async function lookupAsset(raw: string): Promise<AssetLook | null> {
  const id = parseAssetId(raw);
  if (!id) return null;

  const [detailsRes, thumbRes] = await Promise.all([
    fetch(`https://economy.roblox.com/v2/assets/${id}/details`, {
      headers: { Accept: "application/json", "User-Agent": UA },
    }),
    fetch(
      `https://thumbnails.roblox.com/v1/assets?assetIds=${id}&size=420x420&format=Png&isCircular=false`,
      { headers: { Accept: "application/json", "User-Agent": UA } }
    ),
  ]);

  if (!detailsRes.ok) return null;
  const details = (await detailsRes.json()) as {
    AssetId?: number;
    Name?: string;
    Description?: string;
    AssetTypeId?: number;
    Created?: string;
    Sales?: number;
    PriceInRobux?: number;
    Creator?: { Name?: string; CreatorType?: string };
  };
  if (!details.AssetId) return null;

  const thumbs = (await thumbRes.json().catch(() => null)) as {
    data?: { targetId?: number; state?: string; imageUrl?: string }[];
  } | null;
  const thumb = thumbs?.data?.find((row) => row.targetId === id && row.state === "Completed");

  const look: AssetLook = {
    id: details.AssetId,
    name: details.Name || `Asset ${id}`,
    description: details.Description || "",
    assetTypeId: Number(details.AssetTypeId || 0),
    assetType: ASSET_TYPE[Number(details.AssetTypeId || 0)] || `Type ${details.AssetTypeId}`,
    creatorName: details.Creator?.Name || null,
    creatorType: details.Creator?.CreatorType || null,
    createdAt: details.Created || null,
    thumbnailUrl: thumb?.imageUrl || null,
    storeUrl: `https://create.roblox.com/store/asset/${details.AssetId}`,
    catalogUrl: `https://www.roblox.com/catalog/${details.AssetId}`,
    sales: typeof details.Sales === "number" ? details.Sales : null,
    favorites: null,
    price: typeof details.PriceInRobux === "number" ? details.PriceInRobux : null,
    demandField: "favorites",
  };
  await attachDemand(look);
  return look;
}
