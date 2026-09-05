import type { CatalogItem, ScoredCluster } from "./types.js";

const ALIASES: Record<string, string[]> = {
  sl: ["solo", "leveling", "jinwoo", "sung", "igris", "shadow"],
  jjk: ["jujutsu", "kaisen", "gojo", "sukuna", "itadori", "yuji", "megumi"],
  y2k: ["y2k", "mcbling", "juicy", "butterfly", "lowrise", "rhinestone", "velour"],
  emo: ["emo", "scene", "stripe", "myspace", "rawr"],
  cutecore: ["cutecore", "kawaii", "bow", "pastel", "sanrio"],
  coquette: ["coquette", "bow", "ribbon", "lace"],
  gyaru: ["gyaru", "gal", "kogal"],
  goth: ["goth", "gothic", "vamp", "vampire", "halloween", "spooky"],
  vamp: ["vamp", "vampire", "gothic", "halloween"],
  halloween: ["halloween", "spooky", "vampire", "witch", "ghost", "pumpkin", "bat", "goth", "spiderweb"],
  spooky: ["spooky", "halloween", "ghost", "skeleton", "horror", "pumpkin"],
  witch: ["witch", "witchy", "magic", "wizard", "halloween"],
  pumpkin: ["pumpkin", "halloween", "spooky", "jack"],
  spiderweb: ["spiderweb", "spider", "goth", "halloween", "emo"],
  grunge: ["grunge", "oversized"],
  dominus: ["dominus", "domino"],
  fedora: ["fedora", "classic"],
  jeans: ["jeans", "denim", "baggy"],
  denim: ["denim", "jeans"],
  baggy: ["baggy", "cargo", "jeans"],
  cargo: ["cargo", "pocket", "baggy"],
  puffer: ["puffer", "jacket"],
  hoodie: ["hoodie", "sweater"],
  camo: ["camo", "camouflage"],
  korblox: ["korblox", "deathspeaker", "headless"],
  headless: ["headless", "korblox"],
  aot: ["attack", "titan", "eren", "mikasa"],
  mha: ["hero", "academia", "deku", "bakugo", "todoroki"],
  ds: ["demon", "slayer", "tanjiro", "nezuko"],
  kny: ["demon", "slayer", "tanjiro"],
  op: ["piece", "luffy", "zoro"],
  bl: ["blue", "lock", "isagi", "bachira"],
  csm: ["chainsaw", "denji", "makima"],
  genshin: ["genshin", "hutao", "raiden", "paimon"],
  kuromi: ["kuromi", "sanrio", "melody"],
  sanrio: ["sanrio", "kuromi", "kitty", "cinnamoroll"],
  labubu: ["labubu"],
  egg: ["egg", "strongest"],
  sparkle: ["sparkle", "time"],
};

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function tokens(value: string): string[] {
  return fold(value)
    .split(/[^a-z0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2 && !/^\d+$/.test(part));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function queryTokens(q: string): string[] {
  return unique(tokens(q));
}

export function expandQuery(q: string): string[] {
  const raw = queryTokens(q);
  const extra = raw.flatMap((token) => ALIASES[token] || []);
  return unique([...raw, ...extra]);
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 1) return 99;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const grid = Array.from({ length: rows }, (_, i) => {
    const row = new Array<number>(cols);
    row[0] = i;
    return row;
  });
  for (let j = 0; j < cols; j += 1) grid[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      grid[i][j] = Math.min(
        grid[i - 1][j] + 1,
        grid[i][j - 1] + 1,
        grid[i - 1][j - 1] + cost
      );
    }
  }
  return grid[a.length][b.length];
}

function tokenHit(queryToken: string, hay: Set<string>): number {
  if (hay.has(queryToken)) return 1;
  let best = 0;
  for (const hayToken of hay) {
    if (hayToken.startsWith(queryToken) || queryToken.startsWith(hayToken)) {
      best = Math.max(best, queryToken.length >= 2 ? 0.88 : 0.7);
    } else if (hayToken.includes(queryToken) || (queryToken.length >= 3 && queryToken.includes(hayToken))) {
      best = Math.max(best, 0.74);
    } else if (
      queryToken.length >= 4 &&
      hayToken.length >= 4 &&
      editDistance(queryToken, hayToken) <= 1
    ) {
      best = Math.max(best, 0.64);
    }
    if (best >= 0.88) break;
  }
  return best;
}

function haystack(cluster: ScoredCluster, members: CatalogItem[]): Set<string> {
  const blob = [
    cluster.label,
    cluster.matchedIp || "",
    ...cluster.keywords.map((row) => row.term),
    ...cluster.sampleTitles,
    ...(cluster.previews || []).map((row) => row.name),
    ...members.map((item) => item.name),
    ...members.map((item) => item.creatorName),
  ].join(" ");
  return new Set(tokens(blob));
}

export function matchQuality(
  queryTokens: string[],
  cluster: ScoredCluster,
  members: CatalogItem[]
): number {
  if (!queryTokens.length) return 1;
  const hay = haystack(cluster, members);
  const hits = queryTokens.map((token) => tokenHit(token, hay));
  const best = Math.max(...hits, 0);
  const mean = hits.reduce((sum, n) => sum + n, 0) / hits.length;
  if (best < 0.64 && mean < 0.45) return 0;
  return Number((mean * 0.65 + best * 0.35).toFixed(4));
}

export function looksViral(cluster: ScoredCluster): boolean {
  const m = cluster.metrics;
  return (
    (m.salesTotal || 0) > 0 ||
    m.acceleration >= 1.3 ||
    m.velocity >= 2 ||
    cluster.badges.length > 0 ||
    Boolean(cluster.matchedIp) ||
    cluster.flagged ||
    cluster.verdict === "subir" ||
    cluster.verdict === "vale"
  );
}

export function viralRank(cluster: ScoredCluster): number {
  const m = cluster.metrics;
  const sales = m.salesTotal || 0;
  let score =
    Math.log10(sales + 1) * 9 +
    (m.acceleration || 0) * 3.2 +
    (m.velocity || 0) * 1.5 +
    (m.velocityPerHour || 0) * 2.5 +
    Math.log10((m.favoritesTotal || 0) + 1) * 0.5;

  if ((m.acceleration || 0) >= 1.3) score += 4;
  if ((m.demandAcceleration || 0) >= 1.3) score += 1.4;
  if (cluster.badges.includes("ganhando_forca")) score += 3;
  if (cluster.badges.includes("achado")) score += 3.2;
  if (cluster.badges.includes("referencia")) score += 2.4;
  if (cluster.matchedIp) score += 3.5;
  if (cluster.flagged) score += 2;
  if (cluster.verdict === "subir") score += 2;
  if (cluster.verdict === "vale") score += 1;
  return score;
}

export function searchRank(cluster: ScoredCluster, quality: number): number {
  return viralRank(cluster) * (0.55 + 0.45 * quality) + quality * 8;
}
